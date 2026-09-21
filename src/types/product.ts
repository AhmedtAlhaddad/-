export type ProductCategory = string;
export type TrainingGoal =
  | "بناء عضلات"
  | "زيادة الوزن وقدرة التحمل"
  | "حرق الدهون وانقاص الوزن";

export interface ProductVariant {
  id: string;
  flavor: string;
  weight: string;
  servings: number;
  price: number;
  compareAtPrice?: number;
  stock: number;
  images: string[];
}

export interface CartProduct {
  id: string;
  slug: string;
  shortName: string;
  category: ProductCategory;
  images: string[];
  variants: ProductVariant[];
}

export interface CatalogProduct extends CartProduct {
  brand: string;
  name: string;
  badge?: string;
  inStock: boolean;
  type: string;
  storefrontScope: "supplements" | "accessories";
}

export interface SearchProduct {
  id: string;
  slug: string;
  brand: string;
  name: string;
  shortName: string;
  image?: string;
  price: number;
}

export interface Product extends CatalogProduct {
  description: string;
  nutritionFacts: string | null;
  usageInstructions: string | null;
  features: string[];
}
