import {Component, OnDestroy, OnInit, computed, effect, inject, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {DatePipe, NgClass} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {map} from 'rxjs';
import {
  CURRENCY, CANCELLABLE_STATUSES, CANCELLATION_REASONS, NEXT_STATUS_ACTION, ORDER_STATUS_META, URGENCY_META,
} from '../../../utils/constants';
import {elapsedLabel, isToday, urgency as urgencyOf, Urgency} from '../../../utils/order-timing';
import {RestaurantService} from '../../../services/restaurant.service';
import {CancellationReason, Order, OrderStatus} from '../../../models/types';

interface StatusColumn {
  key: OrderStatus;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-admin-orders',
  imports: [
    DatePipe,
    NgClass
  ],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
})
export class AdminOrders implements OnInit, OnDestroy {
  restaurantService = inject(RestaurantService);
  private route = inject(ActivatedRoute);

  expandedOrders = new Set<string>();
  pendingActionOrderIds = signal<Set<string>>(new Set());
  actionError = signal<string | null>(null);
  /** Order awaiting a cancellation reason, if any. */
  cancellingOrderId = signal<string | null>(null);
  cancelReason = signal<CancellationReason>('CUSTOMER_REQUEST');
  readonly cancellationReasons = CANCELLATION_REASONS;
  now = signal(Date.now());
  private tickHandle?: ReturnType<typeof setInterval>;
  private errorTimeout?: ReturnType<typeof setTimeout>;

  highlightedOrderId = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('orderId'))),
    { initialValue: null },
  );

  columns: StatusColumn[] = [
    { key: 'NEW', label: 'New', icon: 'bi-bell-fill' },
    { key: 'ACCEPTED', label: 'Accepted', icon: 'bi-clipboard-check-fill' },
    { key: 'PREPARING', label: 'Preparing', icon: 'bi-fire' },
    { key: 'READY', label: 'Ready', icon: 'bi-bag-check-fill' },
    { key: 'SERVED', label: 'Served', icon: 'bi-cup-hot-fill' },
  ];

  ordersByColumn = computed<Record<OrderStatus, Order[]>>(() => ({
    NEW: this.restaurantService.newOrders(),
    ACCEPTED: this.restaurantService.acceptedOrders(),
    PREPARING: this.restaurantService.preparingOrders(),
    READY: this.restaurantService.readyOrders(),
    SERVED: this.restaurantService.servedOrders(),
    COMPLETED: this.restaurantService.completedOrders(),
    CANCELLED: this.restaurantService.cancelledOrders(),
  }));

  historyOrders = computed(() => {
    const now = Date.now();
    const completed = this.restaurantService.completedOrders().filter(o => isToday(o.completedAt ?? o.createdAt, now));
    const cancelled = this.restaurantService.cancelledOrders().filter(o => isToday(o.cancelledAt ?? o.createdAt, now));
    return [...completed, ...cancelled].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  constructor() {
    effect(() => {
      const id = this.highlightedOrderId();
      if (id && this.restaurantService.orders().some(o => o.id === id)) {
        setTimeout(() => {
          document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    });
  }

  ngOnInit() {
    this.tickHandle = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    if (this.errorTimeout) clearTimeout(this.errorTimeout);
  }

  toggleDetails(orderId: string) {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
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

  /** The timestamp the order entered its current status, used for the "duration in this status" display. */
  statusStartedAt(order: Order): string {
    switch (order.status) {
      case 'ACCEPTED': return order.acceptedAt ?? order.createdAt;
      case 'PREPARING': return order.preparingAt ?? order.createdAt;
      case 'READY': return order.readyAt ?? order.createdAt;
      case 'SERVED': return order.servedAt ?? order.createdAt;
      default: return order.createdAt;
    }
  }

  elapsedLabel(iso: string): string {
    return elapsedLabel(iso, this.now());
  }

  urgency(order: Order): Urgency {
    return urgencyOf(order.createdAt, this.now());
  }

  urgencyMeta(urgency: Urgency) {
    return URGENCY_META[urgency];
  }

  performAction(order: Order, status: OrderStatus, cancellationReason?: CancellationReason) {
    if (this.isUpdating(order.id)) return;
    this.pendingActionOrderIds.update(set => new Set(set).add(order.id));
    this.restaurantService.updateOrderStatus(order.id, status, cancellationReason).subscribe({
      next: () => {
        this.finishAction(order.id);
        this.cancellingOrderId.set(null);
      },
      error: (err) => {
        this.finishAction(order.id);
        this.showError(err);
      },
    });
  }

  /** Cancelling asks for a reason first, so cancellation analytics has real data. */
  startCancel(order: Order) {
    this.cancelReason.set('CUSTOMER_REQUEST');
    this.cancellingOrderId.set(order.id);
  }

  dismissCancel() {
    this.cancellingOrderId.set(null);
  }

  confirmCancel(order: Order) {
    this.performAction(order, 'CANCELLED', this.cancelReason());
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
      ?? 'That action could not be completed. The order may have already changed status — please refresh.';
    this.actionError.set(message);
    if (this.errorTimeout) clearTimeout(this.errorTimeout);
    this.errorTimeout = setTimeout(() => this.actionError.set(null), 6000);
  }

  protected readonly CURRENCY = CURRENCY;
}
