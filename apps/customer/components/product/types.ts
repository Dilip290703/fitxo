export type ProductGalleryImage = {
  id: string;
  src: string;
  alt: string;
};

export type ProductOffer = {
  code: string;
  title: string;
  description: string;
};

export type ProductColor = {
  name: string;
  value: string;
  preview: string;
};

export type NearbyStore = {
  name: string;
  distance: string;
  eta: string;
};

export type ProductReview = {
  id: string;
  name: string;
  rating: number;
  role: string;
  quote: string;
  photo?: string;
};

export type SizeOption = {
  label: string;
  /** true = in stock & available, false = exists but sold out */
  available: boolean;
};

export type ProductDetailData = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  /** Owning store — the store panel that will see an order for this product. */
  storeName: string;
  priceValue: number;
  price: string;
  oldPriceValue?: number;
  oldPrice?: string;
  discount?: string;
  subtitle: string;
  gallery: ProductGalleryImage[];
  colors: ProductColor[];
  sizes: SizeOption[];
  offers: ProductOffer[];
  nearbyStores: NearbyStore[];
  reviews: ProductReview[];
  details: string[];
  delivery: string[];
  returns: string[];
  recommendedIds: string[];
};
