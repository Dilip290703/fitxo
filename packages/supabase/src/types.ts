export type UserRole = 'customer' | 'admin' | 'store_manager' | 'rider';
export type TrySessionStatus = 'active' | 'expired' | 'completed';
export type ReturnCondition   = 'good' | 'damaged';
export type ReturnStatus      = 'requested' | 'scheduled' | 'picked_up' | 'completed';
export type PaymentTxnStatus  = 'pending' | 'initiated' | 'success' | 'failed' | 'refunded';
export type PayoutStatus      = 'pending' | 'processing' | 'paid';
export type GenderType = 'men' | 'women' | 'kids' | 'unisex';
export type FitType = 'slim' | 'regular' | 'oversized' | 'relaxed';
export type SizeType = 'alpha' | 'numeric' | 'uk' | 'eu' | 'us';
export type ImageAngle = 'front' | 'back' | 'side' | 'detail' | 'lifestyle' | 'flat_lay';
export type OrderStatus =
  | 'pending' | 'confirmed' | 'assigned' | 'out_for_delivery'
  | 'delivered' | 'try_window_active' | 'return_requested'
  | 'return_picked' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'refunded';
export type PaymentMethod = 'razorpay' | 'cod' | 'wallet';
export type ItemDecision = 'pending' | 'keep' | 'return';
export type DeliveryType = 'delivery' | 'return_pickup';
export type DeliveryStatus =
  | 'assigned' | 'accepted' | 'picked_up' | 'en_route' | 'arrived' | 'completed' | 'failed';
export type VehicleType = 'bike' | 'cycle' | 'scooter';
export type DiscountType = 'percent' | 'flat';
export type NotificationType = 'order_update' | 'promo' | 'system';

export interface Store {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  onboarding_status: StoreOnboardingStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  is_active: boolean;
  is_verified: boolean;
  /** Per-store commission override in percent (migration 046). NULL = platform default rate. */
  commission_rate?: number | null;
  /** Manager-controlled pause (migration 052): true = taking no NEW orders. Distinct from is_active (admin kill switch). Optional: absent pre-052. */
  is_paused?: boolean;
  created_at: string;
  updated_at: string;
}

export type StoreOnboardingStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type StoreEntityType =
  | 'individual'
  | 'proprietorship'
  | 'partnership'
  | 'pvt_ltd'
  | 'llp';

/**
 * Private business / KYC / payout details for a store. Lives in its own table
 * (never on the world-readable `stores` row) with RLS = own manager or admin only.
 */
