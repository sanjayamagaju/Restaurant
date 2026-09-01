import {Component, computed, inject, signal} from '@angular/core';
import {NgClass} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MenuItem, OrderItem} from '../../models/types';
import {RestaurantService} from '../../services/restaurant.service';
import {CURRENCY as CUR} from '../../utils/constants';


@Component({
  selector: 'app-user',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './customer.html',
  styleUrl: './customer.css',
})
export class Customer {
  restaurantService = inject(RestaurantService);
  readonly CURRENCY = CUR;

  tempTable = '';
  cartItems = signal<OrderItem[]>([]);
  showSuccess = signal(false);
  bumpCart = signal(false);
  private bumpTimeout?: ReturnType<typeof setTimeout>;

  cartTotal = computed(() => {
    return this.cartItems().reduce((total, item) => total + item.menuItem.price * item.quantity, 0);
  });

  cartCount = computed(() => {
    return this.cartItems().reduce((count, item) => count + item.quantity, 0);
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
    this.triggerCartBump();
  }

  private triggerCartBump() {
    this.bumpCart.set(false);
    clearTimeout(this.bumpTimeout);
    // Re-trigger the CSS animation on the next frame even if it's already mid-play.
    requestAnimationFrame(() => {
      this.bumpCart.set(true);
      this.bumpTimeout = setTimeout(() => this.bumpCart.set(false), 400);
    });
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
