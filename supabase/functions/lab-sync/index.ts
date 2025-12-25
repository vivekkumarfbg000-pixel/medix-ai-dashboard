import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LabSyncRequest {
  patient_id: string;
  patient_name: string;
  lab_provider: string;
  test_type: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: LabSyncRequest = await req.json();
    const n8nWebhookUrl = Deno.env.get("N8N_LAB_SYNC_WEBHOOK_URL");

    if (!n8nWebhookUrl) {
      console.log("N8N_LAB_SYNC_WEBHOOK_URL not configured, skipping webhook");
      return new Response(
        JSON.stringify({ success: true, message: "Lab sync queued (n8n not configured)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger n8n workflow to fetch lab results from external API
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "lab_sync",
        data: {
          patient_id: payload.patient_id,
          patient_name: payload.patient_name,
          lab_provider: payload.lab_provider,
          test_type: payload.test_type,
          requested_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ success: true, message: "Lab sync triggered", data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Lab sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
