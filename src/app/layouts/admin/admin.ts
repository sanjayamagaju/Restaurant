import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {DatePipe, NgClass} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {RestaurantService} from '../../services/restaurant.service';
import {Order} from '../../models/types';
import {CURRENCY} from '../../utils/constants';


interface NavItem {
  key: string;
  name: string;
  icon: string;
  route: string;
}


@Component({
  selector: 'app-admin',
  imports: [
    FormsModule,
    RouterLink,
    RouterOutlet,
    RouterLinkActive,
    NgClass,
    DatePipe
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  restaurantService = inject(RestaurantService);
  protected readonly CURRENCY = CURRENCY;

  navItems: NavItem[] = [
    {
      key: 'orders',
      name: 'Orders',
      icon: 'bi-receipt',
      route: 'orders',
    },
    {
      key: 'menus',
      name: 'Menus',
      icon: 'bi-journal-bookmark',
      route: 'menus',
    },
  ]

  private isToday(isoDate: string) {
    const d = new Date(isoDate);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }

  completedToday = computed(() =>
    this.restaurantService.completedOrders().filter(o => this.isToday(o.createdAt))
  );

  pendingCount = computed(() => this.restaurantService.pendingOrders().length);
  completedTodayCount = computed(() => this.completedToday().length);
  revenueToday = computed(() =>
    this.completedToday().reduce((sum, o) => sum + o.totalAmount, 0)
  );
  menuItemsCount = computed(() => this.restaurantService.menuItems().length);

  showNotifications = signal(false);

  ngOnInit() {
    this.restaurantService.loadOrders();
  }

  trackByKey(index: number) {
    return index;
  }

  logout() {
    this.authService.logout();
    this.router.navigateByUrl('/admin-login');
  }

  toggleNotifications() {
    this.showNotifications.update(v => !v);
  }

  viewOrder(order: Order) {
    this.showNotifications.set(false);
    this.router.navigate(['/admin/orders'], { queryParams: { orderId: order.id } });
  }

}
