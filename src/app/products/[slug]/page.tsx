import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreChrome } from "@/components/layout/footer";
import { ProductDetail } from "@/components/products/product-detail";

import {
  getProductBySlug,
  getProducts,
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
    products,
  ] = await Promise.all([
    getProductBySlug(
      slug,
    ),

    getProducts(),
  ]);

  if (
    !product ||
    product.variants.length ===
      0
  ) {
    notFound();
  }

  const recommendations =
    products
      .filter(
        (item) =>
          item.id !==
          product.id,
      )
      .slice(0, 4);

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