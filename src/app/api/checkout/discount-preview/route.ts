import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type PreviewItem = {
  variant_id: string;
  quantity: number;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function previewError(code: string | undefined, message: string) {
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
      message: "إحدى الكميات لم تعد متوفرة. حدّث السلة وحاول مجددًا.",
    };
  }

  if (normalized.includes("is unavailable")) {
    return {
      status: 409,
      message: "أحد خيارات المنتجات لم يعد متاحًا. حدّث السلة وحاول مجددًا.",
    };
  }

  if (code === "22023") {
    return {
      status: 400,
      message: "بيانات كود الخصم أو السلة غير صالحة.",
    };
  }

  return {
    status: 400,
    message: "تعذر التحقق من كود الخصم حاليًا. حاول مجددًا.",
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("بيانات كود الخصم غير صالحة.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("بيانات كود الخصم غير صالحة.");
  }

  const payload = body as Record<string, unknown>;
  const code = text(payload.code).toUpperCase();
  const rawItems = payload.items;

  if (!code || !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    return errorResponse("صيغة كود الخصم غير صالحة.");
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
    return errorResponse("السلة فارغة أو تحتوي على عدد عناصر غير صالح.");
  }

  const items: PreviewItem[] = [];

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

    items.push({ variant_id: variantId, quantity });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_discount", {
    p_items: items,
    p_code: code,
  });

  if (error) {
    const result = previewError(error.code, error.message);
    return errorResponse(result.message, result.status);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return errorResponse("تعذر قراءة معاينة الخصم من الخادم.", 500);
  }

  return NextResponse.json({
    success: true,
    preview: data,
  });
}
