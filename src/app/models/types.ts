export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  isSpecial: boolean;
  imageUrl?: string;
}

export interface OrderItem {
  menuItem: MenuItem;
  quantity: number;
  completed?: boolean;
}

export interface Order {
  id: string;
  tableNumber: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'completed';
  createdAt: Date;
}
