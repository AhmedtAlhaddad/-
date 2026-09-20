import { NextResponse } from "next/server";

import {
  revalidatePublicCatalog,
} from "@/lib/supabase/revalidate-catalog";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set([
  "draft",
  "active",
  "archived",
]);

const ALLOWED_WEIGHT_UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "capsule",
  "tablet",
  "piece",
]);

function text(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function nullableText(
  value: unknown,
) {
  const result = text(value);

  return result.length > 0
    ? result
    : null;
}

function nullableNumber(
  value: unknown,
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : null;
}

function postgresMessage(
  code: string | undefined,
  fallback: string,
) {
  if (code === "23505") {
    return "يوجد Slug أو SKU مستخدم مسبقًا.";
  }

  if (code === "23503") {
    return "العلامة التجارية أو التصنيف المحدد غير صالح.";
  }

  if (code === "23514") {
    return "إحدى القيم لا تطابق شروط قاعدة البيانات.";
  }

  return fallback;
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
    body =
      await request.json();
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
          "بيانات المنتج غير صالحة.",
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

  const nameAr =
    text(payload.name_ar);

  const nameEn =
    nullableText(
      payload.name_en,
    );

  const slug =
    text(payload.slug)
      .toLowerCase();

  const brandId =
    text(payload.brand_id);

  const categoryId =
    text(payload.category_id);

  const shortDescriptionAr =
    text(
      payload.short_description_ar,
    );

  const fullDescriptionAr =
    nullableText(
      payload.full_description_ar,
    );

  const productType =
    text(
      payload.product_type,
    );

  const trainingGoal =
    nullableText(
      payload.training_goal,
    );

  const badgeLabelAr =
    nullableText(
      payload.badge_label_ar,
    );

  const requestedStatus =
    text(payload.status) ||
    "draft";

  const featured =
    payload.featured === true;

  if (!nameAr) {
    return NextResponse.json(
      {
        error:
          "اسم المنتج بالعربي مطلوب.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Slug يجب أن يكون أحرف إنجليزية صغيرة وأرقام وشرطات فقط، مثل gold-standard-whey.",
      },
      {
        status: 400,
      },
    );
  }

  if (!brandId) {
    return NextResponse.json(
      {
        error:
          "اختر العلامة التجارية.",
      },
      {
        status: 400,
      },
    );
  }

  if (!categoryId) {
    return NextResponse.json(
      {
        error:
          "اختر التصنيف.",
      },
      {
        status: 400,
      },
    );
  }

  if (!productType) {
    return NextResponse.json(
      {
        error:
          "نوع المنتج مطلوب.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !shortDescriptionAr
  ) {
    return NextResponse.json(
      {
        error:
          "الوصف المختصر مطلوب.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !ALLOWED_STATUSES.has(
      requestedStatus,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "حالة المنتج غير صالحة.",
      },
      {
        status: 400,
      },
    );
  }

  const rawHighlights =
    Array.isArray(
      payload.highlights,
    )
      ? payload.highlights
      : [];

  const highlights =
    rawHighlights
      .map((item) =>
        text(item),
      )
      .filter(Boolean);

  const rawVariants =
    Array.isArray(
      payload.variants,
    )
      ? payload.variants
      : [];

  if (
    rawVariants.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "يجب إضافة Variant واحد على الأقل.",
      },
      {
        status: 400,
      },
    );
  }

  const normalizedVariants: Array<{
    sku: string;
    flavor_ar: string | null;
    flavor_en: string | null;
    weight_value: number | null;
    weight_unit: string | null;
    size_label_ar: string | null;
    size_label_en: string | null;
    servings: number | null;
    attributes: Record<
      string,
      string
    >;
    price: number;
    compare_at_price:
      | number
      | null;
    stock_quantity: number;
    active: boolean;
    sort_order: number;
  }> = [];

  const seenSkus =
    new Set<string>();

  for (
    let index = 0;
    index <
    rawVariants.length;
    index += 1
  ) {
    const rawVariant =
      rawVariants[index];

    if (
      !rawVariant ||
      typeof rawVariant !==
        "object" ||
      Array.isArray(rawVariant)
    ) {
      return NextResponse.json(
        {
          error:
            `Variant رقم ${index + 1} غير صالح.`,
        },
        {
          status: 400,
        },
      );
    }

    const variant =
      rawVariant as Record<
        string,
        unknown
      >;

    const sku =
      text(variant.sku)
        .toUpperCase();

    if (!sku) {
      return NextResponse.json(
        {
          error:
            `SKU مطلوب في Variant رقم ${index + 1}.`,
        },
        {
          status: 400,
        },
      );
    }

    if (
      seenSkus.has(sku)
    ) {
      return NextResponse.json(
        {
          error:
            `SKU ${sku} مكرر داخل النموذج.`,
        },
        {
          status: 400,
        },
      );
    }

    seenSkus.add(sku);

    const price =
      Number(variant.price);

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      return NextResponse.json(
        {
          error:
            `السعر في Variant رقم ${index + 1} غير صالح.`,
        },
        {
          status: 400,
        },
      );
    }

    const compareAtPrice =
      nullableNumber(
        variant.compare_at_price,
      );

    if (
      compareAtPrice !== null &&
      compareAtPrice < price
    ) {
      return NextResponse.json(
        {
          error:
            `السعر السابق في Variant رقم ${index + 1} يجب أن يكون أكبر من أو يساوي السعر الحالي.`,
        },
        {
          status: 400,
        },
      );
    }

    const stockQuantity =
      Number(
        variant.stock_quantity,
      );

    if (
      !Number.isInteger(
        stockQuantity,
      ) ||
      stockQuantity < 0
    ) {
      return NextResponse.json(
        {
          error:
            `المخزون في Variant رقم ${index + 1} يجب أن يكون عددًا صحيحًا غير سالب.`,
        },
        {
          status: 400,
        },
      );
    }

    const weightValue =
      nullableNumber(
        variant.weight_value,
      );

    const weightUnit =
      nullableText(
        variant.weight_unit,
      );

    if (
      (weightValue === null) !==
      (weightUnit === null)
    ) {
      return NextResponse.json(
        {
          error:
            `في Variant رقم ${index + 1}: الوزن والوحدة يجب تعبئتهما معًا أو تركهما معًا فارغين.`,
        },
        {
          status: 400,
        },
      );
    }

    if (
      weightValue !== null &&
      weightValue <= 0
    ) {
      return NextResponse.json(
        {
          error:
            `الوزن في Variant رقم ${index + 1} يجب أن يكون أكبر من صفر.`,
        },
        {
          status: 400,
        },
      );
    }

    if (
      weightUnit !== null &&
      !ALLOWED_WEIGHT_UNITS.has(
        weightUnit,
      )
    ) {
      return NextResponse.json(
        {
          error:
            `وحدة الوزن في Variant رقم ${index + 1} غير صالحة.`,
        },
        {
          status: 400,
        },
      );
    }

    const servings =
      nullableNumber(
        variant.servings,
      );

    if (
      servings !== null &&
      (
        !Number.isInteger(
          servings,
        ) ||
        servings <= 0
      )
    ) {
      return NextResponse.json(
        {
          error:
            `عدد الحصص في Variant رقم ${index + 1} يجب أن يكون عددًا صحيحًا أكبر من صفر.`,
        },
        {
          status: 400,
        },
      );
    }

    const colorAr =
      nullableText(
        variant.color_ar,
      );

    const colorEn =
      nullableText(
        variant.color_en,
      );

    const attributes: Record<
      string,
      string
    > = {};

    if (colorAr) {
      attributes.color_ar =
        colorAr;
    }

    if (colorEn) {
      attributes.color_en =
        colorEn;
    }

    normalizedVariants.push({
      sku,

      flavor_ar:
        nullableText(
          variant.flavor_ar,
        ),

      flavor_en:
        nullableText(
          variant.flavor_en,
        ),

      weight_value:
        weightValue,

      weight_unit:
        weightUnit,

      size_label_ar:
        nullableText(
          variant.size_label_ar,
        ),

      size_label_en:
        nullableText(
          variant.size_label_en,
        ),

      servings,

      attributes,

      price,

      compare_at_price:
        compareAtPrice,

      stock_quantity:
        stockQuantity,

      active:
        variant.active !== false,

      sort_order:
        index + 1,
    });
  }

  /*
   * ننشئ المنتج كمسودة أولًا.
   * بهذا لو فشل إنشاء الـVariants
   * لن يظهر منتج ناقص للزبائن.
   */
  const {
    data: product,
    error: productError,
  } =
    await supabase
      .from("products")
      .insert({
        slug,
        name_ar: nameAr,
        name_en: nameEn,

        short_description_ar:
          shortDescriptionAr,

        full_description_ar:
          fullDescriptionAr,

        brand_id:
          brandId,

        category_id:
          categoryId,

        product_type:
          productType,

        training_goal:
          trainingGoal,

        highlights,

        badge_label_ar:
          badgeLabelAr,

        status:
          "draft",

        featured,
      })
      .select(
        "id, slug",
      )
      .single();

  if (
    productError ||
    !product
  ) {
    return NextResponse.json(
      {
        error:
          postgresMessage(
            productError?.code,
            productError?.message ??
              "تعذر إنشاء المنتج.",
          ),
      },
      {
        status: 400,
      },
    );
  }

  const variantRows =
    normalizedVariants.map(
      (variant) => ({
        product_id:
          product.id,

        ...variant,

        stock_quantity: 0,
      }),
    );

  const {
    data: createdVariants,
    error: variantsError,
  } =
    await supabase
      .from(
        "product_variants",
      )
      .insert(
        variantRows,
      )
      .select("id, sku");

  if (
    variantsError ||
    !createdVariants ||
    createdVariants.length !==
      normalizedVariants.length
  ) {
    /*
     * محاولة تنظيف المنتج
     * في حال فشل إنشاء الـVariants.
     */
    await supabase
      .from("products")
      .delete()
      .eq(
        "id",
        product.id,
      );

    return NextResponse.json(
      {
        error:
          postgresMessage(
            variantsError?.code,
            variantsError?.message ??
              "تعذر إنشاء خيارات المنتج.",
          ),
      },
      {
        status: 400,
      },
    );
  }

  for (
    const createdVariant of
    createdVariants ?? []
  ) {
    const requestedStock =
      normalizedVariants.find(
        (variant) =>
          variant.sku ===
          createdVariant.sku,
      )?.stock_quantity ?? 0;

    if (requestedStock === 0) {
      continue;
    }

    const {
      error: inventoryError,
    } =
      await supabase.rpc(
        "adjust_inventory",
        {
          p_variant_id:
            createdVariant.id,

          p_quantity_change:
            requestedStock,

          p_reason:
            "restock",

          p_note:
            "Initial stock during product creation",
        },
      );

    if (inventoryError) {
      return NextResponse.json(
        {
          error:
            "تم إنشاء المنتج كمسودة، لكن تعذر تسجيل المخزون الابتدائي بأمان. راجع المخزون قبل تفعيل المنتج.",

          productId:
            product.id,
        },
        {
          status: 500,
        },
      );
    }
  }

  const {
    error: statusError,
  } =
    await supabase
      .from("products")
      .update({
        status:
          requestedStatus,
      })
      .eq(
        "id",
        product.id,
      );

  if (statusError) {
    /*
     * المنتج سيبقى Draft لو
     * تعذر تغيير الحالة النهائية.
     */
    return NextResponse.json(
      {
        error:
          "تم إنشاء المنتج والـVariants، لكن تعذر تحديث حالة المنتج النهائية. المنتج محفوظ كمسودة.",
        productId:
          product.id,
      },
      {
        status: 500,
      },
    );
  }

  revalidatePublicCatalog(
    product.slug,
  );

  return NextResponse.json(
    {
      success: true,

      product: {
        id:
          product.id,

        slug:
          product.slug,
      },
    },
    {
      status: 201,
    },
  );
}
