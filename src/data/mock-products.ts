import type { Product } from "@/types/product";

const images = {
  protein: ["/images/product-protein.jpg", "/images/product-gallery.jpg"],
  preworkout: ["/images/product-preworkout.jpg"],
  creatine: ["/images/product-creatine.jpg"],
  bcaa: ["/images/product-bcaa.jpg"],
};

export const products: Product[] = [
  {
    id: "p1", slug: "gold-standard-whey-chocolate", brand: "أوبتيموم نيوترشن",
    name: "واي بروتين جولد ستاندرد - نكهة الشوكولاتة الغنية", shortName: "واي بروتين جولد ستاندرد",
    description: "بروتين مصل اللبن عالي الجودة لدعم بناء العضلات والتعافي، بتركيبة سهلة الخلط وطعم شوكولاتة غني.",
    category: "بروتين", goal: "بناء العضلات", rating: 4.8, reviewCount: 2450, images: images.protein,
    badge: "الأكثر مبيعًا", inStock: true, type: "واي بروتين", features: ["24 جم بروتين", "5.5 جم BCAAs", "74 حصة", "أقل من 1 جم سكر"],
    variants: [
      { id: "p1-v1", flavor: "شوكولاتة غنية", weight: "2.27 كجم", servings: 74, price: 349, compareAtPrice: 420, stock: 18, images: ["/images/product-gallery.jpg", "/images/product-protein.jpg"] },
      { id: "p1-v2", flavor: "فانيليا آيس كريم", weight: "2.27 كجم", servings: 74, price: 349, compareAtPrice: 420, stock: 9, images: ["/images/product-bcaa.jpg", ...images.protein] },
      { id: "p1-v3", flavor: "بسكويت وكريمة", weight: "907 جم", servings: 29, price: 189, stock: 7, images: ["/images/product-gallery.jpg", "/images/product-bcaa.jpg"] },
    ],
  },
  {
    id: "p2", slug: "apex-ignite-pre-workout", brand: "إيبيكس نيوترشن", name: "محفز طاقة ما قبل التمرين إكسبلوسيف", shortName: "محفز طاقة قبل التمرين",
    description: "مزيج مركز للطاقة والتركيز يساعدك على دخول كل تمرين بكامل قوتك.", category: "قبل التمرين", goal: "الطاقة والتحمل",
    rating: 4.9, reviewCount: 840, images: images.preworkout, badge: "اختيار المدربين", inStock: true, type: "Pre-Workout",
    features: ["طاقة مستمرة", "تركيز عالٍ", "40 حصة"], variants: [{ id: "p2-v1", flavor: "توت أزرق", weight: "300 جم", servings: 40, price: 189, compareAtPrice: 215, stock: 23, images: images.preworkout }],
  },
  {
    id: "p3", slug: "micronized-creatine-500", brand: "أوبتيموم نيوترشن", name: "كرياتين مونوهيدرات نقي - 500 جرام", shortName: "كرياتين مونوهيدرات نقي",
    description: "كرياتين نقي دقيق الذوبان لدعم القوة والأداء في الجولات عالية الشدة.", category: "كرياتين", goal: "بناء العضلات",
    rating: 4.7, reviewCount: 620, images: images.creatine, badge: "عرض خاص", inStock: true, type: "كرياتين",
    features: ["5 جم للحصة", "100 حصة", "بدون نكهة"], variants: [{ id: "p3-v1", flavor: "بدون نكهة", weight: "500 جم", servings: 100, price: 125, compareAtPrice: 145, stock: 16, images: images.creatine }],
  },
  {
    id: "p4", slug: "essential-bcaa-5000", brand: "ماي بروتين", name: "BCAA 5000 أحماض أمينية أساسية", shortName: "BCAA أحماض أمينية",
    description: "أحماض أمينية أساسية لدعم الاستشفاء وتقليل الإجهاد بعد التمرين.", category: "أحماض أمينية", goal: "الاستشفاء",
    rating: 4.6, reviewCount: 240, images: images.bcaa, inStock: true, type: "BCAA",
    features: ["نسبة 2:1:1", "سريع الامتصاص", "خالٍ من السكر"], variants: [{ id: "p4-v1", flavor: "ليمون", weight: "250 جم", servings: 50, price: 159, stock: 12, images: images.bcaa }],
  },
  {
    id: "p5", slug: "iso100-hydrolyzed-whey", brand: "دايماتايز", name: "آيزو 100 بروتين مصل اللبن المتحلل", shortName: "آيزو 100 بروتين متحلل",
    description: "بروتين معزول سريع الامتصاص للرياضيين الباحثين عن تركيبة نظيفة.", category: "بروتين", goal: "بناء العضلات",
    rating: 4.9, reviewCount: 1110, images: images.protein, badge: "جديد", inStock: true, type: "بروتين معزول",
    features: ["25 جم بروتين", "قليل اللاكتوز", "سريع الامتصاص"], variants: [{ id: "p5-v1", flavor: "كوكيز", weight: "1.4 كجم", servings: 44, price: 310, compareAtPrice: 360, stock: 8, images: images.protein }],
  },
  {
    id: "p6", slug: "c4-original-pre-workout", brand: "سيلوكور", name: "سي فور أوريجينال للطاقة والتركيز", shortName: "C4 أوريجينال",
    description: "تركيبة يومية خفيفة للطاقة والتركيز قبل التمرين.", category: "قبل التمرين", goal: "الطاقة والتحمل",
    rating: 4.5, reviewCount: 480, images: images.preworkout, inStock: true, type: "Pre-Workout",
    features: ["30 حصة", "نكهة منعشة", "بيتا ألانين"], variants: [{ id: "p6-v1", flavor: "فروت بنش", weight: "195 جم", servings: 30, price: 165, stock: 15, images: images.preworkout }],
  },
  {
    id: "p7", slug: "impact-whey-protein", brand: "ماي بروتين", name: "إمباكت واي بروتين - فانيليا", shortName: "إمباكت واي بروتين",
    description: "بروتين يومي موثوق بطعم خفيف وقيمة ممتازة.", category: "بروتين", goal: "إدارة الوزن",
    rating: 4.7, reviewCount: 790, images: images.bcaa, inStock: true, type: "واي بروتين",
    features: ["21 جم بروتين", "قليل الدهون", "سهل الخلط"], variants: [{ id: "p7-v1", flavor: "فانيليا", weight: "1 كجم", servings: 40, price: 155, stock: 20, images: images.bcaa }],
  },
  {
    id: "p8", slug: "creatine-capsules", brand: "مسل تك", name: "كرياتين بلاتينيوم كبسولات", shortName: "كرياتين بلاتينيوم",
    description: "جرعة كرياتين عملية في كبسولات للاستخدام اليومي.", category: "كرياتين", goal: "بناء العضلات",
    rating: 4.4, reviewCount: 210, images: images.creatine, inStock: false, type: "كرياتين",
    features: ["جرعة دقيقة", "سهل الحمل", "90 كبسولة"], variants: [{ id: "p8-v1", flavor: "بدون نكهة", weight: "90 كبسولة", servings: 30, price: 130, stock: 0, images: images.creatine }],
  },
];

export const getProductBySlug = (slug: string) => products.find((product) => product.slug === slug);
