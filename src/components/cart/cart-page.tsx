"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { ArrowIcon, BagIcon, MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/utils";

export function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const applyCode = () => {
    setMessage(code.trim() ? "سيتم التحقق من الكود وحساب قيمته الموثوقة عند تأكيد الطلب." : "أدخل كودًا أولًا.");
  };
  return <main className="cart-page">
    <div className="container cart-heading"><div><span className="cart-title-icon"><BagIcon/></span><div><h1>سلة التسوق</h1><p>لديك {items.length} منتجات في سلتك</p></div></div><Link href="/shop">واصل التسوق <ArrowIcon/></Link></div>
    <div className="container cart-layout">
      <section className="cart-items" aria-label="منتجات السلة">{items.length ? items.map((item) => { const variant = item.product.variants.find((entry) => entry.id === item.variantId) ?? item.product.variants[0]; return <article className="cart-item" key={item.id}><div className="cart-item-image"><Image src={item.product.images[0]} alt={item.product.shortName} fill sizes="120px"/></div><div className="cart-item-main"><small>{item.product.category}</small><Link href={`/products/${item.product.slug}`}><h2>{item.product.shortName}</h2></Link><p>{variant.flavor} · {variant.weight}</p><strong>{formatPrice(variant.price)}</strong></div><div className="cart-item-actions"><button className="remove-button" onClick={() => removeItem(item.id)} aria-label={`حذف ${item.product.shortName}`}><TrashIcon/></button><div className="quantity"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="تقليل الكمية"><MinusIcon/></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="زيادة الكمية"><PlusIcon/></button></div><div><small>المجموع</small><b>{formatPrice(variant.price * item.quantity)}</b></div></div></article> }) : <div className="empty-state"><BagIcon/><h2>سلتك فارغة</h2><p>ابدأ بإضافة منتجات تدعم هدفك.</p><Link className="button primary" href="/shop">تسوق الآن</Link></div>}</section>
      <aside className="order-summary"><h2>ملخص الطلب</h2><label htmlFor="discount">كود الخصم</label><div className="discount-input"><input id="discount" value={code} onChange={(event) => { setCode(event.target.value); setMessage(""); }} placeholder="أدخل الكود"/><button onClick={applyCode}>تحقق</button></div>{message && <p aria-live="polite" className={code.trim() ? "code-success" : "code-error"}>{message}</p>}<dl><div><dt>المجموع الفرعي المعروض</dt><dd>{formatPrice(subtotal)}</dd></div><div><dt>الشحن</dt><dd className="green">يُحدد عند التأكيد</dd></div><div><dt>الضرائب</dt><dd>تُحسب في الخادم</dd></div></dl><div className="order-total"><span><b>الإجمالي المبدئي</b><small>يعيد الخادم حساب السعر والخصم والإجمالي</small></span><strong>{formatPrice(subtotal)}</strong></div><button disabled={!items.length} className="button primary checkout-button">إتمام الطلب <ArrowIcon/></button><div className="payment-marks"><span>VISA</span><span>MC</span><span>مدى</span></div>
        {/* Display only. The backend loads admin-configured code percentages and recomputes prices, qualifying scope, discounts, totals, and commissions. */}
      </aside>
    </div>
    <div className="container cart-assurances"><div>♢ <span><b>دفع آمن</b><small>حماية بياناتك بالكامل</small></span></div><div>% <span><b>أفضل سعر</b><small>قيمة تستحق ثقتك</small></span></div></div>
  </main>;
}
