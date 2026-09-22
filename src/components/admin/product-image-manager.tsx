"use client";

import Image from "next/image";
import {
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";

import styles from "./product-image-manager.module.css";

type ProductImage = {
  id: string;
  product_id: string;
  variant_id: string | null;
  storage_path: string | null;
  external_url: string | null;
  alt_text_ar: string | null;
  alt_text_en: string | null;
  sort_order: number;
  is_primary: boolean;
};

type Variant = {
  id: string;
  sku: string;
  flavor_ar: string | null;
  weight_value: number | null;
  weight_unit: string | null;
  size_label_ar: string | null;
};

const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

const MAX_SOURCE_SIZE =
  12 * 1024 * 1024;

const MAX_DIMENSION =
  1600;

function variantLabel(
  variant: Variant,
) {
  const parts = [
    variant.sku,
    variant.flavor_ar,

    variant.weight_value !== null &&
    variant.weight_unit
      ? `${variant.weight_value}${variant.weight_unit}`
      : null,

    variant.size_label_ar,
  ].filter(Boolean);

  return parts.join(" — ");
}

function sortImages(
  images: ProductImage[],
) {
  return [...images].sort(
    (a, b) =>
      a.sort_order -
      b.sort_order,
  );
}

function createAltDrafts(
  images: ProductImage[],
  productName: string,
) {
  const result: Record<
    string,
    string
  > = {};

  for (
    const image of images
  ) {
    result[image.id] =
      image.alt_text_ar ??
      productName;
  }

  return result;
}

async function optimizeImage(
  file: File,
) {
  if (
    !ALLOWED_TYPES.has(
      file.type,
    )
  ) {
    throw new Error(
      `${file.name}: الصيغة غير مدعومة. استخدم JPG أو PNG أو WebP.`,
    );
  }

  if (
    file.size >
    MAX_SOURCE_SIZE
  ) {
    throw new Error(
      `${file.name}: حجم الصورة أكبر من 12MB.`,
    );
  }

  const bitmap =
    await createImageBitmap(
      file,
    );

  try {
    const largest =
      Math.max(
        bitmap.width,
        bitmap.height,
      );

    const scale =
      largest >
      MAX_DIMENSION
        ? MAX_DIMENSION /
          largest
        : 1;

    const width =
      Math.max(
        1,
        Math.round(
          bitmap.width *
            scale,
        ),
      );

    const height =
      Math.max(
        1,
        Math.round(
          bitmap.height *
            scale,
        ),
      );

    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d",
      );

    if (!context) {
      throw new Error(
        "تعذر تجهيز الصورة.",
      );
    }

    context.drawImage(
      bitmap,
      0,
      0,
      width,
      height,
    );

    const blob =
      await new Promise<Blob>(
        (
          resolve,
          reject,
        ) => {
          canvas.toBlob(
            (result) => {
              if (result) {
                resolve(
                  result,
                );
              } else {
                reject(
                  new Error(
                    "تعذر تحويل الصورة إلى WebP.",
                  ),
                );
              }
            },

            "image/webp",
            0.86,
          );
        },
      );

    return blob;
  } finally {
    bitmap.close();
  }
}