export interface StoreBusinessDetails {
  store_id: string;
  legal_name: string | null;
  entity_type: StoreEntityType | null;
  gst_number: string | null;
  pan_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  gender: GenderType;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  children?: Category[];
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: GenderType | null;
  skin_tone: string | null;
  skin_undertone: string | null;
  preferred_sizes: Record<string, string>;
  preferred_brands: string[] | null;
  is_active: boolean;
  is_blocked: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

export interface Product {
  id: string;
  store_id: string;
  brand_id: string | null;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  material: string | null;
  care_instructions: string | null;
  fit_type: FitType | null;
  base_price: number;
  discounted_price: number | null;
  deposit_amount: number;
  is_active: boolean;
  is_deleted: boolean;
  is_featured: boolean;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined fields
  store?: Store;
  brand?: Brand;
  category?: Category;
  colors?: ProductColor[];
  images?: ProductImage[];
  variants?: ProductVariant[];
}

export interface ProductColor {
  id: string;
  product_id: string;
  color_name: string;
  color_hex: string | null;
  is_available: boolean;
  sort_order: number;
  images?: ProductImage[];
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color_id: string;
  size: string;
  size_type: SizeType;
  stock_qty: number;
  reserved_qty: number;
  available_qty: number;
  sku: string;
  is_available: boolean;
  color?: ProductColor;
}

export interface ProductImage {
  id: string;
  product_id: string;
  color_id: string | null;
  image_url: string;
  angle: ImageAngle;
  is_primary: boolean;
  sort_order: number;
  alt_text: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  address_id: string | null;
  status: OrderStatus;
  subtotal: number;
  deposit_total: number;
  delivery_fee: number;
  /** Rider's pay for this delivery (migration 037) — decoupled from the customer delivery_fee. Optional: pre-037 rows/types. */
  rider_fee?: number;
  discount_amount: number;
  final_amount: number;
  coupon_code: string | null;
  coupon_discount: number;
  try_deadline: string | null;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  user?: User;
  address?: Address;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  color_name: string;
  size: string;
  image_url: string | null;
  price_at_order: number;
  deposit_at_order: number;
  decision: ItemDecision;
  decision_at: string | null;
  return_reason: string | null;
  /** Commission frozen at Keep-settlement time (migration 046). NULL = never settled / pre-046 unpaid. */
  commission_rate?: number | null;
  commission_amount?: number | null;
}

export interface Rider {
  id: string;
  user_id: string;
  vehicle_type: VehicleType;
  vehicle_number: string | null;
  is_available: boolean;
  is_verified: boolean;
  current_lat: number | null;
  current_lng: number | null;
  total_deliveries: number;
  rating: number | null;
  user?: User;
}

export interface Delivery {
  id: string;
  order_id: string;
  rider_id: string | null;
  type: DeliveryType;
  status: DeliveryStatus;
  pickup_address: Record<string, unknown>;
  drop_address: Record<string, unknown>;
  assigned_at: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  completed_at: string | null;
  distance_km: number | null;
  estimated_minutes: number | null;
  rider_notes: string | null;
  order?: Order;
  rider?: Rider;
}

export interface StoreManager {
  id: string;
  user_id: string;
  store_id: string;
  is_active: boolean;
  assigned_at: string;
  user?: User;
  store?: Store;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin?: User;
}

export interface TrySession {
  id: string;
  order_id: string;
  started_at: string;
  deadline_at: string;
  status: TrySessionStatus;
  created_at: string;
  order?: Order;
}

export interface Return {
  id: string;
  order_id: string;
  order_item_id: string;
  reason: string | null;
  condition: ReturnCondition;
  status: ReturnStatus;
  requested_at: string;
  completed_at: string | null;
  order?: Order;
  order_item?: OrderItem;
}

export interface Payment {
  id: string;
  order_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: PaymentTxnStatus;
  payment_method: PaymentMethod;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  paid_at: string | null;
  created_at: string;
  /** Per-item Keep payments (migration 009). Optional: added post-launch of this type. */
  order_item_id?: string | null;
  /** Rupees of this charge that are the customer delivery fee (migration 040). */
  delivery_fee_component?: number | null;
  /** Refund bookkeeping (migration 041). */
  razorpay_refund_id?: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
  /** Razorpay's total deduction incl. GST, rupees (migration 043). NULL = not yet reported; kept on refunds (sunk cost). */
  gateway_fee?: number | null;
  /** GST portion inside gateway_fee (migration 043). Net MDR = gateway_fee − gateway_tax. */
  gateway_tax?: number | null;
  order?: Order;
  user?: User;
}

export interface Payout {
  id: string;
  store_id: string;
  order_id: string;
  amount: number;
  status: PayoutStatus;
  paid_at: string | null;
  created_at: string;
  store?: Store;
  order?: Order;
}

// Database type map for typed Supabase queries
export interface Database {
  public: {
    Tables: {
      stores: { Row: Store; Insert: Omit<Store, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Store, 'id'>> };
      brands: { Row: Brand; Insert: Omit<Brand, 'id' | 'created_at'>; Update: Partial<Omit<Brand, 'id'>> };
      categories: { Row: Category; Insert: Omit<Category, 'id' | 'created_at' | 'children'>; Update: Partial<Omit<Category, 'id' | 'children'>> };
      users: { Row: User; Insert: Omit<User, 'created_at'>; Update: Partial<Omit<User, 'id'>> };
      products: { Row: Product; Insert: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'store' | 'brand' | 'category' | 'colors' | 'images' | 'variants'>; Update: Partial<Omit<Product, 'id' | 'store' | 'brand' | 'category' | 'colors' | 'images' | 'variants'>> };
      product_colors: { Row: ProductColor; Insert: Omit<ProductColor, 'id' | 'images' | 'variants'>; Update: Partial<Omit<ProductColor, 'id' | 'images' | 'variants'>> };
      product_variants: { Row: ProductVariant; Insert: Omit<ProductVariant, 'id' | 'available_qty' | 'color'>; Update: Partial<Omit<ProductVariant, 'id' | 'available_qty' | 'color'>> };
      product_images: { Row: ProductImage; Insert: Omit<ProductImage, 'id'>; Update: Partial<Omit<ProductImage, 'id'>> };
      addresses: { Row: Address; Insert: Omit<Address, 'id'>; Update: Partial<Omit<Address, 'id'>> };
      orders: { Row: Order; Insert: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'user' | 'address' | 'items'>; Update: Partial<Omit<Order, 'id' | 'user' | 'address' | 'items'>> };
      order_items: { Row: OrderItem; Insert: Omit<OrderItem, 'id'>; Update: Partial<Omit<OrderItem, 'id'>> };
      riders: { Row: Rider; Insert: Omit<Rider, 'id' | 'user'>; Update: Partial<Omit<Rider, 'id' | 'user'>> };
      deliveries: { Row: Delivery; Insert: Omit<Delivery, 'id' | 'order' | 'rider'>; Update: Partial<Omit<Delivery, 'id' | 'order' | 'rider'>> };
      store_managers: { Row: StoreManager; Insert: Omit<StoreManager, 'id' | 'user' | 'store'>; Update: Partial<Omit<StoreManager, 'id' | 'user' | 'store'>> };
      store_business_details: { Row: StoreBusinessDetails; Insert: Omit<StoreBusinessDetails, 'created_at' | 'updated_at'>; Update: Partial<Omit<StoreBusinessDetails, 'store_id'>> };
      coupons: { Row: Coupon; Insert: Omit<Coupon, 'id'>; Update: Partial<Omit<Coupon, 'id'>> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Omit<Notification, 'id'>> };
      activity_logs: { Row: ActivityLog; Insert: Omit<ActivityLog, 'id' | 'created_at' | 'admin'>; Update: never };
      try_sessions: { Row: TrySession; Insert: Omit<TrySession, 'id' | 'created_at' | 'order'>; Update: Partial<Omit<TrySession, 'id' | 'order'>> };
      returns: { Row: Return; Insert: Omit<Return, 'id' | 'order' | 'order_item'>; Update: Partial<Omit<Return, 'id' | 'order' | 'order_item'>> };
      payments: { Row: Payment; Insert: Omit<Payment, 'id' | 'created_at' | 'order' | 'user'>; Update: Partial<Omit<Payment, 'id' | 'order' | 'user'>> };
      payouts: { Row: Payout; Insert: Omit<Payout, 'id' | 'created_at' | 'store' | 'order'>; Update: Partial<Omit<Payout, 'id' | 'store' | 'order'>> };
    };
  };
}
