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
    "إدارة التصنيفات",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic =
  "force-dynamic";

type CategoryRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en:
    | string
    | null;
  description_ar:
    | string
    | null;
  image_path:
    | string
    | null;
  active: boolean;
  sort_order: number;
  updated_at: string;
};

type ProductRow = {
  category_id: string;
};

export default async function Page() {
  const {
    supabase,
  } =
    await requireAdmin();

  const [
    categoriesResult,
    productsResult,
  ] =
    await Promise.all([
      supabase
        .from("categories")
        .select(
          "id, slug, name_ar, name_en, description_ar, image_path, active, sort_order, updated_at",
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
          "category_id",
        ),
    ]);

  if (
    categoriesResult.error
  ) {
    throw new Error(
      categoriesResult
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

  const categories =
    (
      categoriesResult.data ??
      []
    ) as CategoryRow[];

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
      product.category_id,
      (
        counts.get(
          product.category_id,
        ) ?? 0
      ) + 1,
    );
  }

  const items =
    categories.map(
      (category) => ({
        ...category,

        product_count:
          counts.get(
            category.id,
          ) ?? 0,
      }),
    );

  return (
    <CatalogTaxonomyManager
      kind="categories"
      items={items}
    />
  );
}