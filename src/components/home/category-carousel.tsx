"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { HomepageCategory } from "@/types/category";

const ROTATION_INTERVAL_MS = 2500;

export function CategoryCarousel({
  categories,
}: {
  categories: HomepageCategory[];
}) {
  const [frame, setFrame] = useState(0);
  const [failedImages, setFailedImages] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    if (
      !categories.some(
        (category) => category.images.length > 1,
      )
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setFrame((current) => current + 1);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [categories]);

  return (
    <div className="category-grid">
      {categories.map((category) => {
        const availableImages = category.images.filter(
          (image) => !failedImages.has(image),
        );
        const image =
          availableImages[
            frame % Math.max(availableImages.length, 1)
          ];

        return (
          <Link
            href={category.href}
            className="category-card"
            key={category.href}
          >
            {image ? (
              <Image
                key={image}
                src={image}
                alt={category.name}
                fill
                sizes="(max-width: 700px) 50vw, 25vw"
                onError={() =>
                  setFailedImages((current) => {
                    const next = new Set(current);
                    next.add(image);
                    return next;
                  })
                }
              />
            ) : (
              <div className="category-image-placeholder">
                لا توجد صورة متاحة
              </div>
            )}

            <div className="category-shade" />

            <span>
              <b>{category.name}</b>
              <small>{category.description}</small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
