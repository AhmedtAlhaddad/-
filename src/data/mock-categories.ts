import type { Category } from "@/types/category";

export const categories: Category[] = [
  {
    name: "البروتين",
    description: "قوة، تعافٍ ونمو عضلي",
    image: "/images/cat-protein.jpg",
    href: "/shop?category=بروتين",
  },
  {
    name: "قبل التمرين",
    description: "طاقة وتركيز قبل كل جولة",
    image: "/images/cat-preworkout.jpg",
    href: "/shop?category=قبل التمرين",
  },
  {
    name: "الأحماض الأمينية",
    description: "دعم الاستشفاء بعد التمرين",
    image: "/images/product-bcaa.jpg",
    href: "/shop?category=أحماض أمينية",
  },
  {
    name: "إكسسوارات اللياقة",
    description: "كل ما يكمل تجهيزك",
    image: "/images/cat-accessories.jpg",
    href: "/shop?category=إكسسوارات اللياقة",
  },
];