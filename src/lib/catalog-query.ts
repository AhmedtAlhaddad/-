import type {
  TrainingGoal,
} from "@/types/product";

export const SHOP_PAGE_SIZE = 24;
export const SEARCH_PAGE_SIZE = 20;

export const goalOptions: TrainingGoal[] = [
  "بناء عضلات",
  "زيادة الوزن وقدرة التحمل",
  "حرق الدهون وانقاص الوزن",
];

export const sortOptions = [
  "featured",
  "price-asc",
  "price-desc",
] as const;

export type CatalogSort =
  (typeof sortOptions)[number];

export type ProductScope =
  | "supplements"
  | "accessories";

export type ShopQuery = {
  categories: string[];
  goals: TrainingGoal[];
  available: boolean;
  sort: CatalogSort;
  productScope: ProductScope | null;
  page: number;
};

type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

const trainingGoals: Record<
  TrainingGoal,
  string[]
> = {
  "بناء عضلات": [
    "muscle-support",
    "muscle-building",
  ],
  "زيادة الوزن وقدرة التحمل": [
    "energy-endurance",
    "energy",
  ],
  "حرق الدهون وانقاص الوزن": ["weight-management"],
};

function values(
  value: string | string[] | undefined,
) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function normalizePage(
  value: string | string[] | undefined,
) {
  const raw = Array.isArray(value)
    ? value[0]
    : value;

  if (!raw || !/^\d+$/.test(raw)) {
    return 1;
  }

  const page = Number(raw);

  return Number.isSafeInteger(page) && page > 0
    ? Math.min(page, 100_000)
    : 1;
}

export function normalizeShopQuery(
  params: RawSearchParams,
  activeCategorySlugs: string[],
): ShopQuery {
  const requestedCategories = values(
    params.category,
  );
  const requestedGoals = values(params.goal);
  const requestedSort = Array.isArray(params.sort)
    ? params.sort[0]
    : params.sort;
  const requestedScope = Array.isArray(params.type)
    ? params.type[0]
    : params.type;

  return {
    categories: activeCategorySlugs.filter((item) =>
      requestedCategories.includes(item),
    ),
    goals: goalOptions.filter((item) =>
      requestedGoals.includes(item),
    ),
    available: params.available === "1",
    sort:
      sortOptions.find(
        (item) => item === requestedSort,
      ) ?? "featured",
    productScope:
      requestedScope === "supplements" ||
      requestedScope === "accessories"
        ? requestedScope
        : null,
    page: normalizePage(params.page),
  };
}

export function isProductScopeCanonical(
  value: string | string[] | undefined,
  productScope: ProductScope | null,
) {
  if (!productScope) {
    return value === undefined;
  }

  return value === productScope;
}

export function areCategoryParamsCanonical(
  value: string | string[] | undefined,
  categories: string[],
) {
  const requested = values(value);

  return (
    requested.length === categories.length &&
    requested.every(
      (category, index) => category === categories[index],
    )
  );
}

export function normalizeSearchQuery(
  value: string | string[] | undefined,
) {
  const raw = Array.isArray(value) ? value[0] : value;

  return (raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export function toTrainingGoals(
  goals: TrainingGoal[],
) {
  return goals.flatMap((goal) => trainingGoals[goal]);
}

export function buildShopHref(query: ShopQuery) {
  const params = new URLSearchParams();

  query.categories.forEach((category) =>
    params.append("category", category),
  );
  query.goals.forEach((goal) =>
    params.append("goal", goal),
  );

  if (query.available) {
    params.set("available", "1");
  }

  if (query.sort !== "featured") {
    params.set("sort", query.sort);
  }

  if (query.productScope) {
    params.set("type", query.productScope);
  }

  if (query.page > 1) {
    params.set("page", String(query.page));
  }

  const search = params.toString();
  return search ? `/shop?${search}` : "/shop";
}

export function buildSearchHref(
  query: string,
  page = 1,
) {
  const params = new URLSearchParams();
  const normalized = normalizeSearchQuery(query);

  if (normalized) {
    params.set("q", normalized);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();
  return search ? `/search?${search}` : "/search";
}
