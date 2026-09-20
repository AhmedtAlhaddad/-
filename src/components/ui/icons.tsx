import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function SearchIcon(props: IconProps) { return <svg {...base} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>; }
export function BagIcon(props: IconProps) { return <svg {...base} {...props}><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>; }
export function MenuIcon(props: IconProps) { return <svg {...base} {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>; }
export function ArrowIcon(props: IconProps) { return <svg {...base} {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>; }
export function PlusIcon(props: IconProps) { return <svg {...base} {...props}><path d="M12 5v14M5 12h14"/></svg>; }
export function MinusIcon(props: IconProps) { return <svg {...base} {...props}><path d="M5 12h14"/></svg>; }
export function TrashIcon(props: IconProps) { return <svg {...base} {...props}><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg>; }
export function CheckIcon(props: IconProps) { return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>; }
export function FilterIcon(props: IconProps) { return <svg {...base} {...props}><path d="M4 6h16M7 12h10M10 18h4"/></svg>; }
export function CloseIcon(props: IconProps) { return <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>; }
export function BoltIcon(props: IconProps) { return <svg {...base} {...props}><path d="m13 2-8 12h6l-1 8 9-13h-6V2Z"/></svg>; }
export function TikTokIcon(props: IconProps) { return <svg {...base} {...props}><path d="M15 4c.6 2.2 1.9 3.5 4 4v3a8 8 0 0 1-4-1.2V16a5 5 0 1 1-5-5c.4 0 .7 0 1 .1v3.1a2 2 0 1 0 1 1.8V4h3Z"/></svg>; }
export function FacebookIcon(props: IconProps) { return <svg {...base} {...props}><path d="M14 8h3V4h-3a5 5 0 0 0-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9a1 1 0 0 1 1-1Z"/></svg>; }
export function InstagramIcon(props: IconProps) { return <svg {...base} {...props}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>; }
export function WhatsAppIcon(props: IconProps) { return <svg {...base} {...props}><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.3 2.6 1.9 4.2 4.5 5l1-1.2 1.7.8c.2.1.3.4.2.6-.4 1.1-1.3 1.8-2.4 1.7-3.5-.4-6.5-3.4-6.9-6.9C7 7.4 7.7 6.5 8.8 6.1c.2-.1.5 0 .6.2l.8 1.7L9 8.5Z"/></svg>; }
