import type { OrderStatus, DeliveryStatus, PaymentStatus } from '@fitxo/supabase/types';

type StatusValue = OrderStatus | DeliveryStatus | PaymentStatus | string;

/**
 * All statuses flow through the Store panel's 5 badge tones so both panels
 * read the same. The status-string API is unchanged from the first build.
 */
type Tone = 'neutral' | 'amber' | 'green' | 'red' | 'blue';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-hairline text-soft',
  amber: 'bg-warn-bg text-warn',
  green: 'bg-success-bg text-success',
  red: 'bg-danger-bg text-danger',
  blue: 'bg-info-bg text-info',
};

const STATUS_TONE: Record<string, Tone> = {
  // Order statuses
  pending: 'amber',
  confirmed: 'blue',
  assigned: 'blue',
  out_for_delivery: 'blue',
  delivered: 'green',
  try_window_active: 'amber',
  return_requested: 'amber',
  return_picked: 'blue',
  completed: 'green',
  cancelled: 'red',
  // Delivery statuses
  accepted: 'blue',
  picked_up: 'blue',
  en_route: 'blue',
  arrived: 'green',
  failed: 'red',
  // Payment
  paid: 'green',
  success: 'green',
  initiated: 'amber',
  partially_paid: 'amber',
  refunded: 'blue',
  // User roles
  admin: 'red',
  store_manager: 'blue',
  rider: 'blue',
  customer: 'neutral',
  // Notification types
  system: 'neutral',
  promo: 'amber',
  order_update: 'blue',
  // Complaint statuses
  open: 'amber',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'neutral',
  // Content types
  page: 'blue',
  banner: 'blue',
  faq: 'neutral',
  announcement: 'amber',
  // Generic
  active: 'green',
  inactive: 'neutral',
};

const formatLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface StatusBadgeProps {
  status: StatusValue;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const tone = STATUS_TONE[status] ?? 'neutral';

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ${TONE_CLASS[tone]} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      {formatLabel(status)}
    </span>
  );
}
