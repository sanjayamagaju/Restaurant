import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RestaurantService } from './restaurant.service';
import { Order, Table } from '../models/types';

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

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: '1',
    number: '5',
    code: 'abc123',
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

describe('RestaurantService', () => {
  let service: RestaurantService;
  let httpMock: HttpTestingController;
  let originalWebSocket: any;

  beforeEach(() => {
    localStorage.clear();
    originalWebSocket = (window as any).WebSocket;
    (window as any).WebSocket = FakeWebSocket;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(RestaurantService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    (window as any).WebSocket = originalWebSocket;
  });

  it('classifies orders into the correct lifecycle signals', () => {
    service.orders.set([
      makeOrder({ id: '1', status: 'NEW' }),
      makeOrder({ id: '2', status: 'ACCEPTED' }),
      makeOrder({ id: '3', status: 'PREPARING' }),
      makeOrder({ id: '4', status: 'READY' }),
      makeOrder({ id: '5', status: 'SERVED' }),
      makeOrder({ id: '6', status: 'COMPLETED' }),
      makeOrder({ id: '7', status: 'CANCELLED' }),
    ]);

    expect(service.newOrders().length).toBe(1);
    expect(service.acceptedOrders().length).toBe(1);
    expect(service.preparingOrders().length).toBe(1);
    expect(service.readyOrders().length).toBe(1);
    expect(service.servedOrders().length).toBe(1);
    expect(service.completedOrders().length).toBe(1);
    expect(service.cancelledOrders().length).toBe(1);
  });

  it('exposes pendingCount reactively based on NEW orders only', () => {
    service.orders.set([makeOrder({ id: '1', status: 'NEW' })]);
    expect(service.pendingCount()).toBe(1);

    service.orders.set([makeOrder({ id: '1', status: 'ACCEPTED' })]);
    expect(service.pendingCount()).toBe(0);
  });

  it('sends a PATCH and merges the response when transitioning a status', () => {
    service.orders.set([makeOrder({ id: '1', status: 'NEW' })]);

    service.updateOrderStatus('1', 'ACCEPTED').subscribe();

    const req = httpMock.expectOne(r => r.url.endsWith('/orders/1/') && r.method === 'PATCH');
    expect(req.request.body).toEqual({ status: 'ACCEPTED' });
    req.flush(makeOrder({ id: '1', status: 'ACCEPTED' }));

    expect(service.orders()[0].status).toBe('ACCEPTED');
    expect(service.acceptedOrders().length).toBe(1);
    expect(service.newOrders().length).toBe(0);
  });

  it('tracks a newly placed order for customer-side recovery', () => {
    service.currentTable.set('5');

    service.placeOrder([], 10);

    const req = httpMock.expectOne(r => r.url.endsWith('/orders/') && r.method === 'POST');
    req.flush(makeOrder({ id: '42', status: 'NEW' }));

    expect(service.trackedOrderId()).toBe('42');
    expect(service.trackedOrder()?.id).toBe('42');
    expect(localStorage.getItem('lastOrderId')).toBe('42');
  });

  it('clears tracked order state when clearTrackedOrder is called', () => {
    service.orders.set([makeOrder({ id: '42' })]);
    service.trackedOrderId.set('42');
    localStorage.setItem('lastOrderId', '42');

    service.clearTrackedOrder();

    expect(service.trackedOrderId()).toBeNull();
    expect(localStorage.getItem('lastOrderId')).toBeNull();
  });

  it('loads and appends tables', () => {
    service.loadTables();
    httpMock.expectOne(r => r.url.endsWith('/tables/') && r.method === 'GET').flush([makeTable()]);
    expect(service.tables().length).toBe(1);

    service.createTable('9').subscribe();
    const req = httpMock.expectOne(r => r.url.endsWith('/tables/') && r.method === 'POST');
    expect(req.request.body).toEqual({ number: '9' });
    req.flush(makeTable({ id: '2', number: '9' }));

    expect(service.tables().map(t => t.number)).toEqual(['5', '9']);
  });

  it('builds a table QR url from its code', () => {
    const url = service.qrUrlForTable('xyz789');
    expect(url).toContain('?t=xyz789');
  });
});

describe('RestaurantService — QR table auto-detection', () => {
  let httpMock: HttpTestingController;
  let originalWebSocket: any;

  beforeEach(() => {
    localStorage.clear();
    originalWebSocket = (window as any).WebSocket;
    (window as any).WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    (window as any).WebSocket = originalWebSocket;
    window.history.replaceState({}, '', window.location.pathname);
  });

  it('resolves a scanned table code and sets the current table', () => {
    window.history.pushState({}, '', '?t=abc123');

    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const service = TestBed.inject(RestaurantService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);

    const req = httpMock.expectOne(r => r.url.endsWith('/tables/resolve/abc123/'));
    req.flush({ number: '7' });

    expect(service.currentTable()).toBe('7');
    expect(window.location.search).toBe('');
  });

  it('falls back to the previously saved table when the scanned code is invalid', () => {
    localStorage.setItem('restaurantTable', '3');
    window.history.pushState({}, '', '?t=bad-code');

    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const service = TestBed.inject(RestaurantService);
    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);

    const req = httpMock.expectOne(r => r.url.endsWith('/tables/resolve/bad-code/'));
    req.flush({ detail: 'Not found.' }, { status: 404, statusText: 'Not Found' });

    expect(service.currentTable()).toBe('3');
  });
});
