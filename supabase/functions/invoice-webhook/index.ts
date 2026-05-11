import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceRequest {
  sale_id: string;
  customer_name: string;
  customer_phone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  shop_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: InvoiceRequest = await req.json();
    const n8nWebhookUrl = Deno.env.get("N8N_INVOICE_WEBHOOK_URL");

    if (!n8nWebhookUrl) {
      return new Response(
        JSON.stringify({ success: true, message: "Invoice queued (n8n not configured)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- IDEMPOTENCY CHECK ---
    // Prevent double-sending to n8n if client retries
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: existing } = await supabaseClient
      .from("processed_webhooks")
      .select("webhook_id")
      .eq("webhook_id", `invoice_${payload.sale_id}`)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Invoice already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- RESILIENT WEBHOOK CALL ---
    let attempts = 0;
    const maxAttempts = 3;
    const backoff = [1000, 3000, 5000];
    let lastError;

    while (attempts < maxAttempts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            type: "invoice",
            data: { ...payload, generated_at: new Date().toISOString() },
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          // Mark as processed
          await supabaseClient.from("processed_webhooks").insert({ 
            webhook_id: `invoice_${payload.sale_id}` 
          });

          return new Response(
            JSON.stringify({ success: true, message: "Invoice sent to n8n" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        throw new Error(`n8n status: ${response.status}`);
      } catch (err) {
        attempts++;
        lastError = err;
        if (attempts < maxAttempts) {
          console.log(`Retry attempt ${attempts} for sale ${payload.sale_id}...`);
          await new Promise(r => setTimeout(r, backoff[attempts-1]));
        }
      }
    }

    throw lastError;

  } catch (error: any) {
    console.error("Invoice webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
