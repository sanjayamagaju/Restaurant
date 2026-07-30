import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MenuItem, OrderItem} from '../../models/types';
import {RestaurantService} from '../../services/restaurant.service';
import {CURRENCY as CUR} from '../../utils/constants';


@Component({
  selector: 'app-user',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user.html',
  styleUrl: './user.css',
})
export class User {
  restaurantService = inject(RestaurantService);
  readonly CURRENCY = CUR;

  tempTable = '';
  cartItems = signal<OrderItem[]>([]);
  showSuccess = signal(false);

  cartTotal = computed(() => {
    return this.cartItems().reduce((total, item) => total + item.menuItem.price * item.quantity, 0);
  });

  setTableNumber() {
    if (this.tempTable.trim()) {
      this.restaurantService.setTableNumber(this.tempTable.trim());
    }
  }

  logout() {
    this.restaurantService.setTableNumber('');
    localStorage.removeItem('restaurantTable');
    this.cartItems.set([]);
  }

  addToCart(menuItem: MenuItem) {
    this.cartItems.update((items) => {
      const existing = items.find((i) => i.menuItem.id === menuItem.id);
      if (existing) {
        return items.map((i) =>
          i.menuItem.id === menuItem.id ? {...i, quantity: i.quantity + 1} : i,
        );
      }
      return [...items, {menuItem, quantity: 1, completed: false}];
    });
    this.showSuccess.set(false);
  }

  updateQuantity(menuItem: MenuItem, delta: number) {
    this.cartItems.update((items) => {
      return items
        .map((i) => {
          if (i.menuItem.id === menuItem.id) {
            return {...i, quantity: Math.max(0, i.quantity + delta)};
          }
          return i;
        })
        .filter((i) => i.quantity > 0);
    });
  }

  placeOrder() {
    if (this.cartItems().length === 0) return;

    this.restaurantService.placeOrder(this.cartItems(), this.cartTotal());
    this.cartItems.set([]); // Clear cart
    this.showSuccess.set(true);

    setTimeout(() => {
      this.showSuccess.set(false);
    }, 4000);
  }
}
