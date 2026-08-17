export const AUTH_STORAGE_KEY = "fitxo-auth";
export const PINCODE_STORAGE_KEY = "fitxo-pincode";

export const brands = [
  {
    name: "Bewakoof",
    slug: "bewakoof",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/bewakoof.svg",
    containerClass: "bg-yellow-400 px-6",
    logoClass:
      "h-8 max-w-[138px] object-contain transition duration-200 group-hover:scale-105 md:h-9",
  },
  {
    name: "Marks & Spencer",
    slug: "marks-spencer",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/marks-spencer.svg",
    containerClass: "bg-gray-200 px-6",
    logoClass:
      "h-8 max-w-[138px] object-contain transition duration-200 group-hover:scale-105 md:h-9",
  },
  {
    name: "Raymond",
    slug: "raymond",
    image:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/raymond.svg",
    containerClass: "bg-transparent p-0",
    logoClass:
      "h-full w-full object-contain transition duration-200 group-hover:scale-105",
  },
  {
    name: "United Colors of Benetton",
    slug: "united-colors-of-benetton",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/ucb.svg",
    containerClass: "bg-transparent p-0",
    logoClass:
      "h-full w-full object-contain transition duration-200 group-hover:scale-105",
  },
  {
    name: "H&M",
    slug: "hm",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/hm.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-8 max-w-[138px] object-contain transition duration-200 group-hover:scale-105",
  },
  {
    name: "Zara",
    slug: "zara",
    image:
      "https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/zara.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[150px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
  {
    name: "Levi's",
    slug: "levis",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/levis.svg",
    containerClass: "bg-red-600 px-6",
    logoClass:
      "h-7 max-w-[132px] object-contain brightness-0 invert transition duration-200 group-hover:scale-105 md:h-8",
  },
  {
    name: "Nike",
    slug: "nike",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/nike.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[132px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
  {
    name: "Adidas",
    slug: "adidas",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/adidas.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[132px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
  {
    name: "Puma",
    slug: "puma",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    logo: "/brands/puma.svg",
    containerClass: "border border-gray-300 bg-white px-6",
    logoClass:
      "h-6 max-w-[132px] object-contain transition duration-200 group-hover:scale-105 md:h-7",
  },
];

export const products = [
  {
    id: "kurti-dress",
    title: "Kurti Dress",
    subtitle: "Be inspired",
    brand: "Bewakoof",
    brandSlug: "bewakoof",
    category: "women",
    price: 1899,
    sale: false,
    collection: "summer",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "traditional-red",
    title: "Traditional",
    subtitle: "Festive picks",
    brand: "Raymond",
    brandSlug: "raymond",
    category: "men",
    price: 2599,
    sale: true,
    collection: "summer",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "street-wear-tee",
    title: "Street Wear",
    subtitle: "New arrivals",
    brand: "Nike",
    brandSlug: "nike",
    category: "men",
    price: 1499,
    sale: false,
    collection: "summer",
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "wedding-wear",
    title: "Wedding Wear",
    subtitle: "Bridal edit",
    brand: "Marks & Spencer",
    brandSlug: "marks-spencer",
    category: "women",
    price: 4899,
    sale: false,
    collection: "summer",
    image:
      "https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "linen-shirt",
    title: "Linen Shirt",
    subtitle: "Airy essentials",
    brand: "Zara",
    brandSlug: "zara",
    category: "men",
    price: 2299,
    sale: true,
    collection: "summer",
    image:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "soft-denim",
    title: "Soft Denim",
    subtitle: "Try-on favorite",
    brand: "Levi's",
    brandSlug: "levis",
    category: "women",
    price: 3199,
    sale: false,
    collection: "core",
    image:
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "home-lounge-set",
    title: "Home Lounge",
    subtitle: "Comfort edit",
    brand: "H&M",
    brandSlug: "hm",
    category: "home",
    price: 1999,
    sale: true,
    collection: "core",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "kids-festive",
    title: "Kids Festive",
    subtitle: "Mini style",
    brand: "Puma",
    brandSlug: "puma",
    category: "kids",
    price: 1299,
    sale: false,
    collection: "core",
    image:
      "https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=900&q=80",
  },
];

export type CatalogProduct = {
  id: string;
  title: string;
  subtitle: string;
  brand: string;
  brandSlug: string;
  category: string;
  price: number;
  sale: boolean;
  collection: string;
  image: string;
  oldPrice: number;
  orders: number;
  badge: string;
  audience: "women" | "ladies" | "girls" | "babies";
  productCategory:
    | "dresses"
    | "tops"
    | "lingerie-lounge-wear"
    | "blouse"
    | "vintage";
  sizeLabel: "Medium" | "Large" | "Plus Size" | "Sexy Plus Size";
  popularity: number;
  isNewArrival: boolean;
};

const catalogImage =
  "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80";

const catalogSeedProducts: Omit<CatalogProduct, "id" | "orders" | "popularity">[] = [
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Modern blouse edit",
    brand: "H&M",
    brandSlug: "hm",
    category: "women",
    price: 120.23,
    sale: true,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "women",
    productCategory: "blouse",
    sizeLabel: "Medium",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Soft tailoring",
    brand: "Zara",
    brandSlug: "zara",
    category: "women",
    price: 120.23,
    sale: false,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "ladies",
    productCategory: "tops",
    sizeLabel: "Large",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Statement wardrobe",
    brand: "Gucci",
    brandSlug: "gucci",
    category: "women",
    price: 120.23,
    sale: false,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "girls",
    productCategory: "vintage",
    sizeLabel: "Plus Size",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Occasion dressing",
    brand: "Dior",
    brandSlug: "dior",
    category: "women",
    price: 120.23,
    sale: true,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "women",
    productCategory: "dresses",
    sizeLabel: "Sexy Plus Size",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Everyday luxe",
    brand: "Chanel",
    brandSlug: "chanel",
    category: "women",
    price: 120.23,
    sale: false,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "ladies",
    productCategory: "blouse",
    sizeLabel: "Medium",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Runway-inspired",
    brand: "Prada",
    brandSlug: "prada",
    category: "women",
    price: 120.23,
    sale: true,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "girls",
    productCategory: "tops",
    sizeLabel: "Large",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Confident eveningwear",
    brand: "Versace",
    brandSlug: "versace",
    category: "women",
    price: 120.23,
    sale: false,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "babies",
    productCategory: "lingerie-lounge-wear",
    sizeLabel: "Plus Size",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Classic glam",
    brand: "Dolce & Gabbana",
    brandSlug: "dolce-gabbana",
    category: "women",
    price: 120.23,
    sale: true,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "women",
    productCategory: "dresses",
    sizeLabel: "Sexy Plus Size",
    isNewArrival: true,
  },
  {
    title: "Striped Flutter Sleeve Overlap Collar Peplum Hem Blouse",
    subtitle: "Warm-weather edit",
    brand: "Marks & Spencer",
    brandSlug: "marks-spencer",
    category: "women",
    price: 120.23,
    sale: false,
    collection: "summer",
    image: catalogImage,
    oldPrice: 120.23,
    badge: "New Arrivals",
    audience: "ladies",
    productCategory: "vintage",
    sizeLabel: "Medium",
    isNewArrival: true,
  },
];

export const catalogProducts: CatalogProduct[] = Array.from({ length: 117 }, (_, index) => {
  const seed = catalogSeedProducts[index % catalogSeedProducts.length];

  return {
    ...seed,
    id: `catalog-look-${index + 1}`,
    orders: 24 + (index % 5) * 3,
    popularity: 100 - (index % 23),
  };
});

export const testimonials = [
  {
    id: "mia-johnson",
    name: "Mia Johnson",
    role: "Remote stylist",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    quote:
      "I picked three denim fits, tried them at my door while the rider waited, and kept the one that actually worked. The rest went straight back with him.",
  },
  {
    id: "aadhira-nair",
    name: "Aadhira Nair",
    role: "Weekend shopper",
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    quote:
      "The curated looks felt personal, and the rider waited while I compared sizes. It felt like a boutique fitting room showed up at my apartment.",
  },
  {
    id: "sana-ali",
    name: "Sana Ali",
    role: "Content creator",
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    quote:
      "FitXo made a same-day event outfit possible. I tracked the order live, swapped one top instantly, and paid only for the final look.",
  },
  {
    id: "rhea-kapoor",
    name: "Rhea Kapoor",
    role: "Early user",
    rating: 4,
    image:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80",
    quote:
      "The delivery slot I booked was bang on time. I could plan an outfit after work and still make my dinner reservation.",
  },
];

export const supportLinks = [
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
];

export const socialLinks = {
  facebook: "https://www.facebook.com",
  twitter: "https://x.com",
  instagram: "https://www.instagram.com",
  tiktok: "https://www.tiktok.com",
  snapchat: "https://www.snapchat.com",
};
