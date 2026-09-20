import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type DiscountScope = "global" | "category" | "product";

type DiscountInput = {
  code: string;
  active: boolean;
  customerDiscountPercent: number;
  athleteId: string | null;
  athleteCommissionPercent: number;
  scopeType: DiscountScope;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  minimumSubtotal: number | null;
  targetIds: string[];
  id: string;
};

type DatabaseError = {
  code?: string;
  message: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function partialResponse(error: DatabaseError, fallback: string) {
  return NextResponse.json(
    {
      error: `${postgresMessage(error.code, fallback)} تم إبقاء الكود غير نشط لحين إعادة المحاولة.`,
      partial: true,
    },
    { status: 500 },
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function hasScale(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return (
    Math.abs(value * multiplier - Math.round(value * multiplier)) <
    0.0000001
  );
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

function parseDate(value: unknown) {
  const raw = text(value);

  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function postgresMessage(code: string | undefined, fallback: string) {
  if (code === "23505") {
    return "هذا الكود مستخدم مسبقًا.";
  }

  if (code === "23503") {
    return "أحد العناصر المرتبطة لم يعد موجودًا.";
  }

  if (code === "23514") {
    return "إحدى القيم لا تطابق شروط كود الخصم.";
  }

  if (code === "42501") {
    return "ليس لديك صلاحية تنفيذ هذه العملية.";
  }

  if (code === "55000") {
    return "تعذر تغيير النطاق مع وجود أهداف قديمة مرتبطة.";
  }

  return fallback;
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

async function readPayload(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      input: null,
      response: errorResponse("بيانات الطلب غير صالحة."),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      input: null,
      response: errorResponse("بيانات الطلب غير صالحة."),
    };
  }

  const payload = body as Record<string, unknown>;
  const code = text(payload.code).toUpperCase();
  const customerDiscountPercent = Number(
    payload.customer_discount_percent,
  );
  const athleteCommissionPercent = Number(
    payload.athlete_commission_percent,
  );
  const athleteId = text(payload.athlete_id) || null;
  const scopeType = text(payload.scope_type);
  const startsAt = parseDate(payload.starts_at);
  const endsAt = parseDate(payload.ends_at);
  const usageLimit = optionalNumber(payload.usage_limit);
  const minimumSubtotal = optionalNumber(payload.minimum_subtotal);
  const rawTargetIds = payload.target_ids;

  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    return {
      input: null,
      response: errorResponse(
        "الكود يجب أن يتكون من 3 إلى 32 حرفًا إنجليزيًا كبيرًا أو رقمًا أو _ أو -.",
      ),
    };
  }

  if (typeof payload.active !== "boolean") {
    return {
      input: null,
      response: errorResponse("حالة الكود غير صالحة."),
    };
  }

  if (
    !Number.isFinite(customerDiscountPercent) ||
    customerDiscountPercent < 0 ||
    customerDiscountPercent > 100 ||
    !hasScale(customerDiscountPercent, 2)
  ) {
    return {
      input: null,
      response: errorResponse(
        "نسبة خصم العميل يجب أن تكون بين 0 و100 وبحد أقصى منزلتين عشريتين.",
      ),
    };
  }

  if (
    !Number.isFinite(athleteCommissionPercent) ||
    athleteCommissionPercent < 0 ||
    athleteCommissionPercent > 100 ||
    !hasScale(athleteCommissionPercent, 2)
  ) {
    return {
      input: null,
      response: errorResponse(
        "نسبة عمولة الرياضي يجب أن تكون بين 0 و100 وبحد أقصى منزلتين عشريتين.",
      ),
    };
  }

  if (customerDiscountPercent === 0 && athleteCommissionPercent === 0) {
    return {
      input: null,
      response: errorResponse(
        "يجب أن تكون نسبة خصم العميل أو عمولة الرياضي أكبر من صفر.",
      ),
    };
  }

  if (athleteCommissionPercent > 0 && !athleteId) {
    return {
      input: null,
      response: errorResponse(
        "اختر رياضيًا أو مؤثرًا عند تحديد عمولة أكبر من صفر.",
      ),
    };
  }

  if (athleteId && !isUuid(athleteId)) {
    return {
      input: null,
      response: errorResponse("معرّف الرياضي غير صالح."),
    };
  }

  if (!(["global", "category", "product"] as string[]).includes(scopeType)) {
    return {
      input: null,
      response: errorResponse("نطاق الكود غير صالح."),
    };
  }

  if (startsAt === undefined || endsAt === undefined) {
    return {
      input: null,
      response: errorResponse("تاريخ بداية أو نهاية الصلاحية غير صالح."),
    };
  }

  if (
    startsAt &&
    endsAt &&
    new Date(endsAt).getTime() <= new Date(startsAt).getTime()
  ) {
    return {
      input: null,
      response: errorResponse("يجب أن تكون نهاية الصلاحية بعد بدايتها."),
    };
  }

  if (
    usageLimit !== null &&
    (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 2147483647)
  ) {
    return {
      input: null,
      response: errorResponse("حد الاستخدام يجب أن يكون عددًا صحيحًا موجبًا."),
    };
  }

  if (
    minimumSubtotal !== null &&
    (!Number.isFinite(minimumSubtotal) ||
      minimumSubtotal < 0 ||
      minimumSubtotal > 999999999.999 ||
      !hasScale(minimumSubtotal, 3))
  ) {
    return {
      input: null,
      response: errorResponse(
        "الحد الأدنى للمجموع غير صالح أو يتجاوز ثلاث منازل عشرية.",
      ),
    };
  }

  if (!Array.isArray(rawTargetIds) || rawTargetIds.length > 500) {
    return {
      input: null,
      response: errorResponse("قائمة عناصر النطاق غير صالحة."),
    };
  }

  const targetIds = Array.from(
    new Set(rawTargetIds.map((value) => text(value))),
  );

  if (targetIds.some((id) => !isUuid(id))) {
    return {
      input: null,
      response: errorResponse("أحد معرّفات عناصر النطاق غير صالح."),
    };
  }

  if (scopeType === "global" && targetIds.length > 0) {
    return {
      input: null,
      response: errorResponse("النطاق العام لا يقبل تصنيفات أو منتجات محددة."),
    };
  }

  if (scopeType !== "global" && targetIds.length === 0) {
    return {
      input: null,
      response: errorResponse("اختر عنصرًا واحدًا على الأقل للنطاق المحدد."),
    };
  }

  const input: DiscountInput = {
    code,
    active: payload.active,
    customerDiscountPercent,
    athleteId,
    athleteCommissionPercent,
    scopeType: scopeType as DiscountScope,
    startsAt,
    endsAt,
    usageLimit,
    minimumSubtotal,
    targetIds,
    id: text(payload.id),
  };

  return {
    input,
    response: null,
  };
}

async function validateReferences(
  supabase: SupabaseClient,
  input: DiscountInput,
) {
  if (input.athleteId) {
    const { data, error } = await supabase
      .from("athletes")
      .select("id")
      .eq("id", input.athleteId)
      .maybeSingle();

    if (error || !data) {
      return errorResponse("الرياضي المحدد غير موجود.");
    }
  }

  if (input.scopeType === "category") {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .in("id", input.targetIds);

    if (error || (data ?? []).length !== input.targetIds.length) {
      return errorResponse("أحد التصنيفات المحددة غير موجود.");
    }
  }

  if (input.scopeType === "product") {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .in("id", input.targetIds);

    if (error || (data ?? []).length !== input.targetIds.length) {
      return errorResponse("أحد المنتجات المحددة غير موجود.");
    }
  }

  return null;
}

function discountValues(input: DiscountInput, active: boolean) {
  return {
    code: input.code,
    active,
    customer_discount_percent: input.customerDiscountPercent,
    athlete_id: input.athleteId,
    athlete_commission_percent: input.athleteCommissionPercent,
    scope_type: input.scopeType,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    usage_limit: input.usageLimit,
    minimum_subtotal: input.minimumSubtotal,
  };
}

async function insertTargets(
  supabase: SupabaseClient,
  discountCodeId: string,
  input: DiscountInput,
): Promise<DatabaseError | null> {
  if (input.scopeType === "category") {
    const { error } = await supabase
      .from("discount_code_categories")
      .insert(
        input.targetIds.map((categoryId) => ({
          discount_code_id: discountCodeId,
          category_id: categoryId,
        })),
      );

    return error;
  }

  if (input.scopeType === "product") {
    const { error } = await supabase
      .from("discount_code_products")
      .insert(
        input.targetIds.map((productId) => ({
          discount_code_id: discountCodeId,
          product_id: productId,
        })),
      );

    return error;
  }

  return null;
}

async function activateIfRequested(
  supabase: SupabaseClient,
  discountCodeId: string,
  active: boolean,
) {
  if (!active) {
    return null;
  }

  const { error } = await supabase
    .from("discount_codes")
    .update({ active: true })
    .eq("id", discountCodeId);

  return error;
}

export async function POST(request: Request) {
  const auth = await getAdminClient();

  if (auth.response || !auth.supabase) {
    return auth.response;
  }

  const parsed = await readPayload(request);

  if (parsed.response || !parsed.input) {
    return parsed.response;
  }

  const referenceError = await validateReferences(
    auth.supabase,
    parsed.input,
  );

  if (referenceError) {
    return referenceError;
  }

  const { data, error } = await auth.supabase
    .from("discount_codes")
    .insert(discountValues(parsed.input, false))
    .select("id")
    .single();

  if (error || !data) {
    return errorResponse(
      postgresMessage(error?.code, "تعذر إنشاء كود الخصم."),
      error?.code === "23505" ? 409 : 400,
    );
  }

  const targetError = await insertTargets(
    auth.supabase,
    data.id,
    parsed.input,
  );

  if (targetError) {
    return partialResponse(targetError, "تعذر حفظ نطاق الكود.");
  }

  const activationError = await activateIfRequested(
    auth.supabase,
    data.id,
    parsed.input.active,
  );

  if (activationError) {
    return partialResponse(activationError, "تعذر تفعيل الكود.");
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const auth = await getAdminClient();

  if (auth.response || !auth.supabase) {
    return auth.response;
  }

  const parsed = await readPayload(request);

  if (parsed.response || !parsed.input) {
    return parsed.response;
  }

  if (!parsed.input.id || !isUuid(parsed.input.id)) {
    return errorResponse("معرّف كود الخصم غير صالح.");
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from("discount_codes")
    .select("id, redemption_count")
    .eq("id", parsed.input.id)
    .maybeSingle();

  if (existingError) {
    return errorResponse(
      postgresMessage(existingError.code, "تعذر قراءة كود الخصم."),
    );
  }

  if (!existing) {
    return errorResponse("كود الخصم غير موجود.", 404);
  }

  const { data: duplicate, error: duplicateError } = await auth.supabase
    .from("discount_codes")
    .select("id")
    .eq("code", parsed.input.code)
    .neq("id", parsed.input.id)
    .maybeSingle();

  if (duplicateError) {
    return errorResponse(
      postgresMessage(duplicateError.code, "تعذر التحقق من الكود."),
    );
  }

  if (duplicate) {
    return errorResponse("هذا الكود مستخدم مسبقًا.", 409);
  }

  if (
    parsed.input.usageLimit !== null &&
    parsed.input.usageLimit < existing.redemption_count
  ) {
    return errorResponse(
      "لا يمكن خفض حد الاستخدام عن عدد الاستخدامات المسجل.",
    );
  }

  const referenceError = await validateReferences(
    auth.supabase,
    parsed.input,
  );

  if (referenceError) {
    return referenceError;
  }

  const { error: deactivateError } = await auth.supabase
    .from("discount_codes")
    .update({ active: false })
    .eq("id", parsed.input.id);

  if (deactivateError) {
    return errorResponse(
      postgresMessage(deactivateError.code, "تعذر تعطيل الكود مؤقتًا."),
    );
  }

  const { error: categoryDeleteError } = await auth.supabase
    .from("discount_code_categories")
    .delete()
    .eq("discount_code_id", parsed.input.id);

  if (categoryDeleteError) {
    return partialResponse(
      categoryDeleteError,
      "تعذر إزالة نطاق التصنيفات السابق.",
    );
  }

  const { error: productDeleteError } = await auth.supabase
    .from("discount_code_products")
    .delete()
    .eq("discount_code_id", parsed.input.id);

  if (productDeleteError) {
    return partialResponse(
      productDeleteError,
      "تعذر إزالة نطاق المنتجات السابق.",
    );
  }

  const { error: updateError } = await auth.supabase
    .from("discount_codes")
    .update(discountValues(parsed.input, false))
    .eq("id", parsed.input.id);

  if (updateError) {
    return partialResponse(updateError, "تعذر تحديث بيانات الكود.");
  }

  const targetError = await insertTargets(
    auth.supabase,
    parsed.input.id,
    parsed.input,
  );

  if (targetError) {
    return partialResponse(targetError, "تعذر حفظ نطاق الكود الجديد.");
  }

  const activationError = await activateIfRequested(
    auth.supabase,
    parsed.input.id,
    parsed.input.active,
  );

  if (activationError) {
    return partialResponse(activationError, "تعذر تفعيل الكود.");
  }

  return NextResponse.json({ success: true });
}
