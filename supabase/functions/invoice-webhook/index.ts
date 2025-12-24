import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
      console.log("N8N_INVOICE_WEBHOOK_URL not configured, skipping webhook");
      return new Response(
        JSON.stringify({ success: true, message: "Invoice queued (n8n not configured)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger n8n workflow to generate PDF and send via WhatsApp
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "invoice",
        data: {
          sale_id: payload.sale_id,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
          items: payload.items,
          total: payload.total,
          shop_name: payload.shop_name,
          generated_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Invoice sent to n8n for processing" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Invoice webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
