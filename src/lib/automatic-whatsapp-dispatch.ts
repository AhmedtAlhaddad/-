import { createClient } from "@/lib/supabase/server";
import {
  sendWhatsAppOrderNotification,
  type OrderNotificationItem,
  type OrderNotificationPayload,
} from "@/lib/whatsapp-order-notification";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseItem(value: unknown): OrderNotificationItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const quantity = number(item.quantity);
  const unitPrice = number(item.unit_price);
  const lineTotal = number(item.line_total);
  const productName = text(item.product_name_snapshot);

  if (
    !productName ||
    quantity === null ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    unitPrice === null ||
    lineTotal === null
  ) {
    return null;
  }

  return {
    product_name_snapshot: productName,
    variant_description_snapshot: text(item.variant_description_snapshot),
    sku_snapshot: text(item.sku_snapshot),
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
  };
}

function parsePayload(value: unknown): OrderNotificationPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const orderNumber = payload.order_number;
  const createdAt = text(payload.created_at);
  const currency = text(payload.currency);
  const subtotal = number(payload.subtotal);
  const discountPercent = number(payload.customer_discount_percent_snapshot);
  const discountAmount = number(payload.discount_amount);
  const total = number(payload.total);
  const rawItems = payload.items;
  const items = Array.isArray(rawItems)
    ? rawItems.map(parseItem).filter((item): item is OrderNotificationItem => item !== null)
    : [];

  if (
    (typeof orderNumber !== "string" && typeof orderNumber !== "number") ||
    !createdAt ||
    !currency ||
    !text(payload.customer_full_name) ||
    !text(payload.customer_phone) ||
    !text(payload.customer_city) ||
    !text(payload.customer_address) ||
    subtotal === null ||
    discountPercent === null ||
    discountAmount === null ||
    total === null ||
    !items.length
  ) {
    return null;
  }

  const athleteValue = payload.athlete;
  const athlete =
    athleteValue && typeof athleteValue === "object" && !Array.isArray(athleteValue)
      ? { display_name: text((athleteValue as Record<string, unknown>).display_name) }
      : null;
  const commissionValue = payload.commission;
  const commissionPercent =
    commissionValue && typeof commissionValue === "object" && !Array.isArray(commissionValue)
      ? number((commissionValue as Record<string, unknown>).commission_percent)
      : null;
  const commissionAmount =
    commissionValue && typeof commissionValue === "object" && !Array.isArray(commissionValue)
      ? number((commissionValue as Record<string, unknown>).commission_amount)
      : null;

  return {
    order_number: orderNumber,
    created_at: createdAt,
    customer_full_name: text(payload.customer_full_name),
    customer_phone: text(payload.customer_phone),
    customer_city: text(payload.customer_city),
    customer_address: text(payload.customer_address),
    customer_notes: text(payload.customer_notes) || null,
    currency,
    subtotal,
    code_snapshot: text(payload.code_snapshot) || null,
    customer_discount_percent_snapshot: discountPercent,
    discount_amount: discountAmount,
    total,
    status: text(payload.status) || "pending",
    items,
    athlete: athlete?.display_name ? athlete : null,
    commission:
      commissionPercent !== null && commissionAmount !== null
        ? {
            commission_percent: commissionPercent,
            commission_amount: commissionAmount,
          }
        : null,
  };
}

type Claim = {
  id: string;
  order_id: string;
  status: "sending" | "sent";
  payload?: OrderNotificationPayload;
};

function parseClaim(value: unknown): Claim | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record.id;
  const orderId = record.order_id;
  const status = record.status;

  if (!uuid(id) || !uuid(orderId) || (status !== "sending" && status !== "sent")) {
    return null;
  }

  if (status === "sending") {
    const payload = parsePayload(record.payload);

    return payload
      ? { id, order_id: orderId, status, payload }
      : null;
  }

  return { id, order_id: orderId, status };
}

export async function dispatchAutomaticWhatsAppOrder(
  orderId: string,
  checkoutIdempotencyKey: string,
) {
  if (!uuid(orderId) || !uuid(checkoutIdempotencyKey)) {
    return;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "claim_checkout_whatsapp_notification",
    {
      p_order_id: orderId,
      p_checkout_idempotency_key: checkoutIdempotencyKey,
    },
  );
  const claim = parseClaim(data);

  if (error || !claim || claim.status === "sent" || !claim.payload) {
    return;
  }

  let success = false;

  try {
    await sendWhatsAppOrderNotification(claim.payload);
    success = true;
  } catch {
    // The order is already committed. The durable outbox remains retryable.
  }

  await supabase.rpc("complete_checkout_whatsapp_notification", {
    p_outbox_id: claim.id,
    p_order_id: orderId,
    p_checkout_idempotency_key: checkoutIdempotencyKey,
    p_success: success,
    p_error: success ? null : "WhatsApp provider delivery failed.",
  });
}
