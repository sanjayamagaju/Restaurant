import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Order } from '../models/types';
import { RestaurantService } from './restaurant.service';

export interface AppNotification {
  id: string;
  orderId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

let notificationSeq = 0;

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private restaurantService = inject(RestaurantService);

  notifications = signal<AppNotification[]>([]);
  unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  private lastSeenStatus = new Map<string, string>();

  constructor() {
    effect(() => {
      const event = this.restaurantService.lastEvent();
      if (!event) return;
      this.handleEvent(event.type, event.order);
    });
  }

  markAsRead(id: string) {
    this.notifications.update(list => list.map(n => (n.id === id ? { ...n, read: true } : n)));
  }

  markAllAsRead() {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  private handleEvent(type: 'order_created' | 'order_updated', order: Order) {
    const previousStatus = this.lastSeenStatus.get(order.id);
    this.lastSeenStatus.set(order.id, order.status);

    // Avoid noise: only notify on brand-new orders and the "food is ready" milestone.
    if (type === 'order_created' || previousStatus === undefined) {
      this.push(order, `New order #${order.id} from Table ${order.tableNumber}`);
      return;
    }

    if (previousStatus !== order.status && order.status === 'READY') {
      this.push(order, `Order #${order.id} (Table ${order.tableNumber}) is ready to serve`);
    }
  }

  private push(order: Order, message: string) {
    const notification: AppNotification = {
      id: `${Date.now()}-${notificationSeq++}`,
      orderId: order.id,
      message,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.notifications.update(list => [notification, ...list].slice(0, 50));
  }
}
