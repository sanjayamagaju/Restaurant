import {Component, computed, inject, signal} from '@angular/core';
import {NgClass} from '@angular/common';
import {FormsModule} from '@angular/forms';
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
  imports: [NgClass, FormsModule],
  templateUrl: './customer-order-status.html',
  styleUrl: './customer-order-status.css',
})
export class CustomerOrderStatus {
  restaurantService = inject(RestaurantService);
  readonly CURRENCY = CURRENCY;
  readonly steps = ORDER_STATUS_SEQUENCE;

  order = computed(() => this.restaurantService.trackedOrder());

  // Feedback is offered once the order is done and asked for only once.
  readonly ratingChoices = [1, 2, 3, 4, 5];
  rating = signal(0);
  comment = signal('');
  feedbackSubmitting = signal(false);
  feedbackSubmitted = signal(false);
  feedbackError = signal<string | null>(null);

  canLeaveFeedback = computed(() =>
    this.order()?.status === 'COMPLETED' && !this.feedbackSubmitted(),
  );

  submitFeedback() {
    const order = this.order();
    const rating = this.rating();
    if (!order || rating < 1 || this.feedbackSubmitting()) return;

    this.feedbackSubmitting.set(true);
    this.feedbackError.set(null);
    this.restaurantService.submitFeedback(order.id, rating, this.comment().trim()).subscribe({
      next: () => {
        this.feedbackSubmitting.set(false);
        this.feedbackSubmitted.set(true);
      },
      error: () => {
        this.feedbackSubmitting.set(false);
        this.feedbackError.set('Sorry, we could not save your rating. Please try again.');
      },
    });
  }

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
