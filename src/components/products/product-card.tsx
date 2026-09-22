"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useCart } from "@/components/cart/cart-provider";

import {
  PlusIcon,
} from "@/components/ui/icons";

import { formatPrice } from "@/lib/utils";
import type { CatalogProduct } from "@/types/product";

export function ProductCard({
  product,
}: {
  product: CatalogProduct;
}) {
  const {
    addItem,
  } =
    useCart();
  const [added, setAdded] = useState(false);
  const feedbackActive = useRef(false);
  const feedbackTimer = useRef<number | null>(null);

  const variant =
    product.variants[0];

  const image =
    product.images[0];

  useEffect(() => () => {
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
    }
  }, []);

  if (!variant) {
    return null;
  }

  const add = () => {
    if (feedbackActive.current) {
      return;
    }

    const succeeded = addItem(
      product,
      variant.id,
    );

    if (!succeeded) {
      return;
    }

    feedbackActive.current = true;
    setAdded(true);
    feedbackTimer.current = window.setTimeout(() => {
      feedbackActive.current = false;
      setAdded(false);
      feedbackTimer.current = null;
    }, 1000);
  };

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
            className={`product-card-add${added ? " is-added" : ""}`}
            disabled={
              added ||
              !product.inStock ||
              variant.stock <= 0
            }
            onClick={add}
            aria-label={
              added
                ? `تمت إضافة ${product.shortName} إلى السلة`
                : `أضف ${product.shortName} إلى السلة`
            }
          >
            <span className="product-card-add-symbol" aria-hidden="true">
              {added ? "✓" : <PlusIcon />}
            </span>
          </button>
          <span className="sr-only" role="status" aria-live="polite">
            {added ? `تمت إضافة ${product.shortName} إلى السلة` : ""}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
}: {
  items: CatalogProduct[];
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
