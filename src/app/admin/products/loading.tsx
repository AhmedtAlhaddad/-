import styles from "@/components/admin/admin-products.module.css";

export default function Loading() {
  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>
            CATALOG
          </span>

          <h1>
            إدارة المنتجات
          </h1>

          <p>
            جاري تحميل بيانات المنتجات...
          </p>
        </div>
      </section>

      <div className={styles.loadingGrid}>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    </main>
  );
}
