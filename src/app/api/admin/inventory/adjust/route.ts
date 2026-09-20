import { NextResponse } from "next/server";

import {
  revalidatePublicCatalog,
} from "@/lib/supabase/revalidate-catalog";

import {
  createClient,
} from "@/lib/supabase/server";

const ALLOWED_REASONS = new Set([
  "restock",
  "manual_adjustment",
  "correction",
]);

function text(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function inventoryError(
  code: string | undefined,
  message: string,
) {
  if (code === "42501") {
    return {
      status: 403,
      message: "ليس لديك صلاحية تعديل المخزون.",
    };
  }

  if (code === "22023") {
    return {
      status: 400,
      message: "بيانات تعديل المخزون غير صالحة.",
    };
  }

  if (
    message
      .toLowerCase()
      .includes("negative")
  ) {
    return {
      status: 400,
      message:
        "لا يمكن أن يصبح المخزون أقل من صفر.",
    };
  }

  if (
    message
      .toLowerCase()
      .includes("variant not found")
  ) {
    return {
      status: 404,
      message:
        "لم يتم العثور على الـVariant.",
    };
  }

  return {
    status: 400,
    message:
      "تعذر تحديث المخزون.",
  };
}

export async function POST(
  request: Request,
) {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const userId =
    claimsData?.claims?.sub;

  if (
    claimsError ||
    !userId
  ) {
    return NextResponse.json(
      {
        error:
          "يجب تسجيل الدخول أولًا.",
      },
      {
        status: 401,
      },
    );
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role, active")
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.active !== true
  ) {
    return NextResponse.json(
      {
        error:
          "ليس لديك صلاحية الإدارة.",
      },
      {
        status: 403,
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "بيانات الطلب غير صالحة.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      {
        error:
          "بيانات الطلب غير صالحة.",
      },
      {
        status: 400,
      },
    );
  }

  const payload =
    body as Record<
      string,
      unknown
    >;

  const variantId =
    text(
      payload.variant_id,
    );

  const reason =
    text(
      payload.reason,
    );

  const note =
    text(
      payload.note,
    );

  const quantityChange =
    Number(
      payload.quantity_change,
    );

  if (
    !variantId ||
    !isUuid(variantId)
  ) {
    return NextResponse.json(
      {
        error:
          "معرّف الـVariant غير صالح.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !Number.isInteger(
      quantityChange,
    ) ||
    quantityChange === 0 ||
    Math.abs(
      quantityChange,
    ) > 100000
  ) {
    return NextResponse.json(
      {
        error:
          "كمية التعديل يجب أن تكون عددًا صحيحًا غير صفري.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !ALLOWED_REASONS.has(
      reason,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "سبب تعديل المخزون غير صالح.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    note.length > 500
  ) {
    return NextResponse.json(
      {
        error:
          "ملاحظة المخزون طويلة جدًا.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "adjust_inventory",
      {
        p_variant_id:
          variantId,

        p_quantity_change:
          quantityChange,

        p_reason:
          reason,

        p_note:
          note || null,
      },
    );

  if (error) {
    const result =
      inventoryError(
        error.code,
        error.message,
      );

    return NextResponse.json(
      {
        error:
          result.message,
      },
      {
        status:
          result.status,
      },
    );
  }

  if (
    data === null ||
    data === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "تم تنفيذ الطلب بدون إرجاع رصيد المخزون الجديد.",
      },
      {
        status: 500,
      },
    );
  }

  let warning: string | null =
    null;

  try {
    await revalidatePublicCatalog();
  } catch (error) {
    console.error(
      "Inventory updated but catalog revalidation failed:",
      error,
    );

    warning =
      "تم تحديث المخزون، لكن تعذر تحديث كاش المتجر فورًا.";
  }

  return NextResponse.json({
    success: true,
    stock_quantity:
      Number(data),
    warning,
  });
}