import type { Metadata } from "next";

import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إضافة منتج",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const { supabase } =
    await requireAdmin();

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
      brands={brandsResult.data ?? []}
      categories={
        categoriesResult.data ?? []
      }
    />
  );
}
