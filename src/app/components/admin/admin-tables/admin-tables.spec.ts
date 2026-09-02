import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AdminTables } from './admin-tables';
import { RestaurantService } from '../../../services/restaurant.service';
import { Order, Table } from '../../../models/types';

function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: '1',
    number: '5',
    code: 'abc123',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

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

describe('AdminTables', () => {
  let component: AdminTables;
  let fixture: ComponentFixture<AdminTables>;
  let restaurantService: RestaurantService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AdminTables, HttpClientTestingModule],
      providers: [provideRouter([])],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    restaurantService = TestBed.inject(RestaurantService);
    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);

    fixture = TestBed.createComponent(AdminTables);
    component = fixture.componentInstance;

    fixture.detectChanges(); // ngOnInit -> loadTables() + loadOrders()
    httpMock.expectOne(req => req.url.endsWith('/tables/')).flush([]);
    httpMock.expectOne(req => req.url.endsWith('/orders/')).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('creates a table via the API and clears the input on success', () => {
    component.newTableNumber.set('12');

    component.submitNewTable();

    const req = httpMock.expectOne(r => r.url.endsWith('/tables/') && r.method === 'POST');
    expect(req.request.body).toEqual({ number: '12' });
    req.flush(makeTable({ id: '9', number: '12' }));

    expect(restaurantService.tables().map(t => t.number)).toEqual(['12']);
    expect(component.newTableNumber()).toBe('');
    expect(component.createError()).toBeNull();
  });

  it('surfaces a friendly error when the table number is already taken', () => {
    component.newTableNumber.set('5');

    component.submitNewTable();

    const req = httpMock.expectOne(r => r.url.endsWith('/tables/') && r.method === 'POST');
    req.flush({ number: ['table with this number already exists.'] }, { status: 400, statusText: 'Bad Request' });

    expect(component.createError()).toContain('already exists');
  });

  it('marks a table Available when it has no active order', () => {
    restaurantService.tables.set([makeTable({ id: '1', number: '5' })]);
    restaurantService.orders.set([]);

    expect(component.tableStatuses()['1'].label).toBe('Available');
    expect(component.tableStatuses()['1'].orderId).toBeNull();
  });

  it('reflects the active order status for an occupied table', () => {
    restaurantService.tables.set([makeTable({ id: '1', number: '5' })]);
    restaurantService.orders.set([makeOrder({ id: '77', tableNumber: '5', status: 'PREPARING' })]);

    const status = component.tableStatuses()['1'];
    expect(status.label).toBe('Preparing');
    expect(status.orderId).toBe('77');
  });

  it('treats a table with only completed/cancelled orders as Available again', () => {
    restaurantService.tables.set([makeTable({ id: '1', number: '5' })]);
    restaurantService.orders.set([makeOrder({ id: '77', tableNumber: '5', status: 'COMPLETED' })]);

    expect(component.tableStatuses()['1'].label).toBe('Available');
  });

  it('generates a QR code for every table it sees', async () => {
    restaurantService.tables.set([makeTable({ id: '1', number: '5', code: 'abc123' })]);
    TestBed.flushEffects();

    // QR generation is async (the qrcode library resolves via a promise chain);
    // a macrotask tick lets any pending microtasks settle before we assert.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(component.qrSvg(makeTable({ id: '1' }))).toBeTruthy();
  });
});
