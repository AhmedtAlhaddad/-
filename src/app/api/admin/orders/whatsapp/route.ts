import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/auth";
import {
  sendWhatsAppOrderNotification,
  type OrderNotificationPayload,
} from "@/lib/whatsapp-order-notification";
import { sanitizeWhatsAppFailure } from "@/lib/whatsapp-failure";
import { isUuid } from "@/lib/uuid";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: string, status = 400, reason?: string) {
  return NextResponse.json(
    { error, ...(reason ? { reason } : {}) },
    { status },
  );
}

type ClaimResult = {
  id: string;
  order_id: string;
  status: "sending" | "sent";
};

function parseClaim(value: unknown): ClaimResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = text(record.id);
  const orderId = text(record.order_id);
  const status = record.status;

  if (
    !isUuid(id) ||
    !isUuid(orderId) ||
    (status !== "sending" && status !== "sent")
  ) {
    return null;
  }

  return { id, order_id: orderId, status };
}

export async function POST(request: Request) {
  const gate = await authorizeAdminApi();

  if (gate.response || !gate.supabase) {
    return gate.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("بيانات الإشعار غير صالحة.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("بيانات الإشعار غير صالحة.");
  }

  const requestPayload = body as Record<string, unknown>;
  const orderId = text(requestPayload.orderId);

  if (Object.keys(requestPayload).length !== 1 || !isUuid(orderId)) {
    return errorResponse("معرّف الطلب غير صالح.");
  }

  const orderResult = await gate.supabase
    .from("orders")
    .select(
      "id, order_number, created_at, customer_full_name, customer_phone, customer_city, customer_address, customer_notes, currency, subtotal, code_snapshot, customer_discount_percent_snapshot, discount_amount, total, status, athlete_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderResult.error) {
    return errorResponse("تعذر قراءة بيانات الطلب المحفوظة.", 500);
  }

  const order = orderResult.data;

  if (!order) {
    return errorResponse("الطلب غير موجود.", 404);
  }

  const { data: claimData, error: claimError } = await gate.supabase.rpc(
    "claim_admin_whatsapp_notification",
    { p_order_id: orderId },
  );
  const claim = parseClaim(claimData);

  if (claimError || !claim) {
    const message = claimError?.message.toLowerCase() ?? "";

    if (
      claimError?.code === "55P03" ||
      message.includes("already being sent")
    ) {
      return errorResponse("إشعار الطلب قيد الإرسال حاليًا.", 409);
    }

    if (claimError?.code === "P0002" || message.includes("not found")) {
      return errorResponse("لا توجد مهمة إشعار لهذا الطلب.", 404);
    }

    return errorResponse("تعذر بدء إرسال إشعار الطلب.", 503);
  }

  if (claim.status === "sent") {
    return NextResponse.json({ success: true, status: "sent" });
  }

  const [itemsResult, athleteResult, commissionResult] = await Promise.all([
    gate.supabase
      .from("order_items")
      .select(
        "product_name_snapshot, variant_description_snapshot, sku_snapshot, quantity, unit_price, line_total",
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    order.athlete_id
      ? gate.supabase
          .from("athletes")
          .select("display_name")
          .eq("id", order.athlete_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    gate.supabase
      .from("commissions")
      .select("commission_percent, commission_amount")
      .eq("order_id", orderId)
      .maybeSingle(),
  ]);

  if (itemsResult.error || athleteResult.error || commissionResult.error) {
    await gate.supabase.rpc("complete_admin_whatsapp_notification", {
      p_outbox_id: claim.id,
      p_success: false,
      p_error: "Authoritative order data could not be loaded.",
    });
    return errorResponse("تعذر قراءة بيانات الطلب المحفوظة.", 500);
  }

  if (!itemsResult.data?.length) {
    await gate.supabase.rpc("complete_admin_whatsapp_notification", {
      p_outbox_id: claim.id,
      p_success: false,
      p_error: "Authoritative order data is incomplete.",
    });
    return errorResponse("بيانات الطلب المحفوظة غير مكتملة.", 500);
  }

  const payload: OrderNotificationPayload = {
    order_number: order.order_number,
    created_at: order.created_at,
    customer_full_name: order.customer_full_name,
    customer_phone: order.customer_phone,
    customer_city: order.customer_city,
    customer_address: order.customer_address,
    customer_notes: order.customer_notes,
    currency: order.currency,
    subtotal: Number(order.subtotal),
    code_snapshot: order.code_snapshot,
    customer_discount_percent_snapshot: Number(
      order.customer_discount_percent_snapshot,
    ),
    discount_amount: Number(order.discount_amount),
    total: Number(order.total),
    status: order.status,
    items: itemsResult.data.map((item) => ({
      product_name_snapshot: item.product_name_snapshot,
      variant_description_snapshot: item.variant_description_snapshot,
      sku_snapshot: item.sku_snapshot,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
    athlete: order.athlete_id
      ? athleteResult.data
        ? { display_name: athleteResult.data.display_name }
        : null
      : null,
    commission: commissionResult.data
      ? {
          commission_percent: Number(
            commissionResult.data.commission_percent,
          ),
          commission_amount: Number(
            commissionResult.data.commission_amount,
          ),
        }
      : null,
  };

  try {
    await sendWhatsAppOrderNotification(payload);
  } catch (error) {
    const failureReason = sanitizeWhatsAppFailure(error);

    await gate.supabase.rpc("complete_admin_whatsapp_notification", {
      p_outbox_id: claim.id,
      p_success: false,
      p_error: failureReason,
    });
    return errorResponse(
      "تعذر إرسال إشعار WhatsApp؛ بقيت المهمة لإعادة المحاولة.",
      502,
      failureReason,
    );
  }

  const { data: completed, error: completeError } = await gate.supabase.rpc(
    "complete_admin_whatsapp_notification",
    {
      p_outbox_id: claim.id,
      p_success: true,
    },
  );

  if (completeError || !completed) {
    return errorResponse("تم إرسال الإشعار لكن تعذر حفظ حالته.", 503);
  }

  return NextResponse.json({ success: true, status: "sent" });
}
