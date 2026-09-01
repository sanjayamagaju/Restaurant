import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MenuItem, Order, OrderItem } from '../models/types';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RestaurantService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // State
  menuItems = signal<MenuItem[]>([]);
  orders = signal<Order[]>([]);
  currentTable = signal<string | null>(null);

  // Computed State
  regularMenuItems = computed(() => this.menuItems().filter(item => !item.isSpecial));
  specialMenuItems = computed(() => this.menuItems().filter(item => item.isSpecial));
  pendingOrders = computed(() => this.orders().filter(order => order.status === 'pending'));
  completedOrders = computed(() => this.orders().filter(order => order.status === 'completed'));

  constructor() {
    this.loadMenuItems();

    const savedTable = localStorage.getItem('restaurantTable');
    if (savedTable) {
      this.currentTable.set(savedTable);
    }
  }

  // Data loading
  loadMenuItems() {
    this.http.get<MenuItem[]>(`${this.apiUrl}/menu-items/`).subscribe(items => {
      this.menuItems.set(items.map(item => ({ ...item, id: String(item.id) })));
    });
  }

  loadOrders() {
    this.http.get<Order[]>(`${this.apiUrl}/orders/`).subscribe(orders => {
      this.orders.set(orders.map(order => this.normalizeOrder(order)));
    });
  }

  private normalizeOrder(order: Order): Order {
    return {
      ...order,
      id: String(order.id),
      items: order.items.map(item => ({
        ...item,
        id: item.id !== undefined ? String(item.id) : undefined,
        menuItem: { ...item.menuItem, id: String(item.menuItem.id) },
      })),
    };
  }

  // Mutations
  setTableNumber(tableNumber: string) {
    this.currentTable.set(tableNumber);
    localStorage.setItem('restaurantTable', tableNumber);
  }

  addMenuItem(item: Omit<MenuItem, 'id'>) {
    this.http.post<MenuItem>(`${this.apiUrl}/menu-items/`, item).subscribe(created => {
      this.menuItems.update(items => [...items, { ...created, id: String(created.id) }]);
    });
  }

  placeOrder(items: OrderItem[], totalAmount: number) {
    const table = this.currentTable();
    if (!table) return;

    const payload = {
      tableNumber: table,
      totalAmount,
      status: 'pending',
      items: items.map(i => ({ menuItemId: i.menuItem.id, quantity: i.quantity })),
    };

    this.http.post<Order>(`${this.apiUrl}/orders/`, payload).subscribe(created => {
      this.orders.update(orders => [...orders, this.normalizeOrder(created)]);
    });
  }

  completeOrder(orderId: string) {
    this.http
      .patch<Order>(`${this.apiUrl}/orders/${orderId}/`, { status: 'completed' })
      .subscribe(() => {
        this.orders.update(orders =>
          orders.map(order =>
            order.id === orderId ? { ...order, status: 'completed' } : order
          )
        );
      });
  }

  toggleOrderItemStatus(orderId: string, itemIndex: number) {
    const order = this.orders().find(o => o.id === orderId);
    const item = order?.items[itemIndex];
    if (!order || !item || item.id === undefined) return;

    const completed = !item.completed;
    this.http
      .patch<OrderItem>(`${this.apiUrl}/order-items/${item.id}/`, { completed })
      .subscribe(() => {
        this.orders.update(orders =>
          orders.map(o => {
            if (o.id === orderId) {
              const updatedItems = [...o.items];
              updatedItems[itemIndex] = { ...updatedItems[itemIndex], completed };
              return { ...o, items: updatedItems };
            }
            return o;
          })
        );
      });
  }
}
