import type { CartProduct } from "./product";

export interface CartItem {
  id: string;
  product: CartProduct;
  variantId: string;
  quantity: number;
}
