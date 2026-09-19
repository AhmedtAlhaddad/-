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

export interface Product {
  id: string;
  slug: string;
  brand: string;
  name: string;
  shortName: string;
  description: string;
  category: ProductCategory;
  goal: TrainingGoal;
  rating: number;
  reviewCount: number;
  images: string[];
  badge?: string;
  inStock: boolean;
  type: string;
  features: string[];
  variants: ProductVariant[];
}
