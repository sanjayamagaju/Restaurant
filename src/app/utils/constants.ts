import { CancellationReason, OrderStatus } from '../models/types';
import { Urgency } from './order-timing';

export const CURRENCY = 'Rs.';

export interface StatusMeta {
  label: string;
  icon: string;
  badgeClass: string;
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  NEW: { label: 'New', icon: 'bi-bell-fill', badgeClass: 'text-bg-warning' },
  ACCEPTED: { label: 'Accepted', icon: 'bi-clipboard-check-fill', badgeClass: 'text-bg-info' },
  PREPARING: { label: 'Preparing', icon: 'bi-fire', badgeClass: 'text-bg-primary' },
  READY: { label: 'Ready', icon: 'bi-bag-check-fill', badgeClass: 'text-bg-success' },
  SERVED: { label: 'Served', icon: 'bi-cup-hot-fill', badgeClass: 'text-bg-secondary' },
  COMPLETED: { label: 'Completed', icon: 'bi-check2-circle', badgeClass: 'text-bg-success' },
  CANCELLED: { label: 'Cancelled', icon: 'bi-x-circle-fill', badgeClass: 'text-bg-danger' },
};

// Status a staff action moves an order INTO, and the label for that action button.
export const NEXT_STATUS_ACTION: Partial<Record<OrderStatus, { next: OrderStatus; label: string; icon: string }>> = {
  NEW: { next: 'ACCEPTED', label: 'Accept', icon: 'bi-check-lg' },
  ACCEPTED: { next: 'PREPARING', label: 'Start Preparing', icon: 'bi-fire' },
  PREPARING: { next: 'READY', label: 'Mark Ready', icon: 'bi-bag-check-fill' },
  READY: { next: 'SERVED', label: 'Mark Served', icon: 'bi-cup-hot-fill' },
  SERVED: { next: 'COMPLETED', label: 'Complete', icon: 'bi-check2-circle' },
};

// Statuses from which staff may still cancel an order.
export const CANCELLABLE_STATUSES: OrderStatus[] = ['NEW', 'ACCEPTED', 'PREPARING'];

// Reasons staff can attach when cancelling. Must match the backend's
// Order.CANCELLATION_REASON_CHOICES.
export const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: 'CUSTOMER_REQUEST', label: 'Customer request' },
  { value: 'ITEM_UNAVAILABLE', label: 'Unavailable item' },
  { value: 'OTHER', label: 'Other' },
];

export interface UrgencyMeta {
  icon: string;
  text: string;
  class: string;
}

export const URGENCY_META: Record<Urgency, UrgencyMeta> = {
  normal: { icon: 'bi-check-circle', text: 'Normal', class: 'text-bg-success-subtle' },
  warning: { icon: 'bi-exclamation-triangle-fill', text: 'Waiting', class: 'text-bg-warning' },
  delayed: { icon: 'bi-alarm-fill', text: 'Delayed', class: 'text-bg-danger' },
};
