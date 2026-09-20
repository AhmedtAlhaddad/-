import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StoreChrome } from "@/components/layout/footer";
import { ShopPage } from "@/components/shop/shop-page";

import {
  getCatalogPage,
} from "@/lib/supabase/catalog-cache";

import {
  SHOP_PAGE_SIZE,
  buildShopHref,
  normalizeShopQuery,
  toCategorySlugs,
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
  const params = await searchParams;
  const query = normalizeShopQuery(params);
  const catalog = await getCatalogPage(
    toCategorySlugs(query.categories),
    toTrainingGoals(query.goals),
    query.available,
    query.sort,
    query.page,
    SHOP_PAGE_SIZE,
  );

  if (catalog.page !== query.page) {
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
        products={catalog.products}
        total={catalog.total}
        totalPages={catalog.totalPages}
        query={query}
      />
    </StoreChrome>
  );
}
