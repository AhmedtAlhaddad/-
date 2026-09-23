export type LibyaCity = {
  name: string;
};

// Curated from GeoNames populated-place records for Libya (LY), keeping
// independent cities and delivery towns while excluding PPLX neighbourhoods,
// airports, mountains, and administrative-only feature names.
export const LIBYA_CITIES: readonly LibyaCity[] = [
  { name: "طرابلس" },
  { name: "بنغازي" },
  { name: "مصراتة" },
  { name: "سرت" },
  { name: "سبها" },
  { name: "الزاوية" },
  { name: "زليتن" },
  { name: "الخمس" },
  { name: "طبرق" },
  { name: "درنة" },
  { name: "أجدابيا" },
  { name: "البيضاء" },
  { name: "غريان" },
  { name: "ترهونة" },
  { name: "صبراتة" },
  { name: "زوارة" },
  { name: "صرمان" },
  { name: "العجيلات" },
  { name: "الجميل" },
  { name: "رقدالين" },
  { name: "نالوت" },
  { name: "يفرن" },
  { name: "غدامس" },
  { name: "بني وليد" },
  { name: "هون" },
  { name: "ودان" },
  { name: "مرزق" },
  { name: "أوباري" },
  { name: "الكفرة" },
  { name: "القطرون" },
  { name: "براك" },
  { name: "الشاطئ" },
  { name: "المرج" },
  { name: "شحات" },
  { name: "القبة" },
  { name: "الأبيار" },
  { name: "تازربو" },
  { name: "الجغبوب" },
] as const;

function normalizeCity(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي");
}

const normalizedCityNames = new Map(
  LIBYA_CITIES.map((city) => [normalizeCity(city.name), city.name]),
);

export function findLibyaCity(value: string) {
  return normalizedCityNames.get(normalizeCity(value)) ?? null;
}
