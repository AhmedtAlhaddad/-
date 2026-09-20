"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CartItem } from "@/types/cart";
import type { CartProduct } from "@/types/product";

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (
    product: CartProduct,
    variantId: string,
    quantity?: number,
  ) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (
    product: CartProduct,
    variantId: string,
    quantity = 1,
  ) => {
    const variant = product.variants.find(
      (entry) => entry.id === variantId,
    );

    if (!variant || quantity < 1) {
      return;
    }

    const id = `${product.id}-${variantId}`;

    setItems((current) => {
      const existing = current.find(
        (item) => item.id === id,
      );

      if (existing) {
        return current.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity + quantity,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          id,
          product,
          variantId,
          quantity,
        },
      ];
    });
  };

  const updateQuantity = (
    id: string,
    quantity: number,
  ) => {
    setItems((current) =>
      quantity < 1
        ? current.filter((item) => item.id !== id)
        : current.map((item) =>
            item.id === id
              ? { ...item, quantity }
              : item,
          ),
    );
  };

  const removeItem = (id: string) => {
    setItems((current) =>
      current.filter((item) => item.id !== id),
    );
  };

  const itemCount = items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const subtotal = items.reduce((sum, item) => {
    const variant =
      item.product.variants.find(
        (entry) => entry.id === item.variantId,
      ) ?? item.product.variants[0];

    if (!variant) {
      return sum;
    }

    return sum + variant.price * item.quantity;
  }, 0);

  const value = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      addItem,
      updateQuantity,
      removeItem,
    }),
    [items, itemCount, subtotal],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);

  if (!value) {
    throw new Error(
      "useCart must be used inside CartProvider",
    );
  }

  return value;
}
