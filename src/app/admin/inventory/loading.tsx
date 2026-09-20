import styles from "@/components/admin/admin-inventory.module.css";

export default function Loading() {
  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={`${styles.skeleton} ${styles.skeletonHeading}`}
      />

      <div
        className={
          styles.loadingStats
        }
      >
        {Array.from(
          {
            length: 4,
          },
        ).map(
          (_, index) => (
            <div
              className={`${styles.skeleton} ${styles.skeletonStat}`}
              key={index}
            />
          ),
        )}
      </div>

      <div
        className={`${styles.skeleton} ${styles.skeletonToolbar}`}
      />

      <div
        className={
          styles.loadingRows
        }
      >
        {Array.from(
          {
            length: 7,
          },
        ).map(
          (_, index) => (
            <div
              className={`${styles.skeleton} ${styles.skeletonRow}`}
              key={index}
            />
          ),
        )}
      </div>
    </main>
  );
}