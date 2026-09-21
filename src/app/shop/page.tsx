import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StoreChrome } from "@/components/layout/footer";
import { ShopPage } from "@/components/shop/shop-page";

import {
  getCatalogPage,
  getCategories,
} from "@/lib/supabase/catalog-cache";

import {
  SHOP_PAGE_SIZE,
  areCategoryParamsCanonical,
  areGoalParamsCanonical,
  buildShopHref,
  isAvailabilityParamCanonical,
  isProductScopeCanonical,
  normalizeShopQuery,
  toTrainingGoals,
} from "@/lib/catalog-query";

export const metadata: Metadata = {
  title: "كل المكملات",

  description:
    "تصفح المكملات الرياضية والإكسسوارات وصفِّها حسب الفئة والهدف والتوفر.",
};

export const revalidate =
  300;

type Props = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function Page({
  searchParams,
}: Props) {
  const [params, categories] = await Promise.all([
    searchParams,
    getCategories(),
  ]);
  const categoryOptions = categories.map((category) => ({
    slug: category.slug,
    label: category.name,
  }));
  const query = normalizeShopQuery(
    params,
    categoryOptions.map((category) => category.slug),
  );
  const catalog = await getCatalogPage(
    query.categories,
    toTrainingGoals(query.goals),
    query.available,
    query.sort,
    query.productScope,
    query.page,
    SHOP_PAGE_SIZE,
  );
  const categoryLabels = new Map(
    categoryOptions.map((category) => [
      category.slug,
      category.label,
    ]),
  );
  const products = catalog.products.map(
    (product) => ({
      ...product,
      category:
        categoryLabels.get(
          product.category,
        ) ?? product.category,
    }),
  );

  if (
    catalog.page !== query.page ||
    !areCategoryParamsCanonical(
      params.category,
      query.categories,
    ) ||
    !areGoalParamsCanonical(
      params.goal,
      query.goals,
    ) ||
    !isAvailabilityParamCanonical(
      params.available,
      query.available,
    ) ||
    !isProductScopeCanonical(
      params.type,
      query.productScope,
    )
  ) {
    redirect(
      buildShopHref({
        ...query,
        page: catalog.page,
      }),
    );
  }

  return (
    <StoreChrome>
      <ShopPage
        products={products}
        total={catalog.total}
        totalPages={catalog.totalPages}
        query={query}
        categories={categoryOptions}
      />
    </StoreChrome>
  );
}
