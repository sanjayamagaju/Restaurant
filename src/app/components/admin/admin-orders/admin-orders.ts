import {Component, inject} from '@angular/core';
import {DatePipe} from '@angular/common';
import {CURRENCY} from '../../../utils/constants';
import {RestaurantService} from '../../../services/restaurant.service';

@Component({
  selector: 'app-admin-orders',
  imports: [
    DatePipe
  ],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
})
export class AdminOrders {
  restaurantService = inject(RestaurantService);

  expandedOrders = new Set<string>();



  toggleDetails(orderId: string) {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
  }

  protected readonly CURRENCY = CURRENCY;
}
