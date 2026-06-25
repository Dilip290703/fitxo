import type { OrderStatus, DeliveryStatus, PaymentStatus } from '@fitzo/supabase/types';

type StatusValue = OrderStatus | DeliveryStatus | PaymentStatus | string;

const statusStyles: Record<string, string> = {
  // Order statuses
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  assigned: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  out_for_delivery: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  delivered: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  try_window_active: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  return_requested: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  return_picked: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  // Delivery statuses
  accepted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  picked_up: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  en_route: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  arrived: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  // Payment
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  initiated: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  partially_paid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  refunded: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  // User roles
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  store_manager: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  rider: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  customer: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  // Notification types
  system: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  promo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  order_update: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  // Generic
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const formatLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface StatusBadgeProps {
  status: StatusValue;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const style = statusStyles[status] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20';

  return (
    <span
      className={`inline-flex items-center border rounded-full font-medium ${style} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      {formatLabel(status)}
    </span>
  );
}
