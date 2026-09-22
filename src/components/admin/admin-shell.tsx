"use client";

import Link from "next/link";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import type {
  ReactNode,
} from "react";

import styles from "./admin-shell.module.css";

const navItems = [
  {
    href: "/admin",
    label: "الرئيسية",
    icon: "⌂",
  },
  {
    href: "/admin/products",
    label: "المنتجات",
    icon: "▦",
  },
  {
    href: "/admin/brands",
    label: "العلامات",
    icon: "B",
  },
  {
    href: "/admin/categories",
    label: "التصنيفات",
    icon: "C",
  },
  {
    href: "/admin/orders",
    label: "الطلبات",
    icon: "▤",
  },
  {
    href: "/admin/inventory",
    label: "المخزون",
    icon: "◫",
  },
  {
    href: "/admin/discounts",
    label: "أكواد الخصم",
    icon: "%",
  },
  {
    href: "/admin/athletes",
    label: "الرياضيون",
    icon: "◎",
  },
  {
    href: "/admin/commissions",
    label: "العمولات",
    icon: "◈",
  },
];

function isActive(
  pathname: string,
  href: string,
) {
  if (
    href === "/admin"
  ) {
    return pathname ===
      "/admin";
  }

  return pathname.startsWith(
    href,
  );
}

export function AdminShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  if (
    pathname ===
    "/admin/login"
  ) {
    return children;
  }

  async function signOut() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    } finally {
      router.replace(
        "/admin/login",
      );

      router.refresh();
    }
  }

  return (
    <div
      className={
        styles.shell
      }
    >
      <div
        className={
          styles.layout
        }
      >
        <aside
          className={
            styles.sidebar
          }
        >
          <div
            className={
              styles.brand
            }
          >
            <div
              className={
                styles.brandMark
              }
            >
              AL
            </div>

            <div
              className={
                styles.brandText
              }
            >
              <strong>
                عالم اللياقة
              </strong>

              <span>
                لوحة الإدارة
              </span>
            </div>
          </div>

          <nav
            className={
              styles.nav
            }
          >
            <div
              className={
                styles.navLabel
              }
            >
              إدارة المتجر
            </div>

            {navItems.map(
              (item) => {
                const active =
                  isActive(
                    pathname,
                    item.href,
                  );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className={`${styles.navLink} ${
                      active
                        ? styles.navLinkActive
                        : ""
                    }`}
                  >
                    <span
                      className={
                        styles.icon
                      }
                    >
                      {
                        item.icon
                      }
                    </span>

                    {
                      item.label
                    }
                  </Link>
                );
              },
            )}
          </nav>

          <div
            className={
              styles.sidebarBottom
            }
          >
            <Link
              href="/"
              className={
                styles.storeLink
              }
            >
              عرض المتجر ↗
            </Link>

            <button
              type="button"
              className={
                styles.signOut
              }
              onClick={
                signOut
              }
            >
              تسجيل الخروج
            </button>
          </div>
        </aside>

        <div
          className={
            styles.main
          }
        >
          <header
            className={
              styles.topbar
            }
          >
            <div
              className={
                styles.topbarTitle
              }
            >
              <strong>
                إدارة عالم اللياقة
              </strong>

              <span>
                Staging Environment
              </span>
            </div>

            <div
              className={
                styles.adminBadge
              }
            >
              Admin
            </div>
          </header>

          <nav
            className={
              styles.mobileMenu
            }
          >
            {navItems.map(
              (item) => {
                const active =
                  isActive(
                    pathname,
                    item.href,
                  );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className={`${styles.navLink} ${
                      active
                        ? styles.navLinkActive
                        : ""
                    }`}
                  >
                    {
                      item.label
                    }
                  </Link>
                );
              },
            )}
          </nav>

          <div
            className={
              styles.content
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
