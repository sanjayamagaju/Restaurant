import {Component, OnDestroy, OnInit, computed, effect, inject, signal} from '@angular/core';
import {DatePipe, NgClass} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {RestaurantService} from '../../services/restaurant.service';
import {Order, OrderStatus} from '../../models/types';
import {CANCELLABLE_STATUSES, NEXT_STATUS_ACTION, ORDER_STATUS_META, URGENCY_META} from '../../utils/constants';
import {elapsedLabel, isToday, urgency as urgencyOf, Urgency} from '../../utils/order-timing';
import {playAlertBeep} from '../../utils/kitchen-sound';

type StatusFilter = 'ALL' | 'NEW' | 'PREPARING' | 'READY' | 'DELAYED';
type ColumnKey = 'NEW' | 'PREPARING' | 'READY' | 'DONE';

interface KitchenColumn {
  key: ColumnKey;
  label: string;
  icon: string;
}

const SOUND_MUTED_KEY = 'kitchenSoundMuted';
const NEW_ORDER_HIGHLIGHT_MS = 4000;

@Component({
  selector: 'app-kitchen',
  imports: [DatePipe, NgClass, FormsModule, RouterLink],
  templateUrl: './kitchen.html',
  styleUrl: './kitchen.css',
})
export class Kitchen implements OnInit, OnDestroy {
  restaurantService = inject(RestaurantService);

  now = signal(Date.now());
  clockTime = computed(() => new Date(this.now()));
  private tickHandle?: ReturnType<typeof setInterval>;

  statusFilter = signal<StatusFilter>('ALL');
  tableQuery = signal('');
  orderQuery = signal('');

  soundMuted = signal(localStorage.getItem(SOUND_MUTED_KEY) === 'true');

  pendingActionOrderIds = signal<Set<string>>(new Set());
  actionError = signal<string | null>(null);
  private errorTimeout?: ReturnType<typeof setTimeout>;

  recentlyArrivedIds = signal<Set<string>>(new Set());
  private arrivalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  /** Assigned as an instance property (rather than called directly) so tests can spy on it. */
  protected playSound = playAlertBeep;

  readonly columns: KitchenColumn[] = [
    { key: 'NEW', label: 'New', icon: 'bi-bell-fill' },
    { key: 'PREPARING', label: 'Preparing', icon: 'bi-fire' },
    { key: 'READY', label: 'Ready', icon: 'bi-bag-check-fill' },
    { key: 'DONE', label: 'Completed / Served', icon: 'bi-check2-circle' },
  ];

