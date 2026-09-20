"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type FormEvent,
  useRef,
  useState,
} from "react";

import { useCart } from "@/components/cart/cart-provider";
import { ArrowIcon, BagIcon, CheckIcon } from "@/components/ui/icons";

import styles from "./checkout.module.css";

type ConfirmedOrder = {
  order_id: string;
  order_number: number | string;
  currency: string;
  subtotal: number;
  code_qualifying_subtotal: number;
  discount_amount: number;
  total: number;
};

function formatMoney(value: number, currency = "LYD") {
  return new Intl.NumberFormat("ar-LY", {
    style: "currency",
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

export function CheckoutPage({ initialCode }: { initialCode: string }) {
  const {
    items,
    subtotal,
    clearCart,
  } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedOrder | null>(null);
  const submissionLock = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionLock.current || items.length === 0) {
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_full_name: String(
            data.get("customer_full_name") ?? "",
          ),
          customer_phone: String(data.get("customer_phone") ?? ""),
          customer_city: String(data.get("customer_city") ?? ""),
          customer_address: String(data.get("customer_address") ?? ""),
          customer_notes: String(data.get("customer_notes") ?? ""),
          code: String(data.get("code") ?? ""),
          items: items.map((item) => ({
            variant_id: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        order?: ConfirmedOrder;
        error?: string;
      };

      if (!response.ok || result.success !== true || !result.order) {
        throw new Error(
          result.error || "تعذر تأكيد الطلب. احتفظنا بالسلة للمحاولة مجددًا.",
        );
      }

      setConfirmedOrder(result.order);
      clearCart();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "تعذر تأكيد الطلب. احتفظنا بالسلة للمحاولة مجددًا.",
      );
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <main className={styles.page}>
        <div className="container">
          <section className={styles.successCard} aria-live="polite">
            <span className={styles.successIcon}>
              <CheckIcon />
            </span>
            <h1>تم تأكيد طلبك بنجاح</h1>
            <p>
              حسب الخادم الأسعار والمخزون والخصم، وسُجل الطلب رسميًا.
              احتفظ برقم الطلب للمتابعة.
            </p>
            <div className={styles.successReference}>
              رقم الطلب: <strong>#{String(confirmedOrder.order_number)}</strong>
            </div>
            <div className={styles.confirmedTotals}>
              <div>
                <span>المجموع الفرعي المؤكد</span>
                <strong>
                  {formatMoney(
                    confirmedOrder.subtotal,
                    confirmedOrder.currency,
                  )}
                </strong>
              </div>
              <div>
                <span>الخصم المؤكد</span>
                <strong>
                  - {formatMoney(
                    confirmedOrder.discount_amount,
                    confirmedOrder.currency,
                  )}
                </strong>
              </div>
              <div>
                <span>الإجمالي المؤكد</span>
                <strong>
                  {formatMoney(
                    confirmedOrder.total,
                    confirmedOrder.currency,
                  )}
                </strong>
              </div>
            </div>
            <div className={styles.actions}>
              <Link href="/shop" className="button primary">
                متابعة التسوق <ArrowIcon />
              </Link>
              <Link href="/" className="button ghost">
                العودة للرئيسية
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className={styles.page}>
        <div className="container">
          <section className={styles.emptyCard}>
            <span className={styles.emptyIcon}>
              <BagIcon />
            </span>
            <h1>لا توجد منتجات لإتمام الطلب</h1>
            <p>أضف منتجات إلى السلة أولًا، ثم عد لإدخال بيانات التوصيل.</p>
            <div className={styles.actions}>
              <Link href="/shop" className="button primary">
                تصفح المنتجات
              </Link>
              <Link href="/cart" className="button ghost">
                العودة للسلة
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className="container">
        <header className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>SECURE CHECKOUT</span>
            <h1>تأكيد الطلب</h1>
            <p>أدخل بيانات التوصيل، ثم دع الخادم يتحقق من الطلب بالكامل.</p>
          </div>
          <Link href="/cart" className={styles.backLink}>
            العودة إلى السلة
          </Link>
        </header>

        <div className={styles.layout}>
          <form className={styles.form} onSubmit={submit}>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <strong>بيانات العميل والتوصيل</strong>
                <span>الحقول المطلوبة مطابقة لبيانات الطلب في الخادم.</span>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>الاسم الكامل *</span>
                  <input
                    type="text"
                    name="customer_full_name"
                    required
                    minLength={2}
                    maxLength={160}
                    autoComplete="name"
                  />
                </label>

                <label className={styles.field}>
                  <span>رقم الهاتف *</span>
                  <input
                    type="tel"
                    name="customer_phone"
                    required
                    minLength={6}
                    maxLength={32}
                    autoComplete="tel"
                    dir="ltr"
                  />
                </label>

                <label className={styles.field}>
                  <span>المدينة *</span>
                  <input
                    type="text"
                    name="customer_city"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="address-level2"
                  />
                </label>

                <label className={styles.fullField}>
                  <span>العنوان الكامل *</span>
                  <input
                    type="text"
                    name="customer_address"
                    required
                    minLength={5}
                    maxLength={500}
                    autoComplete="street-address"
                  />
                </label>

                <label className={styles.fullField}>
                  <span>ملاحظات الطلب</span>
                  <textarea
                    name="customer_notes"
                    maxLength={2000}
                    placeholder="تفاصيل إضافية للتوصيل (اختياري)"
                  />
                </label>
              </div>
            </section>

            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <strong>كود الخصم أو الرياضي</strong>
                <span>اختياري، وسيتم التحقق منه عند إرسال الطلب.</span>
              </div>
              <label className={styles.fullField}>
                <span>الكود</span>
                <input
                  type="text"
                  name="code"
                  dir="ltr"
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
                  defaultValue={initialCode}
                  placeholder="FITNESS20"
                  onInput={(event) => {
                    event.currentTarget.value =
                      event.currentTarget.value.toUpperCase();
                  }}
                />
                <small className={styles.codeHelp}>
                  الأكواد غير النشطة أو المنتهية أو غير المنطبقة سترفضها
                  قاعدة البيانات دون تفريغ السلة.
                </small>
              </label>
            </section>

            <p className={styles.authorityNotice}>
              لا ترسل هذه الصفحة أسعارًا أو إجماليات. الخادم يعيد تحميل
              الأسعار والمخزون، ويحسب الخصم والعمولة والإجمالي داخل معاملة
              واحدة موثوقة.
            </p>

            {error && (
              <p className={styles.error} role="alert" aria-live="assertive">
                {error}
              </p>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={submitting}
            >
              {submitting ? "جارٍ التحقق وتأكيد الطلب..." : "تأكيد الطلب"}
            </button>
          </form>

          <aside className={styles.summary}>
            <h2>مراجعة السلة</h2>
            <div className={styles.items}>
              {items.map((item) => {
                const variant =
                  item.product.variants.find(
                    (entry) => entry.id === item.variantId,
                  ) ?? item.product.variants[0];

                return (
                  <article key={item.id} className={styles.item}>
                    <div className={styles.itemImage}>
                      {item.product.images[0] ? (
                        <Image
                          src={item.product.images[0]}
                          alt={item.product.shortName}
                          fill
                          sizes="58px"
                        />
                      ) : (
                        <span aria-hidden="true">
                          {item.product.shortName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className={styles.itemCopy}>
                      <strong>{item.product.shortName}</strong>
                      <span>
                        {variant.flavor} · {variant.weight} · الكمية {item.quantity}
                      </span>
                    </div>
                    <span className={styles.itemPrice}>
                      {formatMoney(variant.price * item.quantity)}
                    </span>
                  </article>
                );
              })}
            </div>
            <div className={styles.previewTotal}>
              <div>
                <span>المجموع المبدئي المعروض</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <small>
                للعرض فقط. المجموع والخصم النهائيان هما القيم التي ترجعها
                قاعدة البيانات بعد التحقق من الأسعار والمخزون.
              </small>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
