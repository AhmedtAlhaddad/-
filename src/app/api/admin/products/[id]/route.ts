import { NextResponse } from "next/server";

import {
  revalidatePublicCatalog,
} from "@/lib/supabase/revalidate-catalog";

import { createClient } from "@/lib/supabase/server";

const STATUSES =
  new Set([
    "draft",
    "active",
    "archived",
  ]);

const UNITS =
  new Set([
    "g",
    "kg",
    "ml",
    "l",
    "capsule",
    "tablet",
    "piece",
  ]);

type NormalizedVariant = {
  id: string | null;
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
    unknown
  >;
  price: number;
  compare_at_price:
    | number
    | null;
  stock_quantity: number;
  active: boolean;
  sort_order: number;
};

function text(
  value: unknown,
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function nullableText(
  value: unknown,
) {
  const result =
    text(value);

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

  const result =
    Number(value);

  return Number.isFinite(
    result,
  )
    ? result
    : null;
}

function errorResponse(
  error: string,
  status = 400,
) {
  return NextResponse.json(
    {
      error,
    },
    {
      status,
    },
  );
}

function postgresMessage(
  code: string | undefined,
  fallback: string,
) {
  if (
    code === "23505"
  ) {
    return "يوجد Slug أو SKU مستخدم مسبقًا.";
  }

  if (
    code === "23503"
  ) {
    return "إحدى العلاقات المحددة غير صالحة.";
  }

  if (
    code === "23514"
  ) {
    return "إحدى القيم لا تطابق شروط قاعدة البيانات.";
  }

  return fallback;
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const {
    id,
  } =
    await context.params;

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
    return errorResponse(
      "يجب تسجيل الدخول أولًا.",
      401,
    );
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select(
        "role, active",
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.role !==
      "admin" ||
    profile.active !== true
  ) {
    return errorResponse(
      "ليس لديك صلاحية الإدارة.",
      403,
    );
  }

  const {
    data: existingProduct,
    error: productLookupError,
  } =
    await supabase
      .from("products")
      .select("id")
      .eq(
        "id",
        id,
      )
      .maybeSingle();

  if (
    productLookupError
  ) {
    return errorResponse(
      productLookupError.message,
      500,
    );
  }

  if (
    !existingProduct
  ) {
    return errorResponse(
      "المنتج غير موجود.",
      404,
    );
  }

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return errorResponse(
      "بيانات الطلب غير صالحة.",
    );
  }

  if (
    !body ||
    typeof body !==
      "object" ||
    Array.isArray(body)
  ) {
    return errorResponse(
      "بيانات المنتج غير صالحة.",
    );
  }

  const payload =
    body as Record<
      string,
      unknown
    >;

  const nameAr =
    text(
      payload.name_ar,
    );

  const slug =
    text(
      payload.slug,
    ).toLowerCase();

  const brandId =
    text(
      payload.brand_id,
    );

  const categoryId =
    text(
      payload.category_id,
    );

  const shortDescription =
    text(
      payload.short_description_ar,
    );

  const productType =
    text(
      payload.product_type,
    );

  const status =
    text(
      payload.status,
    );

  if (!nameAr) {
    return errorResponse(
      "اسم المنتج مطلوب.",
    );
  }

  if (
    !slug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug,
    )
  ) {
    return errorResponse(
      "Slug غير صالح.",
    );
  }

  if (
    !brandId ||
    !categoryId
  ) {
    return errorResponse(
      "العلامة والتصنيف مطلوبان.",
    );
  }

  if (
    !shortDescription ||
    !productType
  ) {
    return errorResponse(
      "الوصف المختصر ونوع المنتج مطلوبان.",
    );
  }

  if (
    !STATUSES.has(
      status,
    )
  ) {
    return errorResponse(
      "حالة المنتج غير صالحة.",
    );
  }

  const rawVariants =
    Array.isArray(
      payload.variants,
    )
      ? payload.variants
      : [];

  if (
    rawVariants.length ===
    0
  ) {
    return errorResponse(
      "يجب وجود Variant واحد على الأقل.",
    );
  }

  const {
    data: existingVariants,
    error: existingVariantsError,
  } =
    await supabase
      .from(
        "product_variants",
      )
      .select("id")
      .eq(
        "product_id",
        id,
      );

  if (
    existingVariantsError
  ) {
    return errorResponse(
      existingVariantsError.message,
      500,
    );
  }

  const allowedIds =
    new Set(
      (
        existingVariants ??
        []
      ).map(
        (variant) =>
          variant.id,
      ),
    );

  const seenSkus =
    new Set<string>();

  const normalized:
    NormalizedVariant[] =
      [];

  for (
    let index = 0;
    index <
    rawVariants.length;
    index += 1
  ) {
    const raw =
      rawVariants[index];

    if (
      !raw ||
      typeof raw !==
        "object" ||
      Array.isArray(raw)
    ) {
      return errorResponse(
        `Variant رقم ${index + 1} غير صالح.`,
      );
    }

    const variant =
      raw as Record<
        string,
        unknown
      >;

    const variantId =
      nullableText(
        variant.id,
      );

    if (
      variantId &&
      !allowedIds.has(
        variantId,
      )
    ) {
      return errorResponse(
        "أحد الـVariants لا يتبع هذا المنتج.",
      );
    }

    const sku =
      text(
        variant.sku,
      ).toUpperCase();

    if (!sku) {
      return errorResponse(
        `SKU مطلوب في Variant رقم ${index + 1}.`,
      );
    }

    if (
      seenSkus.has(sku)
    ) {
      return errorResponse(
        `SKU ${sku} مكرر داخل المنتج.`,
      );
    }

    seenSkus.add(sku);

    const price =
      Number(
        variant.price,
      );

    if (
      !Number.isFinite(
        price,
      ) ||
      price < 0
    ) {
      return errorResponse(
        `السعر في Variant رقم ${index + 1} غير صالح.`,
      );
    }

    const compareAtPrice =
      nullableNumber(
        variant.compare_at_price,
      );

    if (
      compareAtPrice !==
        null &&
      compareAtPrice < price
    ) {
      return errorResponse(
        `السعر السابق في Variant رقم ${index + 1} يجب أن يكون أكبر من أو يساوي السعر الحالي.`,
      );
    }

    const stock =
      Number(
        variant.stock_quantity,
      );

    if (
      !Number.isInteger(
        stock,
      ) ||
      stock < 0
    ) {
      return errorResponse(
        `المخزون في Variant رقم ${index + 1} غير صالح.`,
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
      (weightValue ===
        null) !==
      (weightUnit ===
        null)
    ) {
      return errorResponse(
        `الوزن والوحدة في Variant رقم ${index + 1} يجب تعبئتهما معًا.`,
      );
    }

    if (
      weightValue !== null &&
      weightValue <= 0
    ) {
      return errorResponse(
        `الوزن في Variant رقم ${index + 1} يجب أن يكون أكبر من صفر.`,
      );
    }

    if (
      weightUnit &&
      !UNITS.has(
        weightUnit,
      )
    ) {
      return errorResponse(
        `وحدة الوزن في Variant رقم ${index + 1} غير صالحة.`,
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
      return errorResponse(
        `عدد الحصص في Variant رقم ${index + 1} غير صالح.`,
      );
    }

    let attributes:
      Record<
        string,
        unknown
      > = {};

    if (
      variant.attributes &&
      typeof variant.attributes ===
        "object" &&
      !Array.isArray(
        variant.attributes,
      )
    ) {
      attributes = {
        ...(
          variant.attributes as Record<
            string,
            unknown
          >
        ),
      };
    }

    const colorAr =
      nullableText(
        variant.color_ar,
      );

    const colorEn =
      nullableText(
        variant.color_en,
      );

    if (colorAr) {
      attributes.color_ar =
        colorAr;
    } else {
      delete attributes.color_ar;
    }

    if (colorEn) {
      attributes.color_en =
        colorEn;
    } else {
      delete attributes.color_en;
    }

    normalized.push({
      id:
        variantId,

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
        stock,

      active:
        variant.active !==
        false,

      sort_order:
        index + 1,
    });
  }

  /*
   * Check slug before writing.
   */
  const {
    data: slugOwner,
    error: slugCheckError,
  } =
    await supabase
      .from("products")
      .select("id")
      .eq(
        "slug",
        slug,
      )
      .neq(
        "id",
        id,
      )
      .maybeSingle();

  if (
    slugCheckError
  ) {
    return errorResponse(
      slugCheckError.message,
      500,
    );
  }

  if (slugOwner) {
    return errorResponse(
      "Slug مستخدم في منتج آخر.",
    );
  }

  /*
   * Check SKUs before writing.
   */
  const skus =
    normalized.map(
      (variant) =>
        variant.sku,
    );

  if (
    skus.length > 0
  ) {
    const {
      data: skuOwners,
      error: skuCheckError,
    } =
      await supabase
        .from(
          "product_variants",
        )
        .select(
          "id, product_id, sku",
        )
        .in(
          "sku",
          skus,
        );

    if (
      skuCheckError
    ) {
      return errorResponse(
        skuCheckError.message,
        500,
      );
    }

    const conflict =
      (
        skuOwners ??
        []
      ).find(
        (owner) => {
          const incoming =
            normalized.find(
              (variant) =>
                variant.sku ===
                owner.sku,
            );

          if (!incoming) {
            return false;
          }

          if (
            incoming.id &&
            incoming.id ===
              owner.id
          ) {
            return false;
          }

          return true;
        },
      );

    if (conflict) {
      return errorResponse(
        `SKU ${conflict.sku} مستخدم مسبقًا.`,
      );
    }
  }

  const {
    error: productError,
  } =
    await supabase
      .from("products")
      .update({
        slug,

        name_ar:
          nameAr,

        name_en:
          nullableText(
            payload.name_en,
          ),

        short_description_ar:
          shortDescription,

        full_description_ar:
          nullableText(
            payload.full_description_ar,
          ),

        brand_id:
          brandId,

        category_id:
          categoryId,

        product_type:
          productType,

        training_goal:
          nullableText(
            payload.training_goal,
          ),

        badge_label_ar:
          nullableText(
            payload.badge_label_ar,
          ),

        highlights:
          Array.isArray(
            payload.highlights,
          )
            ? payload.highlights
                .map(
                  (item) =>
                    text(item),
                )
                .filter(
                  Boolean,
                )
            : [],

        status,

        featured:
          payload.featured ===
          true,
      })
      .eq(
        "id",
        id,
      );

  if (
    productError
  ) {
    return errorResponse(
      postgresMessage(
        productError.code,
        productError.message,
      ),
    );
  }

  for (
    const variant of
    normalized
  ) {
    const {
      id: variantId,
      ...values
    } = variant;

    if (variantId) {
      const {
        error,
      } =
        await supabase
          .from(
            "product_variants",
          )
          .update(
            values,
          )
          .eq(
            "id",
            variantId,
          )
          .eq(
            "product_id",
            id,
          );

      if (error) {
        return errorResponse(
          postgresMessage(
            error.code,
            error.message,
          ),
        );
      }
    } else {
      const {
        error,
      } =
        await supabase
          .from(
            "product_variants",
          )
          .insert({
            product_id:
              id,

            ...values,
          });

      if (error) {
        return errorResponse(
          postgresMessage(
            error.code,
            error.message,
          ),
        );
      }
    }
  }

  revalidatePublicCatalog();

  return NextResponse.json({
    success: true,
  });
}