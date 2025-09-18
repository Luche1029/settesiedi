/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-cert-url, paypal-auth-algo, paypal-transmission-sig",
};

async function getToken() {
  const basic = btoa(`${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_SECRET")}`);
  const tokRes = await fetch(`${Deno.env.get("PAYPAL_BASE")}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!tokRes.ok) throw new Error("token error");
  return tokRes.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const headers = Object.fromEntries(req.headers.entries());

    // 1) verifica firma webhook
    const tok = await getToken();
    const verifyRes = await fetch(`${Deno.env.get("PAYPAL_BASE")}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: Deno.env.get("PAYPAL_WEBHOOK_ID"),
        webhook_event: body,
      }),
    });
    const verify = await verifyRes.json();
    if (verify.verification_status !== "SUCCESS") {
      return new Response("invalid signature", { status: 400, headers: cors });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const type = body?.event_type;
    const orderId =
      body?.resource?.supplementary_data?.related_ids?.order_id ||
      body?.resource?.id ||
      body?.resource?.order_id;

    async function succeed(orderId: string, amountStr: string, provider_meta: unknown) {
      const { data: pay } = await supa.from("payment").select("*").eq("provider_order_id", orderId).single();
      if (!pay) return;

      const amount = Number(amountStr);
      await supa.from("payment").update({
        status: "succeeded",
        provider_meta,
        updated_at: new Date().toISOString(),
      }).eq("id", pay.id);

      await supa.rpc("wallet_apply_topup", {
        p_user: pay.user_id,
        p_amount: amount,
        p_reason: `topup:${pay.id}`,
      });
    }

    if (type === "CHECKOUT.ORDER.APPROVED") {
      const tok2 = await getToken();
      const capRes = await fetch(`${Deno.env.get("PAYPAL_BASE")}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${tok2.access_token}`, "Content-Type": "application/json" },
      });
      const capture = await capRes.json();
      const cap = capture?.purchase_units?.[0]?.payments?.captures?.[0];
      if (cap?.status === "COMPLETED") {
        await succeed(orderId, cap.amount?.value, capture);
      }
    } else if (type === "PAYMENT.CAPTURE.COMPLETED") {
      const amountStr = body?.resource?.amount?.value ?? "0";
      await succeed(orderId, amountStr, body);
    }

    return new Response("ok", { headers: cors });
  } catch (e) {
    return new Response(`Webhook error: ${e?.message || e}`, { status: 500, headers: cors });
  }
});
