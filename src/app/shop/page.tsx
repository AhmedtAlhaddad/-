import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StoreChrome } from "@/components/layout/footer";
import { ShopPage } from "@/components/shop/shop-page";

import {
  getCatalogPage,
  getBrands,
  getCategories,
} from "@/lib/supabase/catalog-cache";

import {
  SHOP_PAGE_SIZE,
  areBrandParamsCanonical,
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
  const [params, categories, brands] = await Promise.all([
    searchParams,
    getCategories(),
    getBrands(),
  ]);
  const categoryOptions = categories.map((category) => ({
    slug: category.slug,
    label: category.name,
  }));
  const query = normalizeShopQuery(
    params,
    categoryOptions.map((category) => category.slug),
    brands.map((brand) => brand.slug),
  );
  const catalog = await getCatalogPage(
    query.categories,
    query.brands,
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
    !areBrandParamsCanonical(
      params.brand,
      query.brands,
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
        brands={brands.map((brand) => ({
          slug: brand.slug,
          label: brand.name,
        }))}
      />
    </StoreChrome>
  );
}
