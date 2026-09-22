import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/auth";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  return text(value) || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function payoutError(code: string | undefined, message: string) {
  if (code === "42501") {
    return {
      status: 403,
      message: "ليس لديك صلاحية تسجيل دفعات العمولات.",
    };
  }

  if (code === "22023") {
    return {
      status: 400,
      message: "يجب اختيار عمولة واحدة على الأقل.",
    };
  }

  if (code === "23505") {
    return {
      status: 409,
      message: "إحدى العمولات مسجلة ضمن دفعة سابقة.",
    };
  }

  if (
    code === "P0001" ||
    message.toLowerCase().includes("approved") ||
    message.toLowerCase().includes("athlete")
  ) {
    return {
      status: 409,
      message:
        "تغيرت حالة إحدى العمولات أو لا تنتمي للرياضي المحدد. حدّث الصفحة وأعد المحاولة.",
    };
  }

  return {
    status: 400,
    message: "تعذر تسجيل دفعة العمولات.",
  };
}

async function getAdminClient() {
  const gate = await authorizeAdminApi();

  if (gate.response) {
    return {
      supabase: null,
      response: gate.response,
    };
  }

  const supabase = gate.supabase;
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
  const athleteId = text(payload.athlete_id);
  const rawCommissionIds = payload.commission_ids;
  const paymentReference = optionalText(payload.payment_reference);
  const notes = optionalText(payload.notes);

  if (!isUuid(athleteId)) {
    return errorResponse("معرّف الرياضي غير صالح.");
  }

  if (
    !Array.isArray(rawCommissionIds) ||
    rawCommissionIds.length === 0 ||
    rawCommissionIds.length > 500
  ) {
    return errorResponse("اختر من 1 إلى 500 عمولة لتسجيل الدفعة.");
  }

  const commissionIds = rawCommissionIds.map((value) => text(value));

  if (
    commissionIds.some((id) => !isUuid(id)) ||
    new Set(commissionIds).size !== commissionIds.length
  ) {
    return errorResponse("قائمة العمولات غير صالحة أو تحتوي على تكرار.");
  }

  if (paymentReference && paymentReference.length > 300) {
    return errorResponse("مرجع الدفع طويل جدًا.");
  }

  if (notes && notes.length > 2000) {
    return errorResponse("ملاحظات الدفعة طويلة جدًا.");
  }

  const { data: commissions, error: commissionsError } = await auth.supabase
    .from("commissions")
    .select("id, athlete_id, order_id, status")
    .in("id", commissionIds);

  if (commissionsError) {
    return errorResponse("تعذر التحقق من العمولات المحددة.");
  }

  if (
    (commissions ?? []).length !== commissionIds.length ||
    (commissions ?? []).some(
      (commission) =>
        commission.athlete_id !== athleteId ||
        commission.status !== "approved",
    )
  ) {
    return errorResponse(
      "يجب أن تكون كل العمولات معتمدة وتابعة للرياضي المحدد.",
      409,
    );
  }

  const orderIds = Array.from(
    new Set((commissions ?? []).map((commission) => commission.order_id)),
  );
  const { data: orders, error: ordersError } = await auth.supabase
    .from("orders")
    .select("id, status")
    .in("id", orderIds);

  if (
    ordersError ||
    (orders ?? []).length !== orderIds.length ||
    (orders ?? []).some((order) => order.status !== "delivered")
  ) {
    return errorResponse(
      "الدفع متاح فقط لعمولات الطلبات التي تم تسليمها.",
      409,
    );
  }

  const { data: payoutId, error } = await auth.supabase.rpc(
    "create_commission_payout",
    {
      p_athlete_id: athleteId,
      p_commission_ids: commissionIds,
      p_payment_reference: paymentReference,
      p_notes: notes,
    },
  );

  if (error) {
    const result = payoutError(error.code, error.message);

    return errorResponse(result.message, result.status);
  }

  if (!payoutId || !isUuid(String(payoutId))) {
    return errorResponse(
      "تم تنفيذ الطلب دون إرجاع معرّف دفعة صالح.",
      500,
    );
  }

  return NextResponse.json({
    success: true,
    payout_id: payoutId,
  });
}
