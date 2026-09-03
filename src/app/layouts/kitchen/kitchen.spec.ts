import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Kitchen } from './kitchen';
import { RestaurantService } from '../../services/restaurant.service';
import { MenuItem, Order } from '../../models/types';

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'm1',
    name: 'Burger',
    price: 9.99,
    description: '',
    isSpecial: false,
    available: true,
    displayOrder: 0,
    optionGroups: [],
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: '1',
    tableNumber: '5',
    items: [
      {
        id: 'i1',
        menuItem: makeMenuItem(),
        quantity: 1,
        completed: false,
      },
    ],
    totalAmount: 9.99,
    status: 'NEW',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

class FakeWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {}
  close() {}
}

describe('Kitchen', () => {
  let component: Kitchen;
  let fixture: ComponentFixture<Kitchen>;
  let restaurantService: RestaurantService;
  let httpMock: HttpTestingController;
  let originalWebSocket: any;

  beforeEach(async () => {
    localStorage.clear();
    originalWebSocket = (window as any).WebSocket;
    (window as any).WebSocket = FakeWebSocket;

    await TestBed.configureTestingModule({
      imports: [Kitchen, HttpClientTestingModule],
      providers: [provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    restaurantService = TestBed.inject(RestaurantService);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);

    fixture = TestBed.createComponent(Kitchen);
    component = fixture.componentInstance;

    // ngOnInit fires on the first detectChanges: it loads orders and opens the staff socket.
    fixture.detectChanges();
    httpMock.expectOne(req => req.url.endsWith('/orders/')).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    (window as any).WebSocket = originalWebSocket;
  });

  it('places a NEW order into the NEW column', () => {
    restaurantService.orders.set([makeOrder({ id: '1', status: 'NEW' })]);

    expect(component.columnOrders()['NEW'].map(o => o.id)).toEqual(['1']);
    expect(component.columnOrders()['PREPARING']).toEqual([]);
  });

  it('buckets ACCEPTED and PREPARING orders together into the PREPARING column', () => {
    restaurantService.orders.set([
      makeOrder({ id: '1', status: 'ACCEPTED' }),
      makeOrder({ id: '2', status: 'PREPARING' }),
    ]);

    const ids = component.columnOrders()['PREPARING'].map(o => o.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
  });

  it('moves an order between columns automatically when its status changes', () => {
    const order = makeOrder({ id: '1', status: 'PREPARING' });
    restaurantService.orders.set([order]);
    expect(component.columnOrders()['PREPARING'].map(o => o.id)).toEqual(['1']);

    restaurantService.orders.set([{ ...order, status: 'READY' }]);

    expect(component.columnOrders()['PREPARING']).toEqual([]);
    expect(component.columnOrders()['READY'].map(o => o.id)).toEqual(['1']);
  });

  it('ticks an individual item through the shared order-item endpoint', () => {
    const order = makeOrder({ id: '1', status: 'PREPARING' });
    restaurantService.orders.set([order]);

    component.toggleItem(order, 0);

    const req = httpMock.expectOne(r => r.url.endsWith('/order-items/i1/') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ completed: true });
    req.flush({ id: 'i1', completed: true, menuItem: order.items[0].menuItem, quantity: 1 });

    expect(restaurantService.orders()[0].items[0].completed).toBeTrue();
  });

  it('does not tick items for an order that is not yet being prepared', () => {
    const order = makeOrder({ id: '1', status: 'ACCEPTED' });
    restaurantService.orders.set([order]);

    component.toggleItem(order, 0);

    httpMock.expectNone(r => r.url.endsWith('/order-items/i1/'));
  });

  it('gates Mark Ready until every item is completed', () => {
    const order = makeOrder({
      id: '1',
      status: 'PREPARING',
      items: [
        { id: 'i1', menuItem: makeMenuItem(), quantity: 1, completed: false },
        { id: 'i2', menuItem: makeMenuItem({ id: 'm2', name: 'Fries', price: 3 }), quantity: 1, completed: true },
      ],
    });
    expect(component.allItemsComplete(order)).toBeFalse();

    const readyOrder = { ...order, items: order.items.map(i => ({ ...i, completed: true })) };
    expect(component.allItemsComplete(readyOrder)).toBeTrue();
  });

  it('flags an order as delayed once elapsed time crosses the threshold', () => {
    const fresh = makeOrder({ createdAt: new Date().toISOString() });
    const delayed = makeOrder({ createdAt: new Date(Date.now() - 25 * 60_000).toISOString() });

    expect(component.urgency(fresh)).toBe('normal');
    expect(component.urgency(delayed)).toBe('delayed');
  });

  it('highlights and plays a sound for a real-time new-order event, unless muted', () => {
    const soundSpy = spyOn(component, 'playSound' as any);

    const order = makeOrder({ id: '9', status: 'NEW' });
    restaurantService.orders.set([order]);
    restaurantService.lastEvent.set({ type: 'order_created', order });
    TestBed.flushEffects();

    expect(component.isNew('9')).toBeTrue();
    expect(soundSpy).toHaveBeenCalled();
  });

  it('does not play a sound for a new order once muted', () => {
    component.toggleSound();
    const soundSpy = spyOn(component, 'playSound' as any);

    const order = makeOrder({ id: '9', status: 'NEW' });
    restaurantService.orders.set([order]);
    restaurantService.lastEvent.set({ type: 'order_created', order });
    TestBed.flushEffects();

    expect(soundSpy).not.toHaveBeenCalled();
  });

  it('mutes sound and persists the preference to localStorage', () => {
    expect(component.soundMuted()).toBeFalse();

    component.toggleSound();

    expect(component.soundMuted()).toBeTrue();
    expect(localStorage.getItem('kitchenSoundMuted')).toBe('true');
  });

  it('shows the offline indicator while the staff socket is reconnecting or polling', () => {
    restaurantService.connectionState.set('reconnecting');
    expect(component.isOffline()).toBeTrue();

    restaurantService.connectionState.set('polling');
    expect(component.isOffline()).toBeTrue();

    restaurantService.connectionState.set('open');
    expect(component.isOffline()).toBeFalse();
  });
});
