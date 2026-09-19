import type { Metadata } from "next";

import { StoreChrome } from "@/components/layout/footer";
import { ShopPage } from "@/components/shop/shop-page";

import {
  getProducts,
} from "@/lib/supabase/catalog-cache";

import type {
  ProductCategory,
} from "@/types/product";

export const metadata: Metadata = {
  title: "كل المكملات",

  description:
    "تصفح المكملات الرياضية والإكسسوارات وصفِّها حسب الفئة والهدف والتوفر.",
};

export const revalidate =
  300;

const validCategories: ProductCategory[] = [
  "بروتين",
  "قبل التمرين",
  "كرياتين",
  "أحماض أمينية",
  "إكسسوارات اللياقة",
];

type Props = {
  searchParams: Promise<{
    category?:
      | string
      | string[];
  }>;
};

export default async function Page({
  searchParams,
}: Props) {
  const [
    products,
    params,
  ] = await Promise.all([
    getProducts(),
    searchParams,
  ]);

  const rawCategory =
    Array.isArray(
      params.category,
    )
      ? params.category[0]
      : params.category;

  const initialCategory =
    validCategories.find(
      (category) =>
        category ===
        rawCategory,
    );

  return (
    <StoreChrome>
      <ShopPage
        products={products}
        initialCategory={
          initialCategory
        }
      />
    </StoreChrome>
  );
}