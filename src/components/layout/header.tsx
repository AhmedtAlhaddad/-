"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";
import { goalOptions } from "@/lib/catalog-query";
import type { NavigationCategory } from "@/types/category";

type NavigationGroup = {
  id: string;
  label: string;
  href: string;
  items: Array<{ label: string; href: string }>;
};

function shopCategoryHref(
  slug: string,
  scope?: "supplements" | "accessories",
) {
  const params = new URLSearchParams();

  if (scope) {
    params.set("type", scope);
  }
  params.set("category", slug);

  return `/shop?${params.toString()}`;
}

function goalHref(goal: string) {
  const params = new URLSearchParams();
  params.set("goal", goal);
  return `/shop?${params.toString()}`;
}

export function AnnouncementBar() {
  return (
    <div className="announcement">
      شحن مجاني للطلبات فوق 2000 د.ل <span>•</span> منتجات أصلية 100%
    </div>
  );
}

export function Header({
  categories,
}: {
  categories: NavigationCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const { itemCount } = useCart();

  const groups: NavigationGroup[] = [
    {
      id: "supplements",
      label: "المكملات الغذائية",
      href: "/shop?type=supplements",
      items: categories
        .filter((category) => category.supplement)
        .map((category) => ({
          label: category.label,
          href: shopCategoryHref(category.slug, "supplements"),
        })),
    },
    {
      id: "goals",
      label: "اختر على حسب هدفك",
      href: "/#training-goals",
      items: goalOptions.map((goal) => ({
        label: goal,
        href: goalHref(goal),
      })),
    },
    {
      id: "categories",
      label: "تصفح الاصناف",
      href: "/#categories",
      items: categories.map((category) => ({
        label: category.label,
        href: shopCategoryHref(category.slug),
      })),
    },
    {
      id: "accessories",
      label: "إكسسوارات الرياضة",
      href: "/shop?type=accessories",
      items: categories
        .filter((category) => category.accessory)
        .map((category) => ({
          label: category.label,
          href: shopCategoryHref(category.slug, "accessories"),
        })),
    },
  ];

  const closeMobile = () => {
    setOpen(false);
    setMobileGroup(null);
  };

  return (
    <header className="site-header">
      <div className="container header-main">
        <button
          className="icon-button mobile-only"
          onClick={() => setOpen((value) => !value)}
          aria-label="فتح القائمة"
          aria-expanded={open}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        <Link href="/" className="brand" aria-label="عالم اللياقة - الرئيسية">
          <span className="brand-mark">ع</span>
          <span>عالم <b>اللياقة</b></span>
        </Link>

        <nav className="desktop-nav" aria-label="التنقل الرئيسي">
          {groups.map((group) => (
            <div className="nav-group" key={group.id}>
              <Link className="nav-group-link" href={group.href}>
                {group.label}
                <span className="nav-chevron" aria-hidden="true">⌄</span>
              </Link>
              {group.items.length > 0 && (
                <div className="nav-dropdown">
                  {group.items.map((item) => (
                    <Link href={item.href} key={`${group.id}-${item.href}`}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="icon-button search-link" href="/search" aria-label="البحث">
            <SearchIcon />
          </Link>
          <Link className="cart-link" href="/cart">
            <BagIcon />
            <span className="desktop-label">سلة التسوق</span>
            <b>{itemCount}</b>
          </Link>
        </div>
      </div>

      {open && (
        <nav className="mobile-nav" aria-label="قائمة الجوال">
          {groups.map((group) => {
            const expanded = mobileGroup === group.id;

            return (
              <div className="mobile-nav-group" key={group.id}>
                <div className="mobile-nav-row">
                  <Link onClick={closeMobile} href={group.href}>
                    {group.label}
                  </Link>
                  {group.items.length > 0 && (
                    <button
                      type="button"
                      aria-label={`عرض خيارات ${group.label}`}
                      aria-expanded={expanded}
                      onClick={() =>
                        setMobileGroup(expanded ? null : group.id)
                      }
                    >
                      <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="mobile-subnav">
                    {group.items.map((item) => (
                      <Link
                        onClick={closeMobile}
                        href={item.href}
                        key={`${group.id}-${item.href}`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </header>
  );
}
