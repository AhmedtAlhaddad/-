"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { ProductGrid } from "@/components/products/product-card";
import {
  CheckIcon,
  MinusIcon,
  PlusIcon,
} from "@/components/ui/icons";

import { formatPrice } from "@/lib/utils";
import type {
  CatalogProduct,
  Product,
} from "@/types/product";

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="product-gallery">
        <div className="gallery-main">
          <div className="product-image-placeholder">
            لا توجد صورة
          </div>
        </div>
      </div>
    );
  }

  const safeActive = Math.min(
    active,
    images.length - 1,
  );

  return (
    <div className="product-gallery">
      <div className="gallery-main">
        <Image
          src={images[safeActive]}
          alt={name}
          fill
          priority
          sizes="(max-width: 900px) 100vw, 52vw"
        />
      </div>

      <div className="gallery-thumbs">
        {images.map((image, index) => (
          <button
            className={
              index === safeActive
                ? "active"
                : ""
            }
            onClick={() =>
              setActive(index)
            }
            key={`${image}-${index}`}
            aria-label={`عرض الصورة ${index + 1}`}
          >
            <Image
              src={image}
              alt=""
              fill
              loading="lazy"
              sizes="100px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function QuantitySelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="quantity">
      <button
        onClick={() =>
          onChange(
            Math.max(
              1,
              value - 1,
            ),
          )
        }
        aria-label="تقليل الكمية"
      >
        <MinusIcon />
      </button>

      <span>{value}</span>

      <button
        onClick={() =>
          onChange(value + 1)
        }
        aria-label="زيادة الكمية"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

export function ProductDetail({
  product,
  recommendations,
}: {
  product: Product;
  recommendations: CatalogProduct[];
}) {
  const [variantId, setVariantId] =
    useState(
      product.variants[0].id,
    );

  const [quantity, setQuantity] =
    useState(1);

  const [added, setAdded] =
    useState(false);

  const [tab, setTab] =
    useState("details");

  const { addItem } = useCart();

  const variant =
    product.variants.find(
      (entry) =>
        entry.id === variantId,
    ) ?? product.variants[0];

  const galleryImages =
    variant.images.length > 0
      ? variant.images
      : product.images;

  const stickyImage =
    galleryImages[0] ??
    product.images[0];

  const add = () => {
    if (
      !variant ||
      variant.stock <= 0
    ) {
      return;
    }

    const safeQuantity =
      Math.min(
        quantity,
        variant.stock,
      );

    addItem(
      product,
      variant.id,
      safeQuantity,
    );

    setAdded(true);

    window.setTimeout(() => {
      setAdded(false);
    }, 1600);
  };

  return (
    <main className="product-page">
      <div className="container breadcrumbs">
        <Link href="/">
          الرئيسية
        </Link>

        <span>/</span>

        <Link href="/shop">
          المكملات الغذائية
        </Link>

        <span>/</span>

        <span>
          {product.shortName}
        </span>
      </div>

      <section className="container product-top">
        <ProductGallery
          key={variant.id}
          images={galleryImages}
          name={product.name}
        />

        <div className="product-info">
          {product.badge && (
            <span className="eyebrow">
              {product.badge}
            </span>
          )}

          <h1>
            {product.name}
          </h1>

          <p className="product-brand">
            {product.brand}
          </p>

          <div className="price-row">
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

            {variant.compareAtPrice && (
              <span>
                وفر{" "}
                {Math.round(
                  (1 -
                    variant.price /
                      variant.compareAtPrice) *
                    100,
                )}
                %
              </span>
            )}
          </div>

          <p className="product-description">
            {product.description}
          </p>

          {product.features.length >
            0 && (
            <div className="feature-grid">
              {product.features
                .slice(0, 4)
                .map(
                  (feature) => (
                    <div
                      key={
                        feature
                      }
                    >
                      <span>
                        القيمة
                      </span>

                      <b>
                        {
                          feature
                        }
                      </b>
                    </div>
                  ),
                )}
            </div>
          )}

          <fieldset className="variant-field">
            <legend>
              اختر النكهة والحجم
            </legend>

            <div>
              {product.variants.map(
                (entry) => (
                  <button
                    className={
                      entry.id ===
                      variant.id
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setVariantId(
                        entry.id,
                      );

                      setQuantity(1);
                    }}
                    key={
                      entry.id
                    }
                  >
                    <b>
                      {
                        entry.flavor
                      }
                    </b>

                    <span>
                      {
                        entry.weight
                      }

                      {entry.servings >
                        0 &&
                        ` · ${entry.servings} حصة`}
                    </span>
                  </button>
                ),
              )}
            </div>
          </fieldset>

          <div className="stock-line">
            <CheckIcon />

            <span>
              <b>
                {variant.stock > 0
                  ? "متوفر في المخزون"
                  : "غير متوفر حاليًا"}
              </b>

              {variant.stock >
                0 && (
                <>
                  {" "}
                  — متوفر{" "}
                  {
                    variant.stock
                  }{" "}
                  قطعة
                </>
              )}
            </span>
          </div>

          <div className="purchase-row">
            <QuantitySelector
              value={quantity}
              onChange={(value) =>
                setQuantity(
                  Math.min(
                    value,
                    Math.max(
                      variant.stock,
                      1,
                    ),
                  ),
                )
              }
            />

            <button
              className="button primary add-button"
              onClick={add}
              disabled={
                variant.stock <= 0
              }
            >
              {variant.stock <= 0
                ? "غير متوفر"
                : added
                  ? "تمت الإضافة ✓"
                  : "إضافة إلى السلة"}
            </button>
          </div>

          <div className="purchase-benefits">
            <span>
              ✓ ضمان الأصالة
            </span>

            <span>
              ⚡ شحن سريع
            </span>

            <span>
              ↩ دعم العملاء
            </span>
          </div>
        </div>
      </section>

      <section className="container product-content">
        <div
          className="tabs"
          role="tablist"
        >
          {[
            [
              "details",
              "تفاصيل المنتج",
            ],
            [
              "nutrition",
              "الحقائق الغذائية",
            ],
            [
              "usage",
              "طريقة الاستخدام",
            ],
          ].map(
            ([id, label]) => (
              <button
                role="tab"
                aria-selected={
                  tab === id
                }
                onClick={() =>
                  setTab(id)
                }
                className={
                  tab === id
                    ? "active"
                    : ""
                }
                key={id}
              >
                {label}
              </button>
            ),
          )}
        </div>

        <div className="tab-content">
          {tab ===
            "details" && (
            <>
              <div>
                <span className="eyebrow">
                  تفاصيل المنتج
                </span>

                <h2>
                  معلومات عن هذا
                  المنتج
                </h2>

                <p>
                  {
                    product.description
                  }
                </p>

                {product.features
                  .length >
                  0 && (
                  <ul>
                    {product.features.map(
                      (
                        feature,
                      ) => (
                        <li
                          key={
                            feature
                          }
                        >
                          <CheckIcon />

                          {
                            feature
                          }
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>

              <div className="formula-panel">
                <span>
                  PERFORMANCE
                </span>

                <b>
                  جودة مختارة.
                  <br />
                  خيارات متعددة.
                </b>
              </div>
            </>
          )}

          {tab ===
            "nutrition" && (
            <div>
              <h2>
                الحقائق الغذائية
              </h2>

              <p>
                تختلف المعلومات
                الغذائية حسب المنتج
                والنكهة والحجم. راجع
                ملصق العبوة للحصول
                على القيم الدقيقة.
              </p>
            </div>
          )}

          {tab ===
            "usage" && (
            <div>
              <h2>
                طريقة الاستخدام
              </h2>

              <p>
                اتبع تعليمات
                الاستخدام الموجودة
                على عبوة المنتج.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="container faq-section">
        <div>
          <span className="eyebrow">
            نجيب عن أسئلتك
          </span>

          <h2>
            الأسئلة الشائعة
          </h2>

          <p>
            معلومات عامة تساعدك
            على معرفة تفاصيل المنتج
            قبل الطلب.
          </p>
        </div>

        <div>
          {[
            "أين أجد مكونات المنتج؟",
            "هل تختلف المعلومات حسب النكهة؟",
            "كيف أعرف الحجم المناسب للطلب؟",
          ].map(
            (
              question,
              index,
            ) => (
              <details
                key={
                  question
                }
              >
                <summary>
                  {
                    question
                  }
                </summary>

                <p>
                  {index ===
                  0
                    ? "يمكن مراجعة المكونات والمعلومات الغذائية الموجودة على العبوة."
                    : index ===
                        1
                      ? "قد تختلف بعض المعلومات بين النكهات والأحجام، لذلك راجع بيانات الخيار المحدد."
                      : "يمكنك اختيار الحجم والنكهة المتوفرين من خيارات المنتج قبل إضافته إلى السلة."}
                </p>
              </details>
            ),
          )}
        </div>
      </section>

      {recommendations.length >
        0 && (
        <section className="section container recommendations">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                منتجات أخرى
              </span>

              <h2>
                قد يعجبك أيضًا
              </h2>
            </div>

            <Link href="/shop">
              مشاهدة الكل ←
            </Link>
          </div>

          <ProductGrid
            items={
              recommendations
            }
          />
        </section>
      )}

      <div className="sticky-cart">
        <div className="container">
          <div>
            {stickyImage && (
              <Image
                src={stickyImage}
                alt=""
                width={54}
                height={54}
                sizes="54px"
                style={{
                  width: 54,
                  height: 54,
                }}
              />
            )}

            <span>
              <b>
                {
                  product.shortName
                }
              </b>

              <small>
                {formatPrice(
                  variant.price,
                )}
              </small>
            </span>
          </div>

          <QuantitySelector
            value={quantity}
            onChange={(value) =>
              setQuantity(
                Math.min(
                  value,
                  Math.max(
                    variant.stock,
                    1,
                  ),
                ),
              )
            }
          />

          <button
            className="button primary"
            onClick={add}
            disabled={
              variant.stock <= 0
            }
          >
            {variant.stock <= 0
              ? "غير متوفر"
              : added
                ? "تمت الإضافة"
                : "إضافة إلى السلة"}
          </button>
        </div>
      </div>
    </main>
  );
}
