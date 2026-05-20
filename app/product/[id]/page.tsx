import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { RecommendedCarousel } from "@/components/product/RecommendedCarousel";
import { ProductDetailData } from "@/components/product/types";
import {
  catalogProducts,
  products,
  testimonials,
  type CatalogProduct,
} from "@/lib/mockData";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

function isCatalogProductRecord(
  product: (typeof products)[number] | CatalogProduct,
): product is CatalogProduct {
  return "oldPrice" in product;
}

function buildGalleryImages(title: string, baseImage: string) {
  return [
    {
      id: "main",
      src: baseImage,
      alt: `${title} main view`,
    },
    {
      id: "look-2",
      src: `${baseImage}&sat=-10`,
      alt: `${title} alternate view`,
    },
    {
      id: "look-3",
      src: `${baseImage}&contrast=10`,
      alt: `${title} close-up`,
    },
    {
      id: "look-4",
      src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80",
      alt: `${title} styling view`,
    },
    {
      id: "look-5",
      src: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1200&q=80",
      alt: `${title} movement view`,
    },
    {
      id: "look-6",
      src: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80",
      alt: `${title} detail view`,
    },
  ];
}

function buildProductDetail(id: string): ProductDetailData | null {
  const product =
    products.find((item) => item.id === id) ??
    catalogProducts.find((item) => item.id === id);

  if (!product) return null;

  const catalogProduct = isCatalogProductRecord(product) ? product : null;
  const isCatalogProduct = Boolean(catalogProduct);
  const currentPrice = isCatalogProduct
    ? `$${product.price.toFixed(2)}`
    : `₹${product.price}`;
  const catalogOldPrice = catalogProduct?.oldPrice ?? product.price;
  const oldPrice = isCatalogProduct
    ? `$${catalogOldPrice.toFixed(2)}`
    : `₹${Math.round(product.price * 1.18)}`;
  const discount = isCatalogProduct
    ? "15% off"
    : `${Math.round(((product.price * 1.18 - product.price) / (product.price * 1.18)) * 100)}% off`;

  const gallery = buildGalleryImages(product.title, product.image);
  const reviews = testimonials.slice(0, 3).map((review, index) => ({
    id: review.id,
    name: review.name,
    rating: review.rating,
    role: review.role,
    quote: review.quote,
    photo: index === 0 ? review.image : undefined,
  }));

  const nearbyStores = [
    { name: "Hinjawadi Phase 1", distance: "1.9 km", eta: "18 min" },
    { name: "Phoenix Marketcity", distance: "4.2 km", eta: "29 min" },
    { name: "Aundh High Street", distance: "5.6 km", eta: "34 min" },
  ];

  const recommendedIds = [
    ...catalogProducts.map((item) => item.id),
    ...products.map((item) => item.id),
  ]
    .filter((itemId) => itemId !== id)
    .slice(0, 6);

  return {
    id: product.id,
    slug: product.id,
    title:
      id === "catalog-look-1"
        ? "Black Slim Fit Stretch Trousers"
        : product.title,
    brand: product.brand,
    priceValue: product.price,
    price: currentPrice,
    oldPriceValue: catalogOldPrice,
    oldPrice,
    discount,
    subtitle:
      "A polished FitZo pick designed for all-day comfort, clean lines, and doorstep try-on confidence.",
    gallery,
    colors: [
      {
        name: "Black",
        value: "#111111",
        preview: gallery[0].src,
      },
      {
        name: "Ivory",
        value: "#e9e1d5",
        preview: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
      },
      {
        name: "Stone",
        value: "#bba892",
        preview: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80",
      },
    ],
    sizes: ["28", "30", "32", "34", "36"],
    offers: [
      {
        code: "SHOP10",
        title: "SHOP10",
        description: "Enjoy 10% off on orders above ₹2700",
      },
      {
        code: "SHOP15",
        title: "SHOP15",
        description: "Enjoy 15% off on 2 or more styles",
      },
    ],
    nearbyStores,
    reviews,
    details: [
      "Premium stretch blend for an easy tailored feel.",
      "Try-at-home support with free doorstep return pickup.",
      "Works well across office, occasion, and weekend styling.",
    ],
    delivery: [
      "60-Minute Delivery across nearby partner stores.",
      "Try at home before you pay with instant fit feedback.",
      "Live order tracking updates once the style is on the way.",
    ],
    returns: [
      "Return instantly at the doorstep if the fit is not right.",
      "Refunds are processed quickly for prepaid orders.",
      "Kept items are billed only after your try-on window closes.",
    ],
    recommendedIds,
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const product = buildProductDetail(id);

  if (!product) {
    notFound();
  }

  const recommendedProducts = product.recommendedIds
    .map((recommendedId) => {
      return (
        catalogProducts.find((item) => item.id === recommendedId) ??
        products.find((item) => item.id === recommendedId)
      );
    })
    .filter(
      (
        item,
      ): item is
        | (typeof catalogProducts)[number]
        | (typeof products)[number] => Boolean(item),
    )
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
    }));

  return (
    <main className="min-h-screen bg-[#fbfaf7] pb-20 sm:pb-0">
      <Navbar showSecondaryNav={false} />

      <section className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1.12fr_0.88fr] xl:gap-12">
          <ProductGallery product={product} />
          <ProductInfo product={product} />
        </div>
      </section>

      <RecommendedCarousel products={recommendedProducts} />
      <Footer />
    </main>
  );
}
