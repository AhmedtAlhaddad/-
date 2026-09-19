export function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ar-LY", { maximumFractionDigits: 2 }).format(value)} د.ل`;
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