export function ProductImageManager({
  productId,
  productName,
  variants,
  images,
}: {
  productId: string;
  productName: string;
  variants: Variant[];
  images: ProductImage[];
}) {
  const router =
    useRouter();

  async function refreshCatalogAndPage() {
    try {
      const response =
        await fetch(
          "/api/admin/catalog/revalidate",
          {
            method:
              "POST",
          },
        );

      if (!response.ok) {
        console.error(
          "Catalog revalidation failed:",
          response.status,
        );
      }
    } catch (
      caughtError
    ) {
      console.error(
        "Catalog revalidation failed:",
        caughtError,
      );
    }

    router.refresh();
  }

  const fileRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    supabase,
  ] =
    useState(
      () =>
        createClient(),
    );

  const [
    orderedImages,
    setOrderedImages,
  ] =
    useState<
      ProductImage[]
    >(
      () =>
        sortImages(
          images,
        ),
    );

  const [
    altDrafts,
    setAltDrafts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      () =>
        createAltDrafts(
          images,
          productName,
        ),
    );

  const [
    targetVariantId,
    setTargetVariantId,
  ] =
    useState("");

  const [
    altText,
    setAltText,
  ] =
    useState(
      productName,
    );

  const [
    makePrimary,
    setMakePrimary,
  ] =
    useState(
      !images.some(
        (image) =>
          image.is_primary,
      ),
    );

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    orderSaving,
    setOrderSaving,
  ] =
    useState(false);

  const [
    busyImage,
    setBusyImage,
  ] =
    useState<
      string | null
    >(null);

  const [
    draggedImageId,
    setDraggedImageId,
  ] =
    useState<
      string | null
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  function publicUrl(
    image: ProductImage,
  ) {
    if (
      image.external_url
    ) {
      return image.external_url;
    }

    if (
      !image.storage_path
    ) {
      return null;
    }

    return supabase.storage
      .from(
        "product-images",
      )
      .getPublicUrl(
        image.storage_path,
      ).data.publicUrl;
  }

  async function upload() {
    setError(null);
    setMessage(null);

    const files =
      Array.from(
        fileRef.current
          ?.files ??
          [],
      );

    if (
      files.length === 0
    ) {
      setError(
        "اختر صورة واحدة على الأقل.",
      );

      return;
    }

    if (
      files.length > 8
    ) {
      setError(
        "يمكن رفع 8 صور كحد أقصى في كل مرة.",
      );

      return;
    }

    setUploading(true);

    const uploadedPaths:
      string[] = [];

    const insertedIds:
      string[] = [];

    const previousPrimaryId =
      orderedImages.find(
        (image) =>
          image.is_primary,
      )?.id ?? null;

    try {
      let nextSort =
        orderedImages.reduce(
          (
            maximum,
            image,
          ) =>
            Math.max(
              maximum,
              image.sort_order,
            ),
          0,
        ) + 1;

      const shouldPrimary =
        targetVariantId === "" &&
        (
          makePrimary ||
          !orderedImages.some(
            (image) =>
              image.is_primary,
          )
        );

      for (
        let index = 0;
        index <
        files.length;
        index += 1
      ) {
        const file =
          files[index];

        const optimized =
          await optimizeImage(
            file,
          );

        const filename =
          `${crypto.randomUUID()}.webp`;

        const storagePath =
          targetVariantId
            ? `products/${productId}/variants/${targetVariantId}/${filename}`
            : `products/${productId}/global/${filename}`;

        const {
          error:
            uploadError,
        } =
          await supabase.storage
            .from(
              "product-images",
            )
            .upload(
              storagePath,
              optimized,
              {
                contentType:
                  "image/webp",

                cacheControl:
                  "31536000",

                upsert:
                  false,
              },
            );

        if (
          uploadError
        ) {
          throw new Error(
            uploadError.message,
          );
        }

        uploadedPaths.push(
          storagePath,
        );

        const {
          data:
            insertedImage,
          error:
            imageInsertError,
        } =
          await supabase
            .from(
              "product_images",
            )
            .insert({
              product_id:
                productId,

              variant_id:
                targetVariantId ||
                null,

              storage_path:
                storagePath,

              external_url:
                null,

              alt_text_ar:
                altText.trim() ||
                productName,

              alt_text_en:
                null,

              sort_order:
                nextSort,

              is_primary:
                false,
            })
            .select("id")
            .single();

        if (
          imageInsertError ||
          !insertedImage
        ) {
          await supabase.storage
            .from(
              "product-images",
            )
            .remove([
              storagePath,
            ]);

          throw new Error(
            imageInsertError?.message ??
              "تعذر تسجيل الصورة في قاعدة البيانات.",
          );
        }

        insertedIds.push(
          insertedImage.id,
        );

        nextSort += 1;
      }

      if (
        shouldPrimary &&
        insertedIds.length >
          0
      ) {
        const {
          error:
            resetError,
        } =
          await supabase
            .from(
              "product_images",
            )
            .update({
              is_primary:
                false,
            })
            .eq(
              "product_id",
              productId,
            );

        if (
          resetError
        ) {
          throw new Error(
            resetError.message,
          );
        }

        const {
          error:
            primaryError,
        } =
          await supabase
            .from(
              "product_images",
            )
            .update({
              is_primary:
                true,
            })
            .eq(
              "id",
              insertedIds[0],
            )
            .eq(
              "product_id",
              productId,
            )
            .is(
              "variant_id",
              null,
            );

        if (
          primaryError
        ) {
          if (
            previousPrimaryId
          ) {
            await supabase
              .from(
                "product_images",
              )
              .update({
                is_primary:
                  true,
              })
              .eq(
                "id",
                previousPrimaryId,
              )
              .eq(
                "product_id",
                productId,
              );
          }

          throw new Error(
            primaryError.message,
          );
        }
      }

      if (
        fileRef.current
      ) {
        fileRef.current.value =
          "";
      }

      setMessage(
        files.length === 1
          ? "تم رفع الصورة بنجاح."
          : `تم رفع ${files.length} صور بنجاح.`,
      );

      setMakePrimary(
        false,
      );

      await refreshCatalogAndPage();
    } catch (
      caughtError
    ) {
      if (
        uploadedPaths.length >
        insertedIds.length
      ) {
        await supabase.storage
          .from(
            "product-images",
          )
          .remove(
            uploadedPaths.slice(
              insertedIds.length,
            ),
          );
      }

      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "تعذر رفع الصور.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function saveAlt(
    imageId: string,
  ) {
    setBusyImage(
      imageId,
    );

    setError(null);
    setMessage(null);

    try {
      const alt =
        (
          altDrafts[
            imageId
          ] ?? ""
        ).trim();

      const {
        error:
          updateError,
      } =
        await supabase
          .from(
            "product_images",
          )
          .update({
            alt_text_ar:
              alt ||
              productName,
          })
          .eq(
            "id",
            imageId,
          )
          .eq(
            "product_id",
            productId,
          );

      if (
        updateError
      ) {
        throw new Error(
          updateError.message,
        );
      }

      setMessage(
        "تم حفظ وصف الصورة.",
      );

      await refreshCatalogAndPage();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "تعذر حفظ وصف الصورة.",
      );
    } finally {
      setBusyImage(null);
    }
  }

  async function persistOrder(
    nextImages:
      ProductImage[],
  ) {
    setOrderSaving(true);
    setError(null);
    setMessage(null);

    try {
      for (
        let index = 0;
        index <
        nextImages.length;
        index += 1
      ) {
        const image =
          nextImages[index];

        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              "product_images",
            )
            .update({
              sort_order:
                index + 1,
            })
            .eq(
              "id",
              image.id,
            )
            .eq(
              "product_id",
              productId,
            );

        if (
          updateError
        ) {
          throw new Error(
            updateError.message,
          );
        }
      }

      setOrderedImages(
        nextImages.map(
          (
            image,
            index,
          ) => ({
            ...image,

            sort_order:
              index + 1,
          }),
        ),
      );

      setMessage(
        "تم حفظ ترتيب الصور.",
      );

      await refreshCatalogAndPage();
    } catch (
      caughtError
    ) {
      setOrderedImages(
        sortImages(
          images,
        ),
      );

      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "تعذر حفظ ترتيب الصور.",
      );
    } finally {
      setOrderSaving(false);
    }
  }

  async function moveImage(
    imageId: string,
    direction:
      | "up"
      | "down",
  ) {
    if (
      orderSaving
    ) {
      return;
    }

    const currentIndex =
      orderedImages.findIndex(
        (image) =>
          image.id ===
          imageId,
      );

    if (
      currentIndex < 0
    ) {
      return;
    }

    const nextIndex =
      direction === "up"
        ? currentIndex - 1
        : currentIndex + 1;

    if (
      nextIndex < 0 ||
      nextIndex >=
        orderedImages.length
    ) {
      return;
    }

    const next =
      [...orderedImages];

    const [
      moved,
    ] =
      next.splice(
        currentIndex,
        1,
      );

    next.splice(
      nextIndex,
      0,
      moved,
    );

    setOrderedImages(
      next,
    );

    await persistOrder(
      next,
    );
  }

  function dragStart(
    imageId: string,
  ) {
    if (
      orderSaving
    ) {
      return;
    }

    setDraggedImageId(
      imageId,
    );
  }

  function dragOver(
    event:
      DragEvent<HTMLElement>,
  ) {
    event.preventDefault();
  }

  async function dropImage(
    event:
      DragEvent<HTMLElement>,
    targetId: string,
  ) {
    event.preventDefault();

    if (
      !draggedImageId ||
      draggedImageId ===
        targetId ||
      orderSaving
    ) {
      setDraggedImageId(
        null,
      );

      return;
    }

    const sourceIndex =
      orderedImages.findIndex(
        (image) =>
          image.id ===
          draggedImageId,
      );

    const targetIndex =
      orderedImages.findIndex(
        (image) =>
          image.id ===
          targetId,
      );

    if (
      sourceIndex < 0 ||
      targetIndex < 0
    ) {
      setDraggedImageId(
        null,
      );

      return;
    }

    const next =
      [...orderedImages];

    const [
      moved,
    ] =
      next.splice(
        sourceIndex,
        1,
      );

    next.splice(
      targetIndex,
      0,
      moved,
    );

    setDraggedImageId(
      null,
    );

    setOrderedImages(
      next,
    );

    await persistOrder(
      next,
    );
  }

  async function setPrimary(
    imageId: string,
  ) {
    setBusyImage(
      imageId,
    );

    setError(null);
    setMessage(null);

    const previousPrimaryId =
      orderedImages.find(
        (image) =>
          image.is_primary,
      )?.id ?? null;

    try {
      const target =
        orderedImages.find(
          (image) =>
            image.id ===
            imageId,
        );

      if (
        !target ||
        target.variant_id
      ) {
        throw new Error(
          "الصورة الرئيسية يجب أن تكون صورة عامة للمنتج.",
        );
      }

      const {
        error:
          resetError,
      } =
        await supabase
          .from(
            "product_images",
          )
          .update({
            is_primary:
              false,
          })
          .eq(
            "product_id",
            productId,
          );

      if (
        resetError
      ) {
        throw new Error(
          resetError.message,
        );
      }

      const {
        error:
          primaryError,
      } =
        await supabase
          .from(
            "product_images",
          )
          .update({
            is_primary:
              true,
          })
          .eq(
            "id",
            imageId,
          )
          .eq(
            "product_id",
            productId,
          )
          .is(
            "variant_id",
            null,
          );

      if (
        primaryError
      ) {
        if (
          previousPrimaryId
        ) {
          await supabase
            .from(
              "product_images",
            )
            .update({
              is_primary:
                true,
            })
            .eq(
              "id",
              previousPrimaryId,
            )
            .eq(
              "product_id",
              productId,
            );
        }

        throw new Error(
          primaryError.message,
        );
      }

      setMessage(
        "تم تعيين الصورة الرئيسية.",
      );

      await refreshCatalogAndPage();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "تعذر تغيير الصورة الرئيسية.",
      );
    } finally {
      setBusyImage(null);
    }
  }

  async function deleteImage(
    image: ProductImage,
  ) {
    const confirmed =
      window.confirm(
        "هل تريد حذف هذه الصورة؟",
      );

    if (
      !confirmed
    ) {
      return;
    }

    setBusyImage(
      image.id,
    );

    setError(null);
    setMessage(null);

    try {
      const {
        error:
          deleteRowError,
      } =
        await supabase
          .from(
            "product_images",
          )
          .delete()
          .eq(
            "id",
            image.id,
          )
          .eq(
            "product_id",
            productId,
          );

      if (
        deleteRowError
      ) {
        throw new Error(
          deleteRowError.message,
        );
      }

      if (
        image.storage_path
      ) {
        const {
          error:
            storageDeleteError,
        } =
          await supabase.storage
            .from(
              "product-images",
            )
            .remove([
              image.storage_path,
            ]);

        if (
          storageDeleteError
        ) {
          console.warn(
            storageDeleteError.message,
          );
        }
      }

      if (
        image.is_primary
      ) {
        const {
          data:
            fallbackImage,
          error:
            fallbackError,
        } =
          await supabase
            .from(
              "product_images",
            )
            .select("id")
            .eq(
              "product_id",
              productId,
            )
            .is(
              "variant_id",
              null,
            )
            .order(
              "sort_order",
              {
                ascending: true,
              },
            )
            .limit(1)
            .maybeSingle();

        if (
          fallbackError
        ) {
          throw new Error(
            fallbackError.message,
          );
        }

        if (
          fallbackImage
        ) {
          const {
            error:
              primaryError,
          } =
            await supabase
              .from(
                "product_images",
              )
              .update({
                is_primary:
                  true,
              })
              .eq(
                "id",
                fallbackImage.id,
              );

          if (
            primaryError
          ) {
            throw new Error(
              primaryError.message,
            );
          }
        }
      }

      setMessage(
        "تم حذف الصورة.",
      );

      await refreshCatalogAndPage();
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "تعذر حذف الصورة.",
      );
    } finally {
      setBusyImage(null);
    }
  }

  const variantMap =
    new Map(
      variants.map(
        (variant) => [
          variant.id,
          variantLabel(
            variant,
          ),
        ],
      ),
    );

  return (
    <section
      className={
        styles.manager
      }
    >
      <div
        className={
          styles.header
        }
      >
        <div
          className={
            styles.headerCopy
          }
        >
          <span
            className={
              styles.eyebrow
            }
          >
            PRODUCT MEDIA
          </span>

          <h2>
            صور المنتج
          </h2>

          <p>
            ارفع الصور، اربطها
            بالخيارات / النسخ (Variants)، عدّل
            وصفها ورتبها بالسحب.
            الصور الجديدة تُحوّل
            تلقائيًا إلى WebP.
          </p>
        </div>

        {orderSaving && (
          <span
            className={
              styles.savingBadge
            }
          >
            جارٍ حفظ الترتيب...
          </span>
        )}
      </div>

      <div
        className={
          styles.uploadBox
        }
      >
        <div
          className={
            styles.grid
          }
        >
          <label
            className={
              styles.field
            }
          >
            <span
              className={
                styles.label
              }
            >
              مكان الصورة
            </span>

            <select
              className={
                styles.select
              }
              value={
                targetVariantId
              }
              onChange={(
                event,
              ) => {
                const value =
                  event.target.value;

                setTargetVariantId(
                  value,
                );

                if (value) {
                  setMakePrimary(
                    false,
                  );
                }
              }}
            >
              <option value="">
                صورة عامة للمنتج
              </option>

              {variants.map(
                (variant) => (
                  <option
                    key={
                      variant.id
                    }
                    value={
                      variant.id
                    }
                  >
                    الخيار / النسخة (Variant) —{" "}
                    {variantLabel(
                      variant,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label
            className={
              styles.field
            }
          >
            <span
              className={
                styles.label
              }
            >
              وصف الصورة
            </span>

            <input
              className={
                styles.input
              }
              value={
                altText
              }
              onChange={(
                event,
              ) =>
                setAltText(
                  event.target.value,
                )
              }
              placeholder={
                productName
              }
            />
          </label>
        </div>

        <label
          className={
            styles.field
          }
        >
          <span
            className={
              styles.label
            }
          >
            اختر الصور
          </span>

          <input
            ref={
              fileRef
            }
            className={
              styles.fileInput
            }
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
          />
        </label>

        {!targetVariantId && (
          <label
            className={
              styles.checkbox
            }
          >
            <input
              type="checkbox"
              checked={
                makePrimary
              }
              onChange={(
                event,
              ) =>
                setMakePrimary(
                  event.target.checked,
                )
              }
            />

            اجعل أول صورة مرفوعة
            هي الصورة الرئيسية
          </label>
        )}

        <div
          className={
            styles.note
          }
        >
          الصور العامة:
          {" "}
          products/{productId}/global/
          <br />

          صور الخيار / النسخة (Variant):
          {" "}
          products/{productId}/variants/VARIANT_UUID/
        </div>

        <button
          type="button"
          className={
            styles.uploadButton
          }
          disabled={
            uploading
          }
          onClick={
            upload
          }
        >
          {uploading
            ? "جارٍ تجهيز ورفع الصور..."
            : "رفع الصور"}
        </button>
      </div>

      {message && (
        <div
          className={
            styles.message
          }
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className={
            styles.error
          }
          role="alert"
        >
          {error}
        </div>
      )}

      {orderedImages.length ===
      0 ? (
        <div
          className={
            styles.empty
          }
        >
          لا توجد صور لهذا
          المنتج بعد.
        </div>
      ) : (
        <>
          <div
            className={
              styles.reorderHint
            }
          >
            اسحب أي بطاقة لتغيير
            ترتيب الصور، أو استخدم
            الأسهم ↑ ↓.
          </div>

          <div
            className={
              styles.gallery
            }
          >
            {orderedImages.map(
              (
                image,
                index,
              ) => {
                const src =
                  publicUrl(
                    image,
                  );

                return (
                  <article
                    key={
                      image.id
                    }
                    className={`${styles.imageCard} ${
                      draggedImageId ===
                      image.id
                        ? styles.dragging
                        : ""
                    }`}
                    draggable={
                      !orderSaving
                    }
                    onDragStart={() =>
                      dragStart(
                        image.id,
                      )
                    }
                    onDragOver={
                      dragOver
                    }
                    onDrop={(
                      event,
                    ) =>
                      dropImage(
                        event,
                        image.id,
                      )
                    }
                    onDragEnd={() =>
                      setDraggedImageId(
                        null,
                      )
                    }
                  >
                    <div
                      className={
                        styles.preview
                      }
                    >
                      <div
                        className={
                          styles.orderBadge
                        }
                      >
                        {index +
                          1}
                      </div>

                      {image.is_primary && (
                        <span
                          className={
                            styles.primaryBadge
                          }
                        >
                          الرئيسية
                        </span>
                      )}

                      {image.variant_id && (
                        <span
                          className={
                            styles.variantBadge
                          }
                        >
                          {variantMap.get(
                            image.variant_id,
                          ) ??
                            "الخيار / النسخة (Variant)"}
                        </span>
                      )}

                      {src &&
                      !image.external_url ? (
                        <Image
                          src={
                            src
                          }
                          alt={
                            image.alt_text_ar ??
                            productName
                          }
                          fill
                          className={
                            styles.image
                          }
                          sizes="(max-width: 460px) 100vw, (max-width: 760px) 50vw, 25vw"
                        />
                      ) : (
                        <div
                          className={
                            styles.external
                          }
                        >
                          {image.external_url
                            ? "صورة خارجية"
                            : "الصورة غير متاحة"}
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        styles.cardBody
                      }
                    >
                      <label
                        className={
                          styles.field
                        }
                      >
                        <span
                          className={
                            styles.label
                          }
                        >
                          Alt Text
                        </span>

                        <input
                          className={
                            styles.altInput
                          }
                          value={
                            altDrafts[
                              image.id
                            ] ??
                            ""
                          }
                          onChange={(
                            event,
                          ) =>
                            setAltDrafts(
                              (
                                current,
                              ) => ({
                                ...current,

                                [image.id]:
                                  event.target.value,
                              }),
                            )
                          }
                        />
                      </label>

                      <button
                        type="button"
                        className={
                          styles.saveAltButton
                        }
                        disabled={
                          busyImage ===
                          image.id
                        }
                        onClick={() =>
                          saveAlt(
                            image.id,
                          )
                        }
                      >
                        حفظ الوصف
                      </button>

                      <div
                        className={
                          styles.path
                        }
                        title={
                          image.storage_path ??
                          image.external_url ??
                          ""
                        }
                      >
                        {image.storage_path ??
                          image.external_url ??
                          "—"}
                      </div>

                      <div
                        className={
                          styles.orderActions
                        }
                      >
                        <button
                          type="button"
                          className={
                            styles.orderButton
                          }
                          disabled={
                            index ===
                              0 ||
                            orderSaving
                          }
                          onClick={() =>
                            moveImage(
                              image.id,
                              "up",
                            )
                          }
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          className={
                            styles.orderButton
                          }
                          disabled={
                            index ===
                              orderedImages.length -
                                1 ||
                            orderSaving
                          }
                          onClick={() =>
                            moveImage(
                              image.id,
                              "down",
                            )
                          }
                        >
                          ↓
                        </button>
                      </div>

                      <div
                        className={
                          styles.actions
                        }
                      >
                        <button
                          type="button"
                          className={
                            styles.primaryButton
                          }
                          disabled={
                            Boolean(
                              image.variant_id,
                            ) ||
                            image.is_primary ||
                            busyImage ===
                              image.id
                          }
                          onClick={() =>
                            setPrimary(
                              image.id,
                            )
                          }
                        >
                          {image.is_primary
                            ? "رئيسية"
                            : "تعيين رئيسية"}
                        </button>

                        <button
                          type="button"
                          className={
                            styles.deleteButton
                          }
                          disabled={
                            busyImage ===
                            image.id
                          }
                          onClick={() =>
                            deleteImage(
                              image,
                            )
                          }
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </>
      )}
    </section>
  );
}
