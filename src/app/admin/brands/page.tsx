import type {
  Metadata,
} from "next";

import {
  CatalogTaxonomyManager,
} from "@/components/admin/catalog-taxonomy-manager";

import {
  requireAdmin,
} from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title:
    "إدارة العلامات التجارية",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic =
  "force-dynamic";

type BrandRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en:
    | string
    | null;
  logo_path:
    | string
    | null;
  active: boolean;
  sort_order: number;
  updated_at: string;
};

type ProductRow = {
  brand_id: string;
};

export default async function Page() {
  const {
    supabase,
  } =
    await requireAdmin("/admin/brands");

  const [
    brandsResult,
    productsResult,
  ] =
    await Promise.all([
      supabase
        .from("brands")
        .select(
          "id, slug, name_ar, name_en, logo_path, active, sort_order, updated_at",
        )
        .order(
          "sort_order",
          {
            ascending: true,
          },
        )
        .order(
          "name_ar",
          {
            ascending: true,
          },
        ),

      supabase
        .from("products")
        .select(
          "brand_id",
        ),
    ]);

  if (
    brandsResult.error
  ) {
    throw new Error(
      brandsResult
        .error
        .message,
    );
  }

  if (
    productsResult.error
  ) {
    throw new Error(
      productsResult
        .error
        .message,
    );
  }

  const brands =
    (
      brandsResult.data ??
      []
    ) as BrandRow[];

  const products =
    (
      productsResult.data ??
      []
    ) as ProductRow[];

  const counts =
    new Map<
      string,
      number
    >();

  for (
    const product of products
  ) {
    counts.set(
      product.brand_id,
      (
        counts.get(
          product.brand_id,
        ) ?? 0
      ) + 1,
    );
  }

  const items =
    brands.map(
      (brand) => ({
        ...brand,

        product_count:
          counts.get(
            brand.id,
          ) ?? 0,
      }),
    );

  return (
    <CatalogTaxonomyManager
      kind="brands"
      items={items}
    />
  );
}
