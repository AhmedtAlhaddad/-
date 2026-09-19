"use client";

import Image from "next/image";
import Link from "next/link";

import { useCart } from "@/components/cart/cart-provider";

import {
  PlusIcon,
  StarIcon,
} from "@/components/ui/icons";

import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types/product";

export function ProductCard({
  product,
}: {
  product: Product;
}) {
  const {
    addItem,
  } =
    useCart();

  const variant =
    product.variants[0];

  const image =
    product.images[0];

  if (!variant) {
    return null;
  }

  return (
    <article className="product-card">
      <Link
        href={`/products/${product.slug}`}
        className="product-image-wrap"
      >
        {product.badge && (
          <span className="product-badge">
            {product.badge}
          </span>
        )}

        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 280px"
            className="product-image"
          />
        ) : (
          <div className="product-image-placeholder">
            لا توجد صورة
          </div>
        )}

        {!product.inStock && (
          <span className="stock-overlay">
            نفد مؤقتًا
          </span>
        )}
      </Link>

      <div className="product-copy">
        <div className="product-meta">
          <span>
            {product.brand}
          </span>

          <span className="rating">
            <StarIcon />{" "}
            {product.rating}
          </span>
        </div>

        <Link
          href={`/products/${product.slug}`}
        >
          <h3>
            {product.shortName}
          </h3>
        </Link>

        <p>
          {product.type}
        </p>

        <div className="product-card-bottom">
          <div>
            <strong>
              {formatPrice(
                variant.price,
              )}
            </strong>

            {variant.compareAtPrice && (
              <del>
                {formatPrice(
                  variant.compareAtPrice,
                )}
              </del>
            )}
          </div>

          <button
            disabled={
              !product.inStock ||
              variant.stock <= 0
            }
            onClick={() =>
              addItem(
                product,
                variant.id,
              )
            }
            aria-label={`أضف ${product.shortName} إلى السلة`}
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
}: {
  items: Product[];
}) {
  return (
    <div className="product-grid">
      {items.map(
        (product) => (
          <ProductCard
            key={
              product.id
            }
            product={
              product
            }
          />
        ),
      )}
    </div>
  );
}