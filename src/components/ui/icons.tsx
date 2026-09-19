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
export function StarIcon(props: IconProps) { return <svg {...base} {...props}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>; }
export function CheckIcon(props: IconProps) { return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>; }
export function FilterIcon(props: IconProps) { return <svg {...base} {...props}><path d="M4 6h16M7 12h10M10 18h4"/></svg>; }
export function CloseIcon(props: IconProps) { return <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>; }
export function BoltIcon(props: IconProps) { return <svg {...base} {...props}><path d="m13 2-8 12h6l-1 8 9-13h-6V2Z"/></svg>; }
