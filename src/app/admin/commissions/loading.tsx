import styles from "@/components/admin/admin-taxonomy.module.css";

export default function Loading() {
  return (
    <main className={styles.page}>
      <div
        className={`${styles.skeleton} ${styles.skeletonHeading}`}
      />

      <section className={styles.stats}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className={`${styles.skeleton} ${styles.skeletonStats}`}
          />
        ))}
      </section>

      <div
        className={`${styles.skeleton} ${styles.skeletonToolbar}`}
      />

      <div className={styles.loadingGrid}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={`${styles.skeleton} ${styles.skeletonRow}`}
          />
        ))}
      </div>
    </main>
  );
}
