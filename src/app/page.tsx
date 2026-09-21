import { HomePage } from "@/components/home/home-sections";
import { StoreChrome } from "@/components/layout/footer";

import {
  getFeaturedProducts,
  getBrands,
  getHomepageCategories,
} from "@/lib/supabase/catalog-cache";

export const revalidate =
  300;

export default async function Page() {
  const [
    products,
    brands,
    categories,
  ] = await Promise.all([
    getFeaturedProducts(4),
    getBrands(),
    getHomepageCategories(),
  ]);

  return (
    <StoreChrome community>
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
