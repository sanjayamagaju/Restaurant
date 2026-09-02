import {Component, OnDestroy, OnInit, computed, inject, signal} from '@angular/core';
import {DatePipe, NgClass} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {RestaurantService} from '../../services/restaurant.service';
import {NotificationService} from '../../services/notification.service';
import {CURRENCY} from '../../utils/constants';
import {isToday} from '../../utils/order-timing';


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
export class Admin implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  restaurantService = inject(RestaurantService);
  notificationService = inject(NotificationService);
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
    {
      key: 'tables',
      name: 'Tables',
      icon: 'bi-qr-code',
      route: 'tables',
    },
    {
      key: 'kitchen',
      name: 'Kitchen Display',
      icon: 'bi-fire',
      route: '/admin/kitchen',
    },
  ]

  completedTodayCount = computed(() =>
    this.restaurantService.completedOrders().filter(o => isToday(o.completedAt ?? o.createdAt, Date.now())).length
  );
  cancelledTodayCount = computed(() =>
    this.restaurantService.cancelledOrders().filter(o => isToday(o.cancelledAt ?? o.createdAt, Date.now())).length
  );
  revenueToday = computed(() =>
    this.restaurantService.completedOrders()
      .filter(o => isToday(o.completedAt ?? o.createdAt, Date.now()))
      .reduce((sum, o) => sum + o.totalAmount, 0)
  );

  pendingCount = computed(() => this.restaurantService.pendingCount());
  newCount = computed(() => this.restaurantService.newOrders().length);
  preparingCount = computed(() => this.restaurantService.preparingOrders().length);
  readyCount = computed(() => this.restaurantService.readyOrders().length);
  servedCount = computed(() => this.restaurantService.servedOrders().length);
  menuItemsCount = computed(() => this.restaurantService.menuItems().length);
  connectionState = computed(() => this.restaurantService.connectionState());

  showNotifications = signal(false);

  ngOnInit() {
    this.restaurantService.loadOrders();
    this.restaurantService.connectStaffSocket();
  }

  ngOnDestroy() {
    this.restaurantService.disconnectStaffSocket();
  }

  trackByKey(index: number) {
    return index;
  }

  logout() {
    this.restaurantService.disconnectStaffSocket();
    this.authService.logout();
    this.router.navigateByUrl('/admin-login');
  }

  toggleNotifications() {
    this.showNotifications.update(v => !v);
  }

  markAllNotificationsRead() {
    this.notificationService.markAllAsRead();
  }

  viewNotification(notification: { id: string; orderId: string }) {
    this.notificationService.markAsRead(notification.id);
    this.showNotifications.set(false);
    this.router.navigate(['/admin/orders'], { queryParams: { orderId: notification.orderId } });
  }

}
