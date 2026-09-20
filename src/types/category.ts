export interface Category {
  name: string;
  description: string;
  href: string;
}

export interface CatalogCategory extends Category {
  slug: string;
}

export interface HomepageCategory extends CatalogCategory {
  images: string[];
}

export interface ShopCategoryOption {
  slug: string;
  label: string;
}
