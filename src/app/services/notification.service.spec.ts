import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { RestaurantService } from './restaurant.service';
import { Order } from '../models/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: '1',
    tableNumber: '5',
    items: [],
    totalAmount: 10,
    status: 'NEW',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let restaurantService: RestaurantService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    httpMock = TestBed.inject(HttpTestingController);
    restaurantService = TestBed.inject(RestaurantService);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('creates a notification for a new order and increments the unread count', () => {
    restaurantService.lastEvent.set({ type: 'order_created', order: makeOrder({ id: '7', tableNumber: '3' }) });
    TestBed.flushEffects();

    expect(service.notifications().length).toBe(1);
    expect(service.notifications()[0].message).toContain('#7');
    expect(service.notifications()[0].message).toContain('Table 3');
    expect(service.unreadCount()).toBe(1);
  });

  it('notifies when an order becomes ready, but not for other minor transitions', () => {
    restaurantService.lastEvent.set({ type: 'order_created', order: makeOrder({ id: '9', status: 'NEW' }) });
    TestBed.flushEffects();
    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);

    restaurantService.lastEvent.set({ type: 'order_updated', order: makeOrder({ id: '9', status: 'ACCEPTED' }) });
    TestBed.flushEffects();
    expect(service.unreadCount()).toBe(0);

    restaurantService.lastEvent.set({ type: 'order_updated', order: makeOrder({ id: '9', status: 'READY' }) });
    TestBed.flushEffects();
    expect(service.unreadCount()).toBe(1);
  });

  it('markAllAsRead clears the unread count', () => {
    restaurantService.lastEvent.set({ type: 'order_created', order: makeOrder({ id: '3' }) });
    TestBed.flushEffects();
    expect(service.unreadCount()).toBe(1);

    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);
  });
});
