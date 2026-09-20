export type ProductCategory = "بروتين" | "قبل التمرين" | "كرياتين" | "أحماض أمينية" | "إكسسوارات اللياقة";
export type TrainingGoal = "بناء العضلات" | "الطاقة والتحمل" | "إدارة الوزن" | "الاستشفاء";

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
  rating: number;
  badge?: string;
  inStock: boolean;
  type: string;
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
  goal: TrainingGoal;
  reviewCount: number;
  features: string[];
}