  readonly statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'NEW', label: 'New' },
    { key: 'PREPARING', label: 'Preparing' },
    { key: 'READY', label: 'Ready' },
    { key: 'DELAYED', label: 'Delayed' },
  ];

  private activeOrders = computed(() => [
    ...this.restaurantService.newOrders(),
    ...this.restaurantService.acceptedOrders(),
    ...this.restaurantService.preparingOrders(),
    ...this.restaurantService.readyOrders(),
  ]);

  activeCount = computed(() => this.activeOrders().length);
  delayedCount = computed(() => {
    const now = this.now();
    return this.activeOrders().filter(o => urgencyOf(o.createdAt, now) === 'delayed').length;
  });

  connectionState = computed(() => this.restaurantService.connectionState());
  isOffline = computed(() => {
    const state = this.connectionState();
    return state === 'reconnecting' || state === 'polling';
  });

  columnOrders = computed<Record<ColumnKey, Order[]>>(() => {
    const filter = this.statusFilter();
    const tableQuery = this.tableQuery().trim().toLowerCase();
    const orderQuery = this.orderQuery().trim();
    const cutoffNow = Date.now();

    const matchesSearch = (o: Order) => {
      if (tableQuery && !o.tableNumber.toLowerCase().includes(tableQuery)) return false;
      if (orderQuery && !o.id.includes(orderQuery)) return false;
      return true;
    };

    const applyFilter = (orders: Order[], columnKey: ColumnKey) => {
      let result = orders.filter(matchesSearch);
      if (filter === 'DELAYED') {
        result = result.filter(o => urgencyOf(o.createdAt, cutoffNow) === 'delayed');
      } else if (filter !== 'ALL' && filter !== columnKey) {
        result = [];
      }
      return result;
    };

    const doneOrders = [
      ...this.restaurantService.servedOrders(),
      ...this.restaurantService.completedOrders().filter(o => isToday(o.completedAt ?? o.createdAt, cutoffNow)),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      NEW: applyFilter(this.restaurantService.newOrders(), 'NEW'),
      PREPARING: applyFilter(
        [...this.restaurantService.acceptedOrders(), ...this.restaurantService.preparingOrders()],
        'PREPARING',
      ),
      READY: applyFilter(this.restaurantService.readyOrders(), 'READY'),
      DONE: applyFilter(doneOrders, 'DONE'),
    };
  });

  constructor() {
    effect(() => {
      const event = this.restaurantService.lastEvent();
      if (event?.type === 'order_created') {
        this.announceNewOrder(event.order);
      }
    });
  }

  ngOnInit() {
    this.restaurantService.loadOrders();
    this.restaurantService.connectStaffSocket();
    this.tickHandle = setInterval(() => this.now.set(Date.now()), 1000);
    this.requestNotificationPermission();
  }

  ngOnDestroy() {
    this.restaurantService.disconnectStaffSocket();
    if (this.tickHandle) clearInterval(this.tickHandle);
    if (this.errorTimeout) clearTimeout(this.errorTimeout);
    this.arrivalTimeouts.forEach(handle => clearTimeout(handle));
  }

  setStatusFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
  }

  toggleSound() {
    this.soundMuted.update(muted => {
      const next = !muted;
      localStorage.setItem(SOUND_MUTED_KEY, String(next));
      return next;
    });
  }

  toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.();
      } else {
        void document.exitFullscreen?.();
      }
    } catch {
      // Fullscreen API unavailable/blocked in this context - not critical.
    }
  }

  isNew(orderId: string): boolean {
    return this.recentlyArrivedIds().has(orderId);
  }

  isUpdating(orderId: string): boolean {
    return this.pendingActionOrderIds().has(orderId);
  }

  nextAction(status: OrderStatus) {
    return NEXT_STATUS_ACTION[status];
  }

  canCancel(status: OrderStatus): boolean {
    return CANCELLABLE_STATUSES.includes(status);
  }

  statusMeta(status: OrderStatus) {
    return ORDER_STATUS_META[status];
  }

  urgency(order: Order): Urgency {
    return urgencyOf(order.createdAt, this.now());
  }

  urgencyMeta(urgency: Urgency) {
    return URGENCY_META[urgency];
  }

  elapsed(order: Order): string {
    return elapsedLabel(order.createdAt, this.now());
  }

  allItemsComplete(order: Order): boolean {
    return order.items.length > 0 && order.items.every(i => i.completed);
  }

  toggleItem(order: Order, index: number) {
    if (order.status !== 'PREPARING') return;
    this.restaurantService.toggleOrderItemStatus(order.id, index);
  }

  performAction(order: Order, status: OrderStatus) {
    if (this.isUpdating(order.id)) return;
    this.pendingActionOrderIds.update(set => new Set(set).add(order.id));
    this.restaurantService.updateOrderStatus(order.id, status).subscribe({
      next: () => this.finishAction(order.id),
      error: (err) => {
        this.finishAction(order.id);
        this.showError(err);
      },
    });
  }

  private finishAction(orderId: string) {
    this.pendingActionOrderIds.update(set => {
      const next = new Set(set);
      next.delete(orderId);
      return next;
    });
  }

  private showError(err: unknown) {
    const message = (err as { error?: { status?: string[] } })?.error?.status?.[0]
      ?? 'That action could not be completed. The order may have already changed status.';
    this.actionError.set(message);
    if (this.errorTimeout) clearTimeout(this.errorTimeout);
    this.errorTimeout = setTimeout(() => this.actionError.set(null), 6000);
  }

  private announceNewOrder(order: Order) {
    this.recentlyArrivedIds.update(set => new Set(set).add(order.id));
    const existing = this.arrivalTimeouts.get(order.id);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      this.recentlyArrivedIds.update(set => {
        const next = new Set(set);
        next.delete(order.id);
        return next;
      });
      this.arrivalTimeouts.delete(order.id);
    }, NEW_ORDER_HIGHLIGHT_MS);
    this.arrivalTimeouts.set(order.id, handle);

    if (!this.soundMuted()) {
      this.playSound();
    }
    this.showBrowserNotification(order);
  }

  private requestNotificationPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // Notifications API unavailable in this context - not critical.
    }
  }

  private showBrowserNotification(order: Order) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`New order #${order.id}`, { body: `Table ${order.tableNumber}` });
      }
    } catch {
      // Notifications unsupported/blocked - not critical.
    }
  }
}
