import { Injectable, signal, computed } from '@angular/core';
import { MenuItem, Order, OrderItem } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class RestaurantService {
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
    this.loadInitialData();
  }
  
  private loadInitialData() {
    // Try to load from localStorage
    const savedMenu = localStorage.getItem('restaurantMenu');
    if (savedMenu) {
      this.menuItems.set(JSON.parse(savedMenu));
    } else {
      // Default dummy data
      this.menuItems.set([
        { id: '1', name: 'Margherita Pizza', price: 12, description: 'Classic cheese and tomato pizza', isSpecial: false },
        { id: '2', name: 'Spaghetti Carbonara', price: 15, description: 'Pasta with creamy egg and pancetta sauce', isSpecial: false },
        { id: '3', name: 'Chef Special Steak', price: 25, description: 'Premium cut steak with garlic butter', isSpecial: true }
      ]);
      this.saveMenuToStorage();
    }
    
    const savedOrders = localStorage.getItem('restaurantOrders');
    if (savedOrders) {
      this.orders.set(JSON.parse(savedOrders));
    }
    
    const savedTable = localStorage.getItem('restaurantTable');
    if (savedTable) {
      this.currentTable.set(savedTable);
    }
  }
  
  // Mutations
  setTableNumber(tableNumber: string) {
    this.currentTable.set(tableNumber);
    localStorage.setItem('restaurantTable', tableNumber);
  }
  
  addMenuItem(item: Omit<MenuItem, 'id'>) {
    const newItem: MenuItem = {
      ...item,
      id: Date.now().toString()
    };
    this.menuItems.update(items => [...items, newItem]);
    this.saveMenuToStorage();
  }
  
  placeOrder(items: OrderItem[], totalAmount: number) {
    const table = this.currentTable();
    if (!table) return;
    
    const newOrder: Order = {
      id: Date.now().toString(),
      tableNumber: table,
      items: items.map(i => ({ ...i, completed: false })),
      totalAmount,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.orders.update(orders => [...orders, newOrder]);
    this.saveOrdersToStorage();
  }
  
  completeOrder(orderId: string) {
    this.orders.update(orders => 
      orders.map(order => 
        order.id === orderId ? { ...order, status: 'completed' } : order
      )
    );
    this.saveOrdersToStorage();
  }

  toggleOrderItemStatus(orderId: string, itemIndex: number) {
    this.orders.update(orders =>
      orders.map(order => {
        if (order.id === orderId) {
          const updatedItems = [...order.items];
          if (updatedItems[itemIndex]) {
            updatedItems[itemIndex] = {
              ...updatedItems[itemIndex],
              completed: !updatedItems[itemIndex].completed
            };
          }
          return { ...order, items: updatedItems };
        }
        return order;
      })
    );
    this.saveOrdersToStorage();
  }
  
  // Helpers
  private saveMenuToStorage() {
    localStorage.setItem('restaurantMenu', JSON.stringify(this.menuItems()));
  }
  
  private saveOrdersToStorage() {
    localStorage.setItem('restaurantOrders', JSON.stringify(this.orders()));
  }
}
