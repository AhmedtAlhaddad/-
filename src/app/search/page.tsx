import type { Metadata } from "next";

import { SearchPage } from "@/components/search/search-page";

import {
  getBrands,
  getCategories,
  getProducts,
} from "@/lib/supabase/catalog-cache";

export const metadata: Metadata = {
  title: "البحث",

  robots: {
    index: false,
    follow: true,
  },
};

export const revalidate =
  300;

export default async function Page() {
  const [
    products,
    categories,
    brands,
  ] = await Promise.all([
    getProducts(),
    getCategories(),
    getBrands(),
  ]);

  return (
    <SearchPage
      products={products}
      categories={
        categories
      }
      brands={brands}
    />
  );
}