import type {
  ProductCategory,
  TrainingGoal,
} from "@/types/product";

export const SHOP_PAGE_SIZE = 24;
export const SEARCH_PAGE_SIZE = 20;

export const categoryOptions: ProductCategory[] = [
  "بروتين",
  "قبل التمرين",
  "كرياتين",
  "أحماض أمينية",
  "إكسسوارات اللياقة",
];

export const goalOptions: TrainingGoal[] = [
  "بناء العضلات",
  "الطاقة والتحمل",
  "إدارة الوزن",
  "الاستشفاء",
];

export const sortOptions = [
  "featured",
  "price-asc",
  "price-desc",
  "rating",
] as const;

export type CatalogSort =
  (typeof sortOptions)[number];

export type ShopQuery = {
  categories: ProductCategory[];
  goals: TrainingGoal[];
  available: boolean;
  sort: CatalogSort;
  page: number;
};

type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

const categorySlugs: Record<
  ProductCategory,
  string[]
> = {
  "بروتين": ["protein"],
  "قبل التمرين": ["pre-workout"],
  "كرياتين": ["creatine"],
  "أحماض أمينية": ["amino-acids", "bcaa"],
  "إكسسوارات اللياقة": ["fitness-accessories", "accessories"],
};

const trainingGoals: Record<
  TrainingGoal,
  string[]
> = {
  "بناء العضلات": [
    "muscle-support",
    "muscle-building",
  ],
  "الطاقة والتحمل": [
    "energy-endurance",
    "energy",
  ],
  "إدارة الوزن": ["weight-management"],
  "الاستشفاء": ["recovery"],
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
): ShopQuery {
  const requestedCategories = values(
    params.category,
  );
  const requestedGoals = values(params.goal);
  const requestedSort = Array.isArray(params.sort)
    ? params.sort[0]
    : params.sort;

  return {
    categories: categoryOptions.filter((item) =>
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
    page: normalizePage(params.page),
  };
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

export function toCategorySlugs(
  categories: ProductCategory[],
) {
  return categories.flatMap(
    (category) => categorySlugs[category],
  );
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
