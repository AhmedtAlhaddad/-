import type { Metadata } from "next";

import {
  ProductForm,
  type ProductKind,
} from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إضافة منتج",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedType = Array.isArray(params.type)
    ? params.type[0]
    : params.type;
  const createKind: ProductKind =
    requestedType === "apparel" || requestedType === "accessory"
      ? requestedType
      : "supplement";
  const { supabase } =
    await requireAdmin("/admin/products/new");

  const [
    brandsResult,
    categoriesResult,
  ] = await Promise.all([
    supabase
      .from("brands")
      .select(
        "id, slug, name_ar, name_en",
      )
      .eq("active", true)
      .order(
        "sort_order",
        { ascending: true },
      ),

    supabase
      .from("categories")
      .select(
        "id, slug, name_ar, name_en",
      )
      .eq("active", true)
      .order(
        "sort_order",
        { ascending: true },
      ),
  ]);

  if (brandsResult.error) {
    throw new Error(
      brandsResult.error.message,
    );
  }

  if (categoriesResult.error) {
    throw new Error(
      categoriesResult.error.message,
    );
  }

  return (
    <ProductForm
      mode="create"
      createKind={createKind}
      brands={brandsResult.data ?? []}
      categories={
        categoriesResult.data ?? []
      }
    />
  );
}
