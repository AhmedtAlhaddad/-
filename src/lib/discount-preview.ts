export type DiscountPreviewItem = {
  variant_id: string;
  quantity: number;
};

export type DiscountPreview = {
  code: string;
  currency: string;
  subtotal_before_discount: number;
  code_qualifying_subtotal: number;
  discount_amount: number;
  subtotal_after_discount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePreview(value: unknown): DiscountPreview | null {
  if (!isRecord(value)) {
    return null;
  }

  const code = typeof value.code === "string" ? value.code : "";
  const currency =
    typeof value.currency === "string" ? value.currency : "";
  const subtotalBefore = Number(value.subtotal_before_discount);
  const qualifyingSubtotal = Number(value.code_qualifying_subtotal);
  const discountAmount = Number(value.discount_amount);
  const subtotalAfter = Number(value.subtotal_after_discount);

  if (
    !code ||
    !currency ||
    !Number.isFinite(subtotalBefore) ||
    !Number.isFinite(qualifyingSubtotal) ||
    !Number.isFinite(discountAmount) ||
    !Number.isFinite(subtotalAfter)
  ) {
    return null;
  }

  return {
    code,
    currency,
    subtotal_before_discount: subtotalBefore,
    code_qualifying_subtotal: qualifyingSubtotal,
    discount_amount: discountAmount,
    subtotal_after_discount: subtotalAfter,
  };
}

export async function requestDiscountPreview(
  items: DiscountPreviewItem[],
  code: string,
) {
  const response = await fetch("/api/checkout/discount-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items, code }),
  });

  const payload: unknown = await response.json().catch(() => null);
  const error =
    isRecord(payload) && typeof payload.error === "string"
      ? payload.error
      : "تعذر التحقق من كود الخصم.";

  if (!response.ok || !isRecord(payload) || payload.success !== true) {
    throw new Error(error);
  }

  const preview = parsePreview(payload.preview);

  if (!preview) {
    throw new Error("تعذر قراءة معاينة الخصم من الخادم.");
  }

  return preview;
}
