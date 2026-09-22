import type { Metadata } from "next";

import {
  DiscountCodesManager,
  type AthleteOption,
  type CategoryOption,
  type DiscountCodeItem,
  type ProductOption,
} from "@/components/admin/discount-codes-manager";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "إدارة أكواد الخصم",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type DiscountRow = Omit<
  DiscountCodeItem,
  "category_ids" | "product_ids"
>;

type CategoryTargetRow = {
  discount_code_id: string;
  category_id: string;
};

type ProductTargetRow = {
  discount_code_id: string;
  product_id: string;
};

export default async function Page() {
  const { supabase } = await requireAdmin("/admin/discounts");

  const [
    discountsResult,
    categoryTargetsResult,
    productTargetsResult,
    athletesResult,
    categoriesResult,
    productsResult,
  ] = await Promise.all([
    supabase
      .from("discount_codes")
      .select(
        "id, code, active, customer_discount_percent, athlete_id, athlete_commission_percent, scope_type, starts_at, ends_at, usage_limit, redemption_count, minimum_subtotal, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: true }),
    supabase
      .from("discount_code_categories")
      .select("discount_code_id, category_id"),
    supabase
      .from("discount_code_products")
      .select("discount_code_id, product_id"),
    supabase
      .from("athletes")
      .select("id, display_name, active")
      .order("active", { ascending: false })
      .order("display_name", { ascending: true }),
    supabase
      .from("categories")
      .select("id, slug, name_ar, active")
      .order("active", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("name_ar", { ascending: true }),
    supabase
      .from("products")
      .select("id, slug, name_ar, status")
      .order("name_ar", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  const firstError = [
    discountsResult.error,
    categoryTargetsResult.error,
    productTargetsResult.error,
    athletesResult.error,
    categoriesResult.error,
    productsResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(firstError.message);
  }

  const categoryTargets = (
    categoryTargetsResult.data ?? []
  ) as CategoryTargetRow[];
  const productTargets = (
    productTargetsResult.data ?? []
  ) as ProductTargetRow[];

  const categoryIdsByCode = new Map<string, string[]>();
  const productIdsByCode = new Map<string, string[]>();

  for (const target of categoryTargets) {
    const ids = categoryIdsByCode.get(target.discount_code_id) ?? [];
    ids.push(target.category_id);
    categoryIdsByCode.set(target.discount_code_id, ids);
  }

  for (const target of productTargets) {
    const ids = productIdsByCode.get(target.discount_code_id) ?? [];
    ids.push(target.product_id);
    productIdsByCode.set(target.discount_code_id, ids);
  }

  const items = ((discountsResult.data ?? []) as DiscountRow[]).map(
    (item) => ({
      ...item,
      customer_discount_percent: Number(
        item.customer_discount_percent,
      ),
      athlete_commission_percent: Number(
        item.athlete_commission_percent,
      ),
      minimum_subtotal:
        item.minimum_subtotal === null
          ? null
          : Number(item.minimum_subtotal),
      category_ids: categoryIdsByCode.get(item.id) ?? [],
      product_ids: productIdsByCode.get(item.id) ?? [],
    }),
  );

  return (
    <DiscountCodesManager
      items={items}
      athletes={(athletesResult.data ?? []) as AthleteOption[]}
      categories={(categoriesResult.data ?? []) as CategoryOption[]}
      products={(productsResult.data ?? []) as ProductOption[]}
    />
  );
}
