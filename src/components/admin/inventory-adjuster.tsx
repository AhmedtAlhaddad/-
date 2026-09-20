"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import styles from "./admin-inventory.module.css";

type AdjustmentDirection =
  | "add"
  | "remove";

type AdjustmentReason =
  | "restock"
  | "manual_adjustment"
  | "correction";

type Props = {
  variantId: string;
  currentStock: number;
};

export function InventoryAdjuster({
  variantId,
  currentStock,
}: Props) {
  const router =
    useRouter();

  const [
    displayedStock,
    setDisplayedStock,
  ] =
    useState(
      currentStock,
    );

  const [
    direction,
    setDirection,
  ] =
    useState<
      AdjustmentDirection
    >("add");

  const [
    amount,
    setAmount,
  ] =
    useState("1");

  const [
    reason,
    setReason,
  ] =
    useState<
      AdjustmentReason
    >(
      "manual_adjustment",
    );

  const [
    note,
    setNote,
  ] =
    useState("");

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    isError,
    setIsError,
  ] =
    useState(false);

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setIsError(false);

    const parsed =
      Number(amount);

    if (
      !Number.isInteger(
        parsed,
      ) ||
      parsed <= 0
    ) {
      setIsError(true);
      setMessage(
        "أدخل كمية صحيحة أكبر من صفر.",
      );
      return;
    }

    const quantityChange =
      direction === "remove"
        ? -parsed
        : parsed;

    if (
      quantityChange < 0 &&
      Math.abs(
        quantityChange,
      ) > displayedStock
    ) {
      setIsError(true);
      setMessage(
        "الكمية المطلوب خصمها أكبر من المخزون الحالي.",
      );
      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/admin/inventory/adjust",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                variant_id:
                  variantId,

                quantity_change:
                  quantityChange,

                reason,

                note,
              }),
          },
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          stock_quantity?: number;
          warning?: string | null;
          error?: string;
        };

      if (
        !response.ok ||
        result.success !== true ||
        typeof result.stock_quantity !==
          "number"
      ) {
        throw new Error(
          result.error ||
            "تعذر تحديث المخزون.",
        );
      }

      setDisplayedStock(
        result.stock_quantity,
      );

      setNote("");

      setMessage(
        result.warning ||
          `تم تحديث المخزون إلى ${result.stock_quantity}.`,
      );

      setIsError(false);

      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر تحديث المخزون.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <details
      className={
        styles.adjuster
      }
    >
      <summary>
        تعديل
      </summary>

      <form
        onSubmit={submit}
        className={
          styles.adjustForm
        }
      >
        <div
          className={
            styles.adjustCurrent
          }
        >
          الرصيد الحالي:
          {" "}
          <strong>
            {displayedStock}
          </strong>
        </div>

        <div
          className={
            styles.adjustGrid
          }
        >
          <label>
            <span>
              العملية
            </span>

            <select
              value={
                direction
              }
              onChange={(
                event,
              ) =>
                setDirection(
                  event
                    .target
                    .value as
                    AdjustmentDirection,
                )
              }
            >
              <option value="add">
                إضافة
              </option>

              <option value="remove">
                خصم
              </option>
            </select>
          </label>

          <label>
            <span>
              الكمية
            </span>

            <input
              type="number"
              min="1"
              step="1"
              max="100000"
              value={amount}
              onChange={(
                event,
              ) =>
                setAmount(
                  event
                    .target
                    .value,
                )
              }
            />
          </label>

          <label>
            <span>
              السبب
            </span>

            <select
              value={reason}
              onChange={(
                event,
              ) =>
                setReason(
                  event
                    .target
                    .value as
                    AdjustmentReason,
                )
              }
            >
              <option value="restock">
                توريد مخزون
              </option>

              <option value="manual_adjustment">
                تعديل يدوي
              </option>

              <option value="correction">
                تصحيح
              </option>
            </select>
          </label>
        </div>

        <label
          className={
            styles.noteLabel
          }
        >
          <span>
            ملاحظة اختيارية
          </span>

          <input
            type="text"
            maxLength={500}
            value={note}
            placeholder="مثال: استلام شحنة جديدة"
            onChange={(
              event,
            ) =>
              setNote(
                event
                  .target
                  .value,
              )
            }
          />
        </label>

        {message && (
          <p
            className={
              isError
                ? styles.adjustError
                : styles.adjustSuccess
            }
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className={
            styles.saveButton
          }
        >
          {saving
            ? "جارٍ الحفظ..."
            : "حفظ التعديل"}
        </button>
      </form>
    </details>
  );
}