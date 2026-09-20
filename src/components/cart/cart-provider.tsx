"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
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
  clearCart: () => void;
}

const CART_STORAGE_KEY =
  "alam-allayaqa-cart-v1";

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isStoredCartItem(
  value: unknown,
): value is CartItem {
  if (!isRecord(value)) {
    return false;
  }

  const product = value.product;

  if (
    !isRecord(product) ||
    typeof value.id !== "string" ||
    typeof value.variantId !==
      "string" ||
    typeof value.quantity !==
      "number" ||
    !Number.isInteger(
      value.quantity,
    ) ||
    Number(value.quantity) < 1 ||
    Number(value.quantity) > 1000 ||
    typeof product.id !== "string" ||
    typeof product.slug !== "string" ||
    typeof product.shortName !==
      "string" ||
    typeof product.category !==
      "string" ||
    !Array.isArray(product.images) ||
    !product.images.every(
      (image) =>
        typeof image === "string",
    ) ||
    !Array.isArray(
      product.variants,
    )
  ) {
    return false;
  }

  const validVariants =
    product.variants.every(
      (variant) =>
        isRecord(variant) &&
        typeof variant.id ===
          "string" &&
        typeof variant.flavor ===
          "string" &&
        typeof variant.weight ===
          "string" &&
        typeof variant.servings ===
          "number" &&
        Number.isFinite(
          variant.servings,
        ) &&
        typeof variant.price ===
          "number" &&
        Number.isFinite(
          variant.price,
        ) &&
        (
          variant.compareAtPrice ===
            undefined ||
          (
            typeof variant.compareAtPrice ===
              "number" &&
            Number.isFinite(
              variant.compareAtPrice,
            )
          )
        ) &&
        typeof variant.stock ===
          "number" &&
        Number.isFinite(
          variant.stock,
        ) &&
        Array.isArray(
          variant.images,
        ) &&
        variant.images.every(
          (image) =>
            typeof image ===
            "string",
        ),
    );

  return (
    validVariants &&
    product.variants.some(
      (variant) =>
        isRecord(variant) &&
        variant.id ===
          value.variantId,
    )
  );
}

const EMPTY_CART: CartItem[] =
  [];
let cartSnapshot:
  | CartItem[]
  | undefined;
const cartListeners =
  new Set<() => void>();

function readCartSnapshot() {
  if (cartSnapshot) {
    return cartSnapshot;
  }

  try {
    const stored =
      window.localStorage.getItem(
        CART_STORAGE_KEY,
      );
    const parsed: unknown =
      stored
        ? JSON.parse(stored)
        : [];

    cartSnapshot =
      Array.isArray(parsed)
        ? parsed.filter(
            isStoredCartItem,
          )
        : [];
  } catch {
    cartSnapshot = [];

    try {
      window.localStorage.removeItem(
        CART_STORAGE_KEY,
      );
    } catch {
      // Browser storage can be unavailable while the in-memory cart still works.
    }
  }

  return cartSnapshot;
}

function subscribeToCart(
  listener: () => void,
) {
  cartListeners.add(listener);

  function handleStorage(
    event: StorageEvent,
  ) {
    if (
      event.key ===
      CART_STORAGE_KEY
    ) {
      cartSnapshot = undefined;
      listener();
    }
  }

  window.addEventListener(
    "storage",
    handleStorage,
  );

  return () => {
    cartListeners.delete(
      listener,
    );
    window.removeEventListener(
      "storage",
      handleStorage,
    );
  };
}

function updateCart(
  update: (
    current: CartItem[],
  ) => CartItem[],
) {
  cartSnapshot = update(
    readCartSnapshot(),
  );

  try {
    if (
      cartSnapshot.length === 0
    ) {
      window.localStorage.removeItem(
        CART_STORAGE_KEY,
      );
    } else {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(
          cartSnapshot,
        ),
      );
    }
  } catch {
    // Browser storage can be unavailable while the in-memory cart still works.
  }

  cartListeners.forEach(
    (listener) => listener(),
  );
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const items =
    useSyncExternalStore(
      subscribeToCart,
      readCartSnapshot,
      () => EMPTY_CART,
    );

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

    updateCart((current) => {
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
    updateCart((current) =>
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
    updateCart((current) =>
      current.filter((item) => item.id !== id),
    );
  };

  const clearCart = () => {
    updateCart(() => []);
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
      clearCart,
    }),
    [
      items,
      itemCount,
      subtotal,
    ],
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
