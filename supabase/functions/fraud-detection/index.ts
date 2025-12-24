import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StockAdjustment {
  shop_id: string;
  medicine_id: string;
  medicine_name: string;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  adjusted_by: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: StockAdjustment = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate write-off percentage
    const writeOffAmount = payload.previous_quantity - payload.new_quantity;
    const writeOffPercentage = (writeOffAmount / payload.previous_quantity) * 100;

    console.log(`Stock adjustment: ${payload.medicine_name}, Write-off: ${writeOffPercentage.toFixed(2)}%`);

    // Check if this is a significant write-off (>5%)
    if (writeOffPercentage > 5 && writeOffAmount > 0) {
      console.log("Fraud detection triggered: >5% stock write-off");

      const n8nWebhookUrl = Deno.env.get("N8N_FRAUD_ALERT_WEBHOOK_URL");
      const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const telegramChatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");

      // Get shop details
      const { data: shop } = await supabase
        .from("shops")
        .select("name, owner_id")
        .eq("id", payload.shop_id)
        .single();

      const alertMessage = `🚨 FRAUD ALERT: Suspicious Stock Adjustment

Shop: ${shop?.name || "Unknown"}
Medicine: ${payload.medicine_name}
Previous Qty: ${payload.previous_quantity}
New Qty: ${payload.new_quantity}
Write-off: ${writeOffAmount} units (${writeOffPercentage.toFixed(1)}%)
Reason: ${payload.reason}
Adjusted By: ${payload.adjusted_by}
Time: ${new Date().toISOString()}`;

      // Option 1: Send via n8n
      if (n8nWebhookUrl) {
        await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "fraud_alert",
            severity: "high",
            data: {
              ...payload,
              write_off_percentage: writeOffPercentage,
              shop_name: shop?.name,
              alert_message: alertMessage,
            },
          }),
        });
      }

      // Option 2: Direct Telegram (if configured)
      if (telegramBotToken && telegramChatId) {
        await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: alertMessage,
            parse_mode: "HTML",
          }),
        });
      }

      // Log the alert
      await supabase.from("audit_logs").insert({
        shop_id: payload.shop_id,
        table_name: "inventory",
        record_id: payload.medicine_id,
        action: "FRAUD_ALERT",
        new_value: {
          alert_type: "high_writeoff",
          write_off_percentage: writeOffPercentage,
          details: payload,
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          fraud_alert: true,
          message: "Stock adjustment recorded with fraud alert sent" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, fraud_alert: false, message: "Stock adjustment recorded" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Fraud detection error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
