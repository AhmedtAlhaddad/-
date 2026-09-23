"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./admin-products.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responseError(response: Response) {
  const payload: unknown = await response.json().catch(() => null);

  return isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : "تعذر إكمال العملية.";
}

export function ProductRemovalAction({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const endpoint = `/api/admin/products/${encodeURIComponent(productId)}`;
      const message = `سيُحذف «${productName}» نهائيًا من المتجر ولوحة المنتجات. ستبقى الطلبات والمبيعات والخصومات والعمولات والمدفوعات والسجلات المالية السابقة محفوظة. سيعيد الخادم التحقق عند التنفيذ. هل تريد المتابعة؟`;

      if (!window.confirm(message)) {
        return;
      }

      const deleteResponse = await fetch(endpoint, { method: "DELETE" });

      if (!deleteResponse.ok) {
        throw new Error(await responseError(deleteResponse));
      }

      document
        .querySelector<HTMLElement>(
          `[data-product-row-id="${productId}"]`,
        )
        ?.remove();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "تعذر إزالة المنتج.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={remove}
        disabled={busy}
      >
        {busy ? "جارٍ الحذف..." : "حذف المنتج"}
      </button>
      {error && (
        <span className={styles.actionError} role="alert">
          {error}
        </span>
      )}
    </>
  );
}
