import type { Metadata } from "next";

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";

import styles from "@/components/admin/admin-dashboard.module.css";

export const metadata: Metadata = {
  title: "لوحة الإدارة",

  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const { supabase } = await requireAdmin("/admin");

  const [
    productsResult,
    ordersResult,
    athletesResult,
    discountsResult,
  ] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        ),

      supabase
        .from("orders")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        ),

      supabase
        .from("athletes")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        ),

      supabase
        .from("discount_codes")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          },
        ),
    ]);

  const productCount =
    productsResult.count ?? 0;

  const orderCount =
    ordersResult.count ?? 0;

  const athleteCount =
    athletesResult.count ?? 0;

  const discountCount =
    discountsResult.count ?? 0;

  const actions = [
    {
      href:
        "/admin/products",
      icon:
        "▦",
      title:
        "إدارة المنتجات",
      description:
        "إضافة المنتجات وخياراتها وأسعارها وصورها.",
    },
    {
      href:
        "/admin/orders",
      icon:
        "▤",
      title:
        "إدارة الطلبات",
      description:
        "متابعة الطلبات وتحديث حالتها.",
    },
    {
      href:
        "/admin/inventory",
      icon:
        "◫",
      title:
        "إدارة المخزون",
      description:
        "متابعة الكميات وحركات المخزون.",
    },
    {
      href:
        "/admin/discounts",
      icon:
        "%",
      title:
        "الخصومات والعمولات",
      description:
        "إدارة أكواد الخصم ونسب الرياضيين.",
    },
  ];

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>
            OVERVIEW
          </span>

          <h1>
            لوحة التحكم
          </h1>

          <p>
            نظرة سريعة على المتجر
            وإجراءات الإدارة اليومية.
          </p>
        </div>
      </section>

      <section className={styles.actionsSection}>
        <Link
          href="/admin/products"
          className={styles.primaryButton}
        >
          + إضافة منتج
        </Link>
      </section>

      <section className={styles.stats}>
        <article className={styles.stat}>
          <span>
            إجمالي المنتجات
          </span>

          <strong>
            {productCount}
          </strong>

          <small>
            كتالوج المتجر
          </small>
        </article>

        <article className={styles.stat}>
          <span>
            إجمالي الطلبات
          </span>

          <strong>
            {orderCount}
          </strong>

          <small>
            جميع الطلبات
          </small>
        </article>

        <article className={styles.stat}>
          <span>
            الرياضيون
          </span>

          <strong>
            {athleteCount}
          </strong>

          <small>
            الحسابات المسجلة
          </small>
        </article>

        <article className={styles.stat}>
          <span>
            أكواد الخصم
          </span>

          <strong>
            {discountCount}
          </strong>

          <small>
            جميع الأكواد
          </small>
        </article>
      </section>

      <section className={styles.quickActionsSection}>
        <div className={styles.sectionTitle}>
          <h2>
            إجراءات سريعة
          </h2>
        </div>

        <div className={styles.actions}>
          {actions.map((action) => (
            <Link
              href={action.href}
              className={styles.action}
              key={action.href}
            >
              <span className={styles.actionIcon}>
                {action.icon}
              </span>

              <strong>
                {action.title}
              </strong>

              <span>
                {action.description}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.storeAction}>
        <Link
          href="/"
          className={styles.storeButton}
        >
          عرض المتجر
        </Link>
      </section>
    </main>
  );
}
