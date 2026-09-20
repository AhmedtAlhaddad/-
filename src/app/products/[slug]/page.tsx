import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreChrome } from "@/components/layout/footer";
import { ProductDetail } from "@/components/products/product-detail";

import {
  getProductBySlug,
  getFeaturedProducts,
} from "@/lib/supabase/catalog-cache";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const revalidate =
  300;

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { slug } =
    await params;

  const product =
    await getProductBySlug(
      slug,
    );

  if (!product) {
    return {
      title:
        "المنتج غير موجود",
    };
  }

  return {
    title:
      product.shortName,

    description:
      product.description,

    openGraph: {
      title:
        product.name,

      description:
        product.description,

      images:
        product.images.length >
        0
          ? [
              product
                .images[0],
            ]
          : [],
    },
  };
}

export default async function Page({
  params,
}: Props) {
  const { slug } =
    await params;

  const [
    product,
    recommendations,
  ] = await Promise.all([
    getProductBySlug(
      slug,
    ),

    getFeaturedProducts(
      4,
      slug,
    ),
  ]);

  if (
    !product ||
    product.variants.length ===
      0
  ) {
    notFound();
  }

  return (
    <StoreChrome>
      <ProductDetail
        product={product}
        recommendations={
          recommendations
        }
      />
    </StoreChrome>
  );
}
