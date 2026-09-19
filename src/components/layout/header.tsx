"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";

const nav = [
  ["المكملات الغذائية", "/shop"],
  ["أهداف التدريب", "/shop"],
  ["الصحة العامة", "/shop"],
  ["إكسسوارات اللياقة", "/shop"],
];

export function AnnouncementBar() {
  return <div className="announcement">شحن مجاني للطلبات فوق 300 د.ل <span>•</span> منتجات أصلية 100%</div>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();
  return (
    <>
      <header className="site-header">
        <div className="container header-main">
          <button className="icon-button mobile-only" onClick={() => setOpen((value) => !value)} aria-label="فتح القائمة" aria-expanded={open}>{open ? <CloseIcon /> : <MenuIcon />}</button>
          <Link href="/" className="brand" aria-label="عالم اللياقة - الرئيسية"><span className="brand-mark">ع</span><span>عالم <b>اللياقة</b></span></Link>
          <nav className="desktop-nav" aria-label="التنقل الرئيسي">
            {nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
          </nav>
          <div className="header-actions">
            <Link className="icon-button" href="/search" aria-label="البحث"><SearchIcon /></Link>
            <Link className="cart-link" href="/cart"><BagIcon /><span className="desktop-label">سلة التسوق</span><b>{itemCount}</b></Link>
          </div>
        </div>
        {open && <nav className="mobile-nav" aria-label="قائمة الجوال">{nav.map(([label, href]) => <Link onClick={() => setOpen(false)} key={label} href={href}>{label}</Link>)}</nav>}
      </header>
    </>
  );
}
