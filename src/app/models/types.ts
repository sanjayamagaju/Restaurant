export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  active: boolean;
  itemCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
  additionalPrice: number;
  displayOrder: number;
  active: boolean;
}

export interface MenuItemOptionGroup {
  id: string;
  name: string;
  required: boolean;
  minSelection: number;
  maxSelection: number;
  displayOrder: number;
  active: boolean;
  options: MenuItemOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  isSpecial: boolean;
  imageUrl?: string;
  category?: string | null;
  categoryName?: string | null;
  available: boolean;
  preparationTime?: number | null;
  displayOrder: number;
  optionGroups: MenuItemOptionGroup[];
}

/** A single customization choice made against one option group, e.g. Size -> Large. */
export interface SelectedOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  additionalPrice: number;
}

/** A snapshot line as returned on a persisted order item - frozen at order time. */
export interface OrderItemOptionSnapshot {
  groupName: string;
  optionName: string;
  additionalPrice: string;
}

export interface OrderItem {
  id?: string;
  menuItem: MenuItem;
  quantity: number;
  completed?: boolean;
  specialInstructions?: string;
  unitPrice?: number;
  itemTotal?: number;
  selectedOptions?: OrderItemOptionSnapshot[];
}

/** A cart line, identified by menu item + the exact customization chosen -
 * two lines for the same menu item with different options/instructions are
 * kept separate so the cart (and the resulting order) can tell them apart. */
export interface CartLine {
  key: string;
  menuItem: MenuItem;
  quantity: number;
  selectedOptions: SelectedOption[];
  specialInstructions: string;
}

export type OrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED';

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
];

export type CancellationReason = 'CUSTOMER_REQUEST' | 'ITEM_UNAVAILABLE' | 'OTHER';

export interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  totalAmount: number;
  specialInstructions?: string;
  status: OrderStatus;
  cancellationReason?: CancellationReason | '';
  createdAt: string;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

export interface Table {
  id: string;
  number: string;
  code: string;
  createdAt: string;
}
