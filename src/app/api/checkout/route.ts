import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type CheckoutItem = {
  variant_id: string;
  quantity: number;
};

type SubmitOrderResult = {
  order_id: string;
  order_number: number | string;
  currency: string;
  subtotal: number;
  code_qualifying_subtotal: number;
  discount_amount: number;
  total: number;
};

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

function checkoutError(code: string | undefined, message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("discount or athlete code is invalid") ||
    normalized.includes("has no configured")
  ) {
    return {
      status: 400,
      message:
        "كود الخصم غير صالح أو غير نشط أو انتهت صلاحيته أو استُنفد حد استخدامه.",
    };
  }

  if (normalized.includes("code does not apply")) {
    return {
      status: 400,
      message: "كود الخصم لا ينطبق على أي منتج في السلة.",
    };
  }

  if (normalized.includes("qualifying subtotal is below")) {
    return {
      status: 400,
      message: "المجموع المؤهل أقل من الحد الأدنى المطلوب لهذا الكود.",
    };
  }

  if (normalized.includes("insufficient stock")) {
    return {
      status: 409,
      message:
        "الكمية المطلوبة لم تعد متوفرة. ارجع إلى السلة وحدّث الكميات.",
    };
  }

  if (
    normalized.includes("is unavailable") ||
    normalized.includes("invalid input syntax for type uuid")
  ) {
    return {
      status: 409,
      message:
        "أحد خيارات المنتجات لم يعد متاحًا. ارجع إلى السلة واختر خيارًا متوفرًا.",
    };
  }

  if (code === "22023") {
    return {
      status: 400,
      message: "بيانات العميل أو عناصر الطلب غير مكتملة.",
    };
  }

  return {
    status: 400,
    message: "تعذر تأكيد الطلب. لم يتم تفريغ السلة، ويمكنك المحاولة مجددًا.",
  };
}

function parseResult(value: unknown): SubmitOrderResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const result = value as Record<string, unknown>;
  const orderId = text(result.order_id);
  const orderNumber = result.order_number;
  const currency = text(result.currency);
  const subtotal = Number(result.subtotal);
  const qualifyingSubtotal = Number(result.code_qualifying_subtotal);
  const discountAmount = Number(result.discount_amount);
  const total = Number(result.total);

  if (
    !isUuid(orderId) ||
    (typeof orderNumber !== "string" && typeof orderNumber !== "number") ||
    !currency ||
    !Number.isFinite(subtotal) ||
    !Number.isFinite(qualifyingSubtotal) ||
    !Number.isFinite(discountAmount) ||
    !Number.isFinite(total)
  ) {
    return null;
  }

  return {
    order_id: orderId,
    order_number: orderNumber,
    currency,
    subtotal,
    code_qualifying_subtotal: qualifyingSubtotal,
    discount_amount: discountAmount,
    total,
  };
}

export async function POST(request: Request) {
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
  const customerFullName = text(payload.customer_full_name);
  const customerPhone = text(payload.customer_phone);
  const customerCity = text(payload.customer_city);
  const customerAddress = text(payload.customer_address);
  const customerNotes = optionalText(payload.customer_notes);
  const code = text(payload.code).toUpperCase() || null;
  const rawItems = payload.items;

  if (customerFullName.length < 2 || customerFullName.length > 160) {
    return errorResponse("الاسم الكامل مطلوب ويجب ألا يتجاوز 160 حرفًا.");
  }

  if (customerPhone.length < 6 || customerPhone.length > 32) {
    return errorResponse("رقم الهاتف مطلوب ويجب أن يتكون من 6 إلى 32 حرفًا.");
  }

  if (customerCity.length < 2 || customerCity.length > 120) {
    return errorResponse("المدينة مطلوبة ويجب ألا تتجاوز 120 حرفًا.");
  }

  if (customerAddress.length < 5 || customerAddress.length > 500) {
    return errorResponse("العنوان مطلوب ويجب أن يتكون من 5 إلى 500 حرف.");
  }

  if (customerNotes && customerNotes.length > 2000) {
    return errorResponse("ملاحظات الطلب طويلة جدًا.");
  }

  if (code && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    return errorResponse("صيغة كود الخصم غير صالحة.");
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
    return errorResponse("السلة فارغة أو تحتوي على عدد عناصر غير صالح.");
  }

  const items: CheckoutItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return errorResponse("أحد عناصر السلة غير صالح.");
    }

    const item = rawItem as Record<string, unknown>;
    const variantId = text(item.variant_id);
    const quantity = Number(item.quantity);

    if (
      !isUuid(variantId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    ) {
      return errorResponse("أحد خيارات المنتجات أو كمياته غير صالح.");
    }

    items.push({
      variant_id: variantId,
      quantity,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_order", {
    p_customer_full_name: customerFullName,
    p_customer_phone: customerPhone,
    p_customer_city: customerCity,
    p_customer_address: customerAddress,
    p_items: items,
    p_customer_notes: customerNotes,
    p_code: code,
  });

  if (error) {
    const result = checkoutError(error.code, error.message);
    return errorResponse(result.message, result.status);
  }

  const result = parseResult(data);

  if (!result) {
    return errorResponse(
      "تم تنفيذ الطلب دون إرجاع تأكيد صالح. تواصل مع المتجر قبل إعادة المحاولة.",
      500,
    );
  }

  return NextResponse.json({
    success: true,
    order: result,
  });
}
