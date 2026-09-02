import {Component, computed, inject} from '@angular/core';
import {NgClass} from '@angular/common';
import {RestaurantService} from '../../services/restaurant.service';
import {ORDER_STATUS_SEQUENCE, OrderStatus} from '../../models/types';
import {CURRENCY} from '../../utils/constants';

type StepState = 'done' | 'current' | 'upcoming';

const STEP_LABELS: Record<OrderStatus, string> = {
  NEW: 'Order Received',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

@Component({
  selector: 'app-customer-order-status',
  imports: [NgClass],
  templateUrl: './customer-order-status.html',
  styleUrl: './customer-order-status.css',
})
export class CustomerOrderStatus {
  restaurantService = inject(RestaurantService);
  readonly CURRENCY = CURRENCY;
  readonly steps = ORDER_STATUS_SEQUENCE;

  order = computed(() => this.restaurantService.trackedOrder());

  stepState(step: OrderStatus): StepState {
    const order = this.order();
    if (!order || order.status === 'CANCELLED') return 'upcoming';
    const currentIndex = this.steps.indexOf(order.status);
    const stepIndex = this.steps.indexOf(step);
    if (stepIndex < currentIndex) return 'done';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  }

  stepLabel(step: OrderStatus): string {
    return STEP_LABELS[step];
  }

  dismiss() {
    this.restaurantService.clearTrackedOrder();
  }
}
