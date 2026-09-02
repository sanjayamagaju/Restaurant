import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { AdminOrders } from './admin-orders';
import { RestaurantService } from '../../../services/restaurant.service';
import { Order } from '../../../models/types';

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

describe('AdminOrders', () => {
  let component: AdminOrders;
  let fixture: ComponentFixture<AdminOrders>;
  let restaurantService: RestaurantService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminOrders, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({})) },
        },
      ],
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    restaurantService = TestBed.inject(RestaurantService);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);

    fixture = TestBed.createComponent(AdminOrders);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('buckets orders into the right board column per status', () => {
    restaurantService.orders.set([
      makeOrder({ id: '1', status: 'NEW' }),
      makeOrder({ id: '2', status: 'PREPARING' }),
      makeOrder({ id: '3', status: 'READY' }),
    ]);
    fixture.detectChanges();

    const buckets = component.ordersByColumn();
    expect(buckets['NEW'].map(o => o.id)).toEqual(['1']);
    expect(buckets['PREPARING'].map(o => o.id)).toEqual(['2']);
    expect(buckets['READY'].map(o => o.id)).toEqual(['3']);
  });

  it('renders the correct status badge label for a NEW order', () => {
    restaurantService.orders.set([makeOrder({ id: '1', status: 'NEW' })]);
    fixture.detectChanges();

    const badgeText = (fixture.nativeElement as HTMLElement).textContent;
    expect(badgeText).toContain('New');
  });

  it('exposes the correct next action per status', () => {
    expect(component.nextAction('NEW')?.next).toBe('ACCEPTED');
    expect(component.nextAction('ACCEPTED')?.next).toBe('PREPARING');
    expect(component.nextAction('PREPARING')?.next).toBe('READY');
    expect(component.nextAction('READY')?.next).toBe('SERVED');
    expect(component.nextAction('SERVED')?.next).toBe('COMPLETED');
    expect(component.nextAction('COMPLETED')).toBeUndefined();
  });

  it('only allows cancelling orders that are not yet in the kitchen pipeline past PREPARING', () => {
    expect(component.canCancel('NEW')).toBeTrue();
    expect(component.canCancel('PREPARING')).toBeTrue();
    expect(component.canCancel('READY')).toBeFalse();
    expect(component.canCancel('COMPLETED')).toBeFalse();
  });

  it('performAction sends a PATCH and clears the in-flight flag on success', () => {
    const order = makeOrder({ id: '1', status: 'NEW' });
    restaurantService.orders.set([order]);

    component.performAction(order, 'ACCEPTED');
    expect(component.isUpdating('1')).toBeTrue();

    const req = httpMock.expectOne(r => r.url.endsWith('/orders/1/') && r.method === 'PATCH');
    req.flush(makeOrder({ id: '1', status: 'ACCEPTED' }));

    expect(component.isUpdating('1')).toBeFalse();
    expect(component.actionError()).toBeNull();
  });

  it('performAction surfaces a friendly error on an invalid transition', () => {
    const order = makeOrder({ id: '1', status: 'COMPLETED' });
    restaurantService.orders.set([order]);

    component.performAction(order, 'PREPARING');

    const req = httpMock.expectOne(r => r.url.endsWith('/orders/1/') && r.method === 'PATCH');
    req.flush({ status: ['Cannot transition order from COMPLETED to PREPARING.'] }, { status: 400, statusText: 'Bad Request' });

    expect(component.isUpdating('1')).toBeFalse();
    expect(component.actionError()).toContain('Cannot transition');
  });

  it('classifies urgency based on elapsed time since creation', () => {
    const fresh = makeOrder({ createdAt: new Date().toISOString() });
    const delayed = makeOrder({ createdAt: new Date(Date.now() - 25 * 60_000).toISOString() });

    expect(component.urgency(fresh)).toBe('normal');
    expect(component.urgency(delayed)).toBe('delayed');
  });
});
