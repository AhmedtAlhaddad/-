export interface Category {
  name: string;
  description: string;
  image: string;
  href: string;
}

export interface CatalogCategory extends Category {
  slug: string;
}

export interface ShopCategoryOption {
  slug: string;
  label: string;
}
