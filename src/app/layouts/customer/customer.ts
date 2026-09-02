import {Component, computed, inject, signal} from '@angular/core';
import {NgClass} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CartLine, MenuItem} from '../../models/types';
import {RestaurantService, ALL_CATEGORIES_ID, SPECIALS_CATEGORY_ID} from '../../services/restaurant.service';
import {CustomerOrderStatus} from '../../components/customer-order-status/customer-order-status';
import {AddToCartEvent, CartLineSelection, MenuItemDetail} from '../../components/menu-item-detail/menu-item-detail';
import {cartLineKey} from '../../utils/cart';
import {CURRENCY as CUR} from '../../utils/constants';

interface CategoryTab {
  id: string;
  name: string;
}

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [FormsModule, NgClass, CustomerOrderStatus, MenuItemDetail],
  templateUrl: './customer.html',
  styleUrl: './customer.css',
})
export class Customer {
  restaurantService = inject(RestaurantService);
  readonly CURRENCY = CUR;
  readonly ALL_CATEGORIES_ID = ALL_CATEGORIES_ID;
  readonly SPECIALS_CATEGORY_ID = SPECIALS_CATEGORY_ID;

  tempTable = '';
  cartLines = signal<CartLine[]>([]);
  orderNotes = signal('');
  showSuccess = signal(false);
  bumpCart = signal(false);
  orderError = signal<string | null>(null);
  private bumpTimeout?: ReturnType<typeof setTimeout>;

  // Item detail / customization modal state
  activeItem = signal<MenuItem | null>(null);
  editingLineKey = signal<string | null>(null);
  activeItemInitialSelection = signal<CartLineSelection | null>(null);

  categoryTabs = computed<CategoryTab[]>(() => {
    const tabs: CategoryTab[] = [{id: ALL_CATEGORIES_ID, name: 'All'}];
    if (this.restaurantService.specialMenuItems().length > 0) {
      tabs.push({id: SPECIALS_CATEGORY_ID, name: 'Specials'});
    }
    for (const category of this.restaurantService.activeCategories()) {
      tabs.push({id: category.id, name: category.name});
    }
    return tabs;
  });

  cartTotal = computed(() => {
    return this.cartLines().reduce((total, line) => total + this.lineUnitPrice(line) * line.quantity, 0);
  });

  cartCount = computed(() => {
    return this.cartLines().reduce((count, line) => count + line.quantity, 0);
  });

  lineUnitPrice(line: CartLine): number {
    return line.menuItem.price + line.selectedOptions.reduce((sum, o) => sum + o.additionalPrice, 0);
  }

  setTableNumber() {
    if (this.tempTable.trim()) {
      this.restaurantService.setTableNumber(this.tempTable.trim());
    }
  }

  logout() {
    this.restaurantService.setTableNumber('');
    localStorage.removeItem('restaurantTable');
    this.restaurantService.clearTrackedOrder();
    this.cartLines.set([]);
  }

  selectCategory(id: string) {
    this.restaurantService.selectedCategoryId.set(id);
  }

  updateSearch(value: string) {
    this.restaurantService.menuSearchQuery.set(value);
  }

  openItem(item: MenuItem) {
    if (!item.available) return;
    this.editingLineKey.set(null);
    this.activeItemInitialSelection.set(null);
    this.activeItem.set(item);
  }

  editCartLine(line: CartLine) {
    this.editingLineKey.set(line.key);
    this.activeItemInitialSelection.set({
      selectedOptions: line.selectedOptions,
      quantity: line.quantity,
      specialInstructions: line.specialInstructions,
    });
    this.activeItem.set(line.menuItem);
  }

  closeItemDetail() {
    this.activeItem.set(null);
    this.editingLineKey.set(null);
    this.activeItemInitialSelection.set(null);
  }

  onAddToCart(event: AddToCartEvent) {
    const item = this.activeItem();
    if (!item) return;

    const editingKey = this.editingLineKey();
    if (editingKey) {
      this.cartLines.update(lines => lines.filter(l => l.key !== editingKey));
    }

    const key = cartLineKey(item.id, event.selectedOptions, event.specialInstructions);
    this.cartLines.update(lines => {
      const existing = lines.find(l => l.key === key);
      if (existing) {
        return lines.map(l => (l.key === key ? {...l, quantity: l.quantity + event.quantity} : l));
      }
      return [...lines, {
        key,
        menuItem: item,
        quantity: event.quantity,
        selectedOptions: event.selectedOptions,
        specialInstructions: event.specialInstructions,
      }];
    });

    this.closeItemDetail();
    this.showSuccess.set(false);
    this.orderError.set(null);
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

  updateLineQuantity(line: CartLine, delta: number) {
    this.cartLines.update(lines => {
      return lines
        .map(l => (l.key === line.key ? {...l, quantity: Math.max(0, l.quantity + delta)} : l))
        .filter(l => l.quantity > 0);
    });
  }

  removeLine(line: CartLine) {
    this.cartLines.update(lines => lines.filter(l => l.key !== line.key));
  }

  placeOrder() {
    if (this.cartLines().length === 0) return;

    this.orderError.set(null);
    const result = this.restaurantService.placeOrder(this.cartLines(), this.orderNotes().trim());
    if (!result) return;

    result.subscribe({
      next: () => {
        this.cartLines.set([]);
        this.orderNotes.set('');
        this.showSuccess.set(true);
        setTimeout(() => this.showSuccess.set(false), 4000);
      },
      error: (err) => {
        const message = (err as { error?: { items?: unknown; detail?: string } })?.error;
        const text = typeof message?.items === 'string' ? message.items
          : Array.isArray(message?.items) && typeof message.items[0] === 'string' ? message.items[0]
          : message?.detail ?? 'Something in your cart is no longer available. Please review your cart.';
        this.orderError.set(text);
        // Reconcile local menu state (availability/options may have changed).
        this.restaurantService.loadMenuItems();
      },
    });
  }
}
