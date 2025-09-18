/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }
    const { user_id, amount, currency = "EUR" } = await req.json();

    if (!user_id || !amount || Number(amount) <= 0) {
      return new Response("Bad request", { status: 400, headers: cors });
    }

    // 1) OAuth token
    const basic = btoa(
      `${Deno.env.get("PAYPAL_CLIENT_ID")}:${Deno.env.get("PAYPAL_SECRET")}`,
    );
    const tokRes = await fetch(`${Deno.env.get("PAYPAL_BASE")}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!tokRes.ok) {
      const t = await tokRes.text();
      return new Response(`PayPal token error: ${t}`, { status: 500, headers: cors });
    }
    const tok = await tokRes.json();

    // 2) Create order (intent CAPTURE)
    const orderRes = await fetch(`${Deno.env.get("PAYPAL_BASE")}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tok.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          { amount: { currency_code: currency, value: Number(amount).toFixed(2) } },
        ],
        application_context: {
          brand_name: "7siedi",
          user_action: "PAY_NOW",
          return_url: Deno.env.get("PUBLIC_BASE_URL") ?? "http://localhost:4200",
          cancel_url: Deno.env.get("PUBLIC_BASE_URL") ?? "http://localhost:4200",
        },
      }),
    });
    const order = await orderRes.json();
    if (!orderRes.ok) {
      return new Response(`PayPal order error: ${JSON.stringify(order)}`, { status: 500, headers: cors });
    }

    // 3) Save payment record
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supa.from("payment").insert({
      user_id,
      provider: "paypal",
      kind: "topup",
      amount,
      currency,
      status: "pending",
      provider_order_id: order.id,
      provider_meta: order,
    });

    const approvalUrl = order.links?.find((l: any) => l.rel === "approve")?.href;
    return new Response(JSON.stringify({ id: order.id, approvalUrl }), {
      headers: { "content-type": "application/json", ...cors },
    });
  } catch (e) {
    return new Response(`Error: ${e?.message || e}`, { status: 500, headers: cors });
  }
});
