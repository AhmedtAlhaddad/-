import type { Product } from "./product";

export interface CartItem {
  id: string;
  product: Product;
  variantId: string;
  quantity: number;
}
