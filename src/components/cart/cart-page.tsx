"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import {
  ArrowIcon,
  BagIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons";
import {
  requestDiscountPreview,
  type DiscountPreview,
} from "@/lib/discount-preview";
import { formatPrice } from "@/lib/utils";

export function CartPage() {
  const {
    items,
    subtotal,
    updateQuantity,
    removeItem,
  } = useCart();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<
    "success" | "error" | ""
  >("");
  const [preview, setPreview] =
    useState<DiscountPreview | null>(null);
  const [previewLoading, setPreviewLoading] =
    useState(false);
  const previewRequestId = useRef(0);
  const cartFingerprint = items
    .map((item) => `${item.id}:${item.variantId}:${item.quantity}`)
    .join("|");
  const cartFingerprintRef = useRef(cartFingerprint);
  const [previewItems, setPreviewItems] =
    useState<typeof items | null>(null);
  const [messageItems, setMessageItems] =
    useState<typeof items | null>(null);
  const activePreview =
    previewItems === items ? preview : null;
  const activeMessage =
    messageItems === items ? message : "";
  const activeMessageTone = activeMessage ? messageTone : "";
  const checkoutHref = code.trim()
    ? `/checkout?code=${encodeURIComponent(code.trim().toUpperCase())}`
    : "/checkout";

  useEffect(() => {
    cartFingerprintRef.current = cartFingerprint;
    previewRequestId.current += 1;
  }, [cartFingerprint]);

  async function applyCode() {
    const normalizedCode = code.trim().toUpperCase();
    const requestFingerprint = cartFingerprint;

    if (!normalizedCode) {
      setPreview(null);
      setPreviewItems(null);
      setMessage("أدخل كودًا أولًا.");
      setMessageTone("error");
      setMessageItems(items);
      return;
    }

    const requestId = ++previewRequestId.current;
    setPreviewLoading(true);
    setPreview(null);
    setPreviewItems(null);
    setMessage("");
    setMessageTone("");
    setMessageItems(null);

    try {
      const result = await requestDiscountPreview(
        items.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
        normalizedCode,
      );

      if (
        requestId !== previewRequestId.current ||
        requestFingerprint !== cartFingerprintRef.current
      ) {
        return;
      }

      setCode(result.code);
      setPreview(result);
      setPreviewItems(items);
      setMessage("تم تطبيق كود الخصم.");
      setMessageTone("success");
      setMessageItems(items);
    } catch (caught) {
      if (
        requestId !== previewRequestId.current ||
        requestFingerprint !== cartFingerprintRef.current
      ) {
        return;
      }

      setPreviewItems(null);
      setMessage(
        caught instanceof Error
          ? caught.message
          : "تعذر التحقق من كود الخصم.",
      );
      setMessageTone("error");
      setMessageItems(items);
    } finally {
      if (requestId === previewRequestId.current) {
        setPreviewLoading(false);
      }
    }
  }

  return (
    <main className="cart-page">
      <div className="container cart-heading">
        <div>
          <span className="cart-title-icon">
            <BagIcon />
          </span>
          <div>
            <h1>سلة التسوق</h1>
            <p>لديك {items.length} منتجات في سلتك</p>
          </div>
        </div>
        <Link href="/shop">
          واصل التسوق <ArrowIcon />
        </Link>
      </div>

      <div className="container cart-layout">
        <section className="cart-items" aria-label="منتجات السلة">
          {items.length ? (
            items.map((item) => {
              const variant =
                item.product.variants.find(
                  (entry) => entry.id === item.variantId,
                ) ?? item.product.variants[0];

              return (
                <article className="cart-item" key={item.id}>
                  <div className="cart-item-image">
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.shortName}
                        fill
                        sizes="120px"
                      />
                    ) : (
                      <span aria-hidden="true">
                        {item.product.shortName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="cart-item-main">
                    <small>{item.product.category}</small>
                    <Link href={`/products/${item.product.slug}`}>
                      <h2>{item.product.shortName}</h2>
                    </Link>
                    <p>
                      {variant.flavor} · {variant.weight}
                    </p>
                    <strong>{formatPrice(variant.price)}</strong>
                  </div>
                  <div className="cart-item-actions">
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`حذف ${item.product.shortName}`}
                    >
                      <TrashIcon />
                    </button>
                    <div className="quantity">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        aria-label="تقليل الكمية"
                      >
                        <MinusIcon />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        aria-label="زيادة الكمية"
                      >
                        <PlusIcon />
                      </button>
                    </div>
                    <div>
                      <small>المجموع</small>
                      <b>{formatPrice(variant.price * item.quantity)}</b>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">
              <BagIcon />
              <h2>سلتك فارغة</h2>
              <p>ابدأ بإضافة منتجات تدعم هدفك.</p>
              <Link className="button primary" href="/shop">
                تسوق الآن
              </Link>
            </div>
          )}
        </section>

        <aside className="order-summary">
          <h2>ملخص الطلب</h2>
          <label htmlFor="discount">كود الخصم</label>
          <div className="discount-input">
            <input
              id="discount"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setPreview(null);
                setPreviewItems(null);
                setMessage("");
                setMessageTone("");
                setMessageItems(null);
              }}
              maxLength={32}
              dir="ltr"
              placeholder="أدخل الكود"
              aria-describedby="discount-message"
              aria-invalid={activeMessageTone === "error"}
            />
            <button
              type="button"
              onClick={applyCode}
              disabled={previewLoading}
            >
              {previewLoading ? "جارٍ التحقق..." : "تطبيق"}
            </button>
          </div>
          {activeMessage && (
            <p
              id="discount-message"
              aria-live="polite"
              className={
                activeMessageTone === "success"
                  ? "code-success"
                  : "code-error"
              }
            >
              {activeMessage}
            </p>
          )}
          <dl>
            <div>
              <dt>السعر قبل الخصم</dt>
              <dd>
                {formatPrice(
                  activePreview?.subtotal_before_discount ?? subtotal,
                )}
              </dd>
            </div>
            <div>
              <dt>الشحن</dt>
              <dd className="green">يُحدد عند التأكيد</dd>
            </div>
            <div>
              <dt>الخصم</dt>
              <dd className={activePreview ? "discount-value" : undefined}>
                {activePreview
                  ? `- ${formatPrice(activePreview.discount_amount)}`
                  : "يحسبه الخادم"}
              </dd>
            </div>
          </dl>
          <div className="order-total">
            <span>
              <b>{activePreview ? "السعر بعد الخصم" : "الإجمالي المبدئي"}</b>
              <small>يعيد الخادم التحقق من السعر والخصم عند تأكيد الطلب</small>
            </span>
            <strong>
              {formatPrice(
                activePreview?.subtotal_after_discount ?? subtotal,
              )}
            </strong>
          </div>
          {items.length ? (
            <Link
              href={checkoutHref}
              className="button primary checkout-button"
            >
              إتمام الطلب <ArrowIcon />
            </Link>
          ) : (
            <button disabled className="button primary checkout-button">
              إتمام الطلب <ArrowIcon />
            </button>
          )}
          <div className="payment-marks">
            <span>SERVER</span>
            <span>VERIFIED</span>
          </div>
        </aside>
      </div>

      <div className="container cart-assurances">
        <div>
          ♢
          <span>
            <b>طلب موثوق</b>
            <small>الأسعار والمخزون يعاد التحقق منهما</small>
          </span>
        </div>
        <div>
          %
          <span>
            <b>خصم آمن</b>
            <small>الكود يُحسب داخل قاعدة البيانات</small>
          </span>
        </div>
      </div>
    </main>
  );
}
