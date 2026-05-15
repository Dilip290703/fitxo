export const AUTH_STORAGE_KEY = "fitzo-auth";
export const PINCODE_STORAGE_KEY = "fitzo-pincode";

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
      "https://images.unsplash.com/photo-1610030469668-4d9c3f4e14f7?auto=format&fit=crop&w=900&q=80",
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
      "https://images.unsplash.com/photo-1614251056216-f748a1a8f0cd?auto=format&fit=crop&w=900&q=80",
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

export const testimonials = [
  {
    id: "mia-johnson",
    name: "Mia Johnson",
    role: "Remote stylist",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    quote:
      "I picked three denim fits, tried them in my room, and only kept the pair that actually worked. The return pickup happened before I finished coffee.",
  },
  {
    id: "aadhira-nair",
    name: "Aadhira Nair",
    role: "Weekend shopper",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    quote:
      "The curated looks felt personal, and the rider waited while I compared sizes. It felt like a boutique fitting room showed up at my apartment.",
  },
  {
    id: "sana-ali",
    name: "Sana Ali",
    role: "Content creator",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    quote:
      "FitZo made a same-day event outfit possible. I tracked the order live, swapped one top instantly, and paid only for the final look.",
  },
  {
    id: "rhea-kapoor",
    name: "Rhea Kapoor",
    role: "Early user",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80",
    quote:
      "The 60-minute delivery promise actually felt real. I could plan an outfit after work and still make my dinner reservation.",
  },
];

export const brandLogoLinks = [
  { name: "Chanel", slug: "chanel" },
  { name: "D&G", slug: "dolce-gabbana" },
  { name: "Dior", slug: "dior" },
  { name: "Versace", slug: "versace" },
  { name: "Zara", slug: "zara" },
  { name: "Gucci", slug: "gucci" },
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
