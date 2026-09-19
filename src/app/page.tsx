import { HomePage } from "@/components/home/home-sections";
import { StoreChrome } from "@/components/layout/footer";

import {
  getBrands,
  getCategories,
  getProducts,
} from "@/lib/supabase/catalog-cache";

export const revalidate =
  300;

export default async function Page() {
  const [
    products,
    brands,
    categories,
  ] = await Promise.all([
    getProducts(),
    getBrands(),
    getCategories(),
  ]);

  return (
    <StoreChrome newsletter>
      <HomePage
        products={products}
        brands={brands}
        categories={
          categories
        }
      />
    </StoreChrome>
  );
}