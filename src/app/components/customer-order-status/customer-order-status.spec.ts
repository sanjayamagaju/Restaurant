import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { CustomerOrderStatus } from './customer-order-status';
import { RestaurantService } from '../../services/restaurant.service';
import { Order } from '../../models/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: '5',
    tableNumber: '2',
    items: [],
    totalAmount: 20,
    status: 'PREPARING',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('CustomerOrderStatus', () => {
  let component: CustomerOrderStatus;
  let fixture: ComponentFixture<CustomerOrderStatus>;
  let restaurantService: RestaurantService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CustomerOrderStatus, HttpClientTestingModule],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    restaurantService = TestBed.inject(RestaurantService);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);

    fixture = TestBed.createComponent(CustomerOrderStatus);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('renders nothing when there is no tracked order', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.order-status-card')).toBeNull();
  });

  it('marks earlier steps done and the current status as current', () => {
    restaurantService.orders.set([makeOrder({ status: 'PREPARING' })]);
    restaurantService.trackedOrderId.set('5');
    fixture.detectChanges();

    expect(component.stepState('NEW')).toBe('done');
    expect(component.stepState('ACCEPTED')).toBe('done');
    expect(component.stepState('PREPARING')).toBe('current');
    expect(component.stepState('READY')).toBe('upcoming');
    expect(component.stepState('COMPLETED')).toBe('upcoming');
  });

  it('shows a cancelled message instead of the timeline when the order is cancelled', () => {
    restaurantService.orders.set([makeOrder({ status: 'CANCELLED' })]);
    restaurantService.trackedOrderId.set('5');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('cancelled');
    expect(fixture.nativeElement.querySelector('.order-timeline')).toBeNull();
  });

  it('dismiss() clears the tracked order', () => {
    restaurantService.orders.set([makeOrder({ status: 'COMPLETED' })]);
    restaurantService.trackedOrderId.set('5');

    component.dismiss();

    expect(restaurantService.trackedOrderId()).toBeNull();
  });
});
