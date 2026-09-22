import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "تعديل المنتج",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic =
  "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeAttributes(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

export default async function Page({
  params,
}: Props) {
  const { id } =
    await params;

  const {
    supabase,
  } =
    await requireAdmin();

  const [
    productResult,
    variantsResult,
    imagesResult,
    brandsResult,
    categoriesResult,
    goalsResult,
  ] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, slug, name_ar, name_en, short_description_ar, full_description_ar, nutrition_facts, usage_instructions, brand_id, category_id, product_type, highlights, badge_label_ar, status, featured",
        )
        .eq(
          "id",
          id,
        )
        .maybeSingle(),

      supabase
        .from(
          "product_variants",
        )
        .select(
          "id, sku, flavor_ar, flavor_en, weight_value, weight_unit, size_label_ar, size_label_en, servings, attributes, price, compare_at_price, stock_quantity, active, sort_order",
        )
        .eq(
          "product_id",
          id,
        )
        .order(
          "sort_order",
          {
            ascending: true,
          },
        ),

      supabase
        .from(
          "product_images",
        )
        .select(
          "id, product_id, variant_id, storage_path, external_url, alt_text_ar, alt_text_en, sort_order, is_primary",
        )
        .eq(
          "product_id",
          id,
        )
        .order(
          "sort_order",
          {
            ascending: true,
          },
        ),

      supabase
        .from("brands")
        .select(
          "id, slug, name_ar, name_en",
        )
        .order(
          "sort_order",
          {
            ascending: true,
          },
        ),

      supabase
        .from("categories")
        .select(
          "id, slug, name_ar, name_en",
        )
        .eq("active", true)
        .order(
          "sort_order",
          {
            ascending: true,
          },
        ),

      supabase
        .from("product_training_goals")
        .select("goal")
        .eq("product_id", id)
        .order("goal", {
          ascending: true,
        }),
    ]);

  if (
    productResult.error ||
    !productResult.data
  ) {
    notFound();
  }

  if (productResult.data.status === "archived") {
    notFound();
  }

  if (
    variantsResult.error
  ) {
    throw new Error(
      variantsResult.error.message,
    );
  }

  if (
    imagesResult.error
  ) {
    throw new Error(
      imagesResult.error.message,
    );
  }

  if (
    brandsResult.error
  ) {
    throw new Error(
      brandsResult.error.message,
    );
  }

  if (
    categoriesResult.error
  ) {
    throw new Error(
      categoriesResult.error.message,
    );
  }

  if (goalsResult.error) {
    throw new Error(
      goalsResult.error.message,
    );
  }

  const product =
    productResult.data;

  const highlights =
    Array.isArray(
      product.highlights,
    )
      ? product.highlights.filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string",
        )
      : [];

  const variants =
    (
      variantsResult.data ??
      []
    ).map(
      (variant) => ({
        ...variant,

        attributes:
          normalizeAttributes(
            variant.attributes,
          ),
      }),
    );

  const mediaVariants =
    variants.map(
      (variant) => ({
        id:
          variant.id,

        sku:
          variant.sku,

        flavor_ar:
          variant.flavor_ar,

        weight_value:
          variant.weight_value,

        weight_unit:
          variant.weight_unit,

        size_label_ar:
          variant.size_label_ar,
      }),
    );

  const images =
    imagesResult.data ??
    [];

  const imageManagerKey =
    images.length === 0
      ? "no-images"
      : images
          .map(
            (image) =>
              [
                image.id,
                image.variant_id ??
                  "",
                image.storage_path ??
                  "",
                image.external_url ??
                  "",
                image.alt_text_ar ??
                  "",
                image.alt_text_en ??
                  "",
                String(
                  image.sort_order,
                ),
                image.is_primary
                  ? "1"
                  : "0",
              ].join("~"),
          )
          .join("|");

  return (
    <ProductForm
      mode="edit"
      productId={id}
      brands={
        brandsResult.data ??
        []
      }
      categories={
        categoriesResult.data ??
        []
      }
      initialData={{
        name_ar:
          product.name_ar,

        name_en:
          product.name_en,

        slug:
          product.slug,

        brand_id:
          product.brand_id,

        category_id:
          product.category_id,

        short_description_ar:
          product.short_description_ar,

        full_description_ar:
          product.full_description_ar,

        nutrition_facts:
          product.nutrition_facts,

        usage_instructions:
          product.usage_instructions,

        product_type:
          product.product_type,

        training_goals:
          (goalsResult.data ?? []).map(
            (goal) => goal.goal,
          ),

        badge_label_ar:
          product.badge_label_ar,

        highlights,

        status:
          product.status,

        featured:
          product.featured,

        variants,
      }}
    >
      <ProductImageManager
        key={
          imageManagerKey
        }
        productId={id}
        productName={
          product.name_ar
        }
        variants={
          mediaVariants
        }
        images={
          images
        }
      />
    </ProductForm>
  );
}
