import { Component, inject } from '@angular/core';
import { RestaurantService } from '../../services/restaurant.service';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CURRENCY as CUR } from '../../utils/constants';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  restaurantService = inject(RestaurantService);
  readonly CURRENCY = CUR;

  newItem = {
    name: '',
    price: 0,
    description: '',
    isSpecial: false,
    imageUrl: '',
  };

  expandedOrders = new Set<string>();

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.newItem.imageUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  addMenuItem() {
    if (this.newItem.name && this.newItem.price > 0) {
      this.restaurantService.addMenuItem(this.newItem);
      // Reset form
      this.newItem = {
        name: '',
        price: 0,
        description: '',
        isSpecial: false,
        imageUrl: '',
      };
    }
  }

  toggleDetails(orderId: string) {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
  }
}
