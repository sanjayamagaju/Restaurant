import {Component, OnInit, inject, effect} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {DatePipe, NgClass} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {map} from 'rxjs';
import {CURRENCY} from '../../../utils/constants';
import {RestaurantService} from '../../../services/restaurant.service';

@Component({
  selector: 'app-admin-orders',
  imports: [
    DatePipe,
    NgClass
  ],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
})
export class AdminOrders implements OnInit {
  restaurantService = inject(RestaurantService);
  private route = inject(ActivatedRoute);

  expandedOrders = new Set<string>();
  highlightedOrderId = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('orderId'))),
    { initialValue: null },
  );

  constructor() {
    effect(() => {
      const id = this.highlightedOrderId();
      if (id && this.restaurantService.pendingOrders().some(o => o.id === id)) {
        setTimeout(() => {
          document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    });
  }

  ngOnInit() {
    this.restaurantService.loadOrders();
  }

  toggleDetails(orderId: string) {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
  }

  protected readonly CURRENCY = CURRENCY;
}
