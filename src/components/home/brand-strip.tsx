"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Brand } from "@/types/brand";

const MIN_BRAND_WIDTH = 150;

export function BrandStrip({
  brands,
}: {
  brands: Brand[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(
    Math.min(brands.length, 5),
  );
  const [offset, setOffset] = useState(0);
  const [failedLogos, setFailedLogos] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateVisibleCount = () => {
      const nextCount = Math.max(
        1,
        Math.min(
          brands.length,
          Math.floor(
            container.clientWidth / MIN_BRAND_WIDTH,
          ),
        ),
      );

      setVisibleCount(nextCount);
      setOffset(
        brands.length > nextCount
          ? Math.floor(
              Math.random() * brands.length,
            )
          : 0,
      );
    };

    const frame = window.requestAnimationFrame(
      updateVisibleCount,
    );

    const observer = new ResizeObserver(
      updateVisibleCount,
    );
    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [brands.length]);

  const visibleBrands = useMemo(() => {
    if (visibleCount >= brands.length) {
      return brands;
    }

    return Array.from(
      { length: visibleCount },
      (_, index) => brands[(offset + index) % brands.length],
    );
  }, [brands, offset, visibleCount]);

  if (brands.length === 0) {
    return null;
  }

  return (
    <div className="brand-strip">
      <div
        className="container brand-strip-grid"
        ref={containerRef}
      >
        {visibleBrands.map((brand) => {
          const logo = brand.logo;

          return (
            <span key={brand.id}>
              {logo &&
              !failedLogos.has(logo) ? (
                <Image
                  src={logo}
                  alt={brand.name}
                  width={120}
                  height={42}
                  sizes="120px"
                  onError={() =>
                    setFailedLogos((current) => {
                      const next = new Set(current);
                      next.add(logo);
                      return next;
                    })
                  }
                />
              ) : (
                brand.name
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
