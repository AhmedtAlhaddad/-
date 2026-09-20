import { NextResponse } from "next/server";

import { revalidatePublicCatalog } from "@/lib/supabase/revalidate-catalog";
import { createClient } from "@/lib/supabase/server";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "delivered"
  | "cancelled";

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isOrderStatus(value: string): value is OrderStatus {
  return [
    "pending",
    "confirmed",
    "preparing",
    "delivered",
    "cancelled",
  ].includes(value);
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function statusError(code: string | undefined, message: string) {
  if (code === "42501") {
    return {
      status: 403,
      message: "ليس لديك صلاحية تحديث الطلبات.",
    };
  }

  if (code === "22023") {
    return {
      status: 400,
      message: "حالة الطلب المطلوبة غير صالحة.",
    };
  }

  if (
    code === "P0001" ||
    code === "55000" ||
    message.toLowerCase().includes("transition")
  ) {
    return {
      status: 409,
      message:
        "تغيرت حالة الطلب أو أن الانتقال المطلوب غير مسموح. حدّث الصفحة وأعد المحاولة.",
    };
  }

  return {
    status: 400,
    message: "تعذر تحديث حالة الطلب.",
  };
}

async function getAdminClient() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return {
      supabase: null,
      response: errorResponse("يجب تسجيل الدخول أولًا.", 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.active !== true
  ) {
    return {
      supabase: null,
      response: errorResponse("ليس لديك صلاحية الإدارة.", 403),
    };
  }

  return {
    supabase,
    response: null,
  };
}

export async function POST(request: Request) {
  const auth = await getAdminClient();

  if (auth.response || !auth.supabase) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("بيانات الطلب غير صالحة.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("بيانات الطلب غير صالحة.");
  }

  const payload = body as Record<string, unknown>;
  const orderId = text(payload.order_id);
  const requestedStatus = text(payload.status);

  if (!isUuid(orderId)) {
    return errorResponse("معرّف الطلب غير صالح.");
  }

  if (!isOrderStatus(requestedStatus)) {
    return errorResponse("حالة الطلب المطلوبة غير صالحة.");
  }

  const { data: order, error: orderError } = await auth.supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return errorResponse("تعذر قراءة حالة الطلب.");
  }

  if (!order) {
    return errorResponse("الطلب غير موجود.", 404);
  }

  if (!isOrderStatus(order.status)) {
    return errorResponse("حالة الطلب الحالية غير معروفة.", 409);
  }

  if (!allowedTransitions[order.status].includes(requestedStatus)) {
    return errorResponse(
      "الانتقال المطلوب غير مسموح من حالة الطلب الحالية.",
      409,
    );
  }

  const { error } = await auth.supabase.rpc("set_order_status", {
    p_order_id: orderId,
    p_new_status: requestedStatus,
  });

  if (error) {
    const result = statusError(error.code, error.message);
    return errorResponse(result.message, result.status);
  }

  revalidatePublicCatalog();

  return NextResponse.json({ success: true });
}
