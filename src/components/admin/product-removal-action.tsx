"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./admin-products.module.css";

type RemovalPlan = {
  action: "hard_delete" | "retire";
  has_order_history: boolean;
  has_inventory_history: boolean;
  has_stored_images: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePlan(value: unknown): RemovalPlan | null {
  if (
    !isRecord(value) ||
    (value.action !== "hard_delete" && value.action !== "retire") ||
    typeof value.has_order_history !== "boolean" ||
    typeof value.has_inventory_history !== "boolean" ||
    typeof value.has_stored_images !== "boolean"
  ) {
    return null;
  }

  return {
    action: value.action,
    has_order_history: value.has_order_history,
    has_inventory_history: value.has_inventory_history,
    has_stored_images: value.has_stored_images,
  };
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
      const previewResponse = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
      });

      if (!previewResponse.ok) {
        throw new Error(await responseError(previewResponse));
      }

      const previewPayload: unknown = await previewResponse.json();
      const plan = isRecord(previewPayload)
        ? parsePlan(previewPayload.plan)
        : null;

      if (!plan) {
        throw new Error("تعذر تحديد طريقة إزالة المنتج بأمان.");
      }

      const message = plan.action === "hard_delete"
        ? `سيُحذف «${productName}» نهائيًا لأنه بلا سجل طلبات أو مخزون تاريخي محفوظ. سيعيد الخادم التحقق عند التنفيذ. هل تريد المتابعة؟`
        : `سيُؤرشف «${productName}» ويُوقف عن البيع بدل حذفه نهائيًا. ستبقى الطلبات ومبالغ العمولات والمدفوعات والسجلات التاريخية محفوظة. سيعيد الخادم التحقق عند التنفيذ. هل تريد المتابعة؟`;

      if (!window.confirm(message)) {
        return;
      }

      const deleteResponse = await fetch(endpoint, { method: "DELETE" });

      if (!deleteResponse.ok) {
        throw new Error(await responseError(deleteResponse));
      }

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
        {busy ? "جارٍ التحقق..." : "حذف المنتج"}
      </button>
      {error && (
        <span className={styles.actionError} role="alert">
          {error}
        </span>
      )}
    </>
  );
}
