import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { AnalyticsService } from './analytics.service';
import { AnalyticsOverview, MenuPerformanceRow } from '../models/analytics';

const ENDPOINTS = [
  '/overview/', '/trends/', '/menu-performance/', '/categories/',
  '/time-patterns/', '/tables/', '/feedback/',
];

function menuRow(overrides: Partial<MenuPerformanceRow> = {}): MenuPerformanceRow {
  return {
    menuItemId: 1,
    name: 'Chicken Burger',
    categoryId: 10,
    categoryName: 'Burgers',
    available: true,
    unitsSold: 10,
    revenue: 6500,
    orders: 8,
    ...overrides,
  };
}

function overviewResponse(): AnalyticsOverview {
  return {
    meta: {
      range: 'last7', label: 'Last 7 Days', from: '2026-09-03', to: '2026-09-09',
      comparisonLabel: 'vs previous 7 days',
    },
    kpis: {
      totalOrders: 12, completedOrders: 10, cancelledOrders: 2,
      revenue: 8000, itemsSold: 24, averageOrderValue: 800,
    },
    previous: {
      totalOrders: 10, completedOrders: 8, cancelledOrders: 2,
      revenue: 6400, itemsSold: 20, averageOrderValue: 800,
    },
    comparison: {
      totalOrders: { value: 20, label: null },
      completedOrders: { value: 25, label: null },
      cancelledOrders: { value: 0, label: null },
      revenue: { value: 25, label: null },
      itemsSold: { value: 20, label: null },
      averageOrderValue: { value: 0, label: null },
    },
    statusBreakdown: [{ status: 'COMPLETED', label: 'Completed', count: 10 }],
    cancellation: { cancelledOrders: 2, totalOrders: 12, rate: 16.7, reasons: [] },
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function expectAll(): HttpRequest<unknown>[] {
    return ENDPOINTS.map(path => {
      const request = httpMock.expectOne(req => req.url.includes(`/analytics${path}`));
      return request.request;
    });
  }

  it('defaults to the last 7 days', () => {
    expect(service.dateRange().preset).toBe('last7');
  });

  it('loads every widget with one identical date range', () => {
    service.loadAll();
    const requests = expectAll();

    const ranges = requests.map(request => request.params.get('range'));
    expect(new Set(ranges).size).toBe(1);
    expect(ranges[0]).toBe('last7');
    requests.forEach(() => undefined);
    httpMock.match(() => true).forEach(req => req.flush({}));
  });

  it('sends explicit from/to only for a custom range', () => {
    service.setCustomRange('2026-09-01', '2026-09-07');
    const requests = expectAll();

    requests.forEach(request => {
      expect(request.params.get('range')).toBe('custom');
      expect(request.params.get('from')).toBe('2026-09-01');
      expect(request.params.get('to')).toBe('2026-09-07');
    });
    httpMock.match(() => true).forEach(req => req.flush({}));
  });

  it('records a lastUpdated timestamp on refresh', () => {
    expect(service.lastUpdated()).toBeNull();
    service.loadAll();
    expect(service.lastUpdated()).not.toBeNull();
    httpMock.match(() => true).forEach(req => req.flush({}));
  });

  it('exposes per-widget loading state and clears it on success', () => {
    service.loadOverview();
    expect(service.overview().loading).toBe(true);

    httpMock.expectOne(req => req.url.includes('/overview/')).flush(overviewResponse());

    expect(service.overview().loading).toBe(false);
    expect(service.overview().error).toBeNull();
    expect(service.overview().data?.kpis.revenue).toBe(8000);
  });

  it('records an error on one widget without touching the others', () => {
    service.loadOverview();
    service.loadTables();

    httpMock.expectOne(req => req.url.includes('/overview/'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(req => req.url.includes('/tables/')).flush({ tables: [] });

    expect(service.overview().error).toBe('Unable to load analytics.');
    expect(service.overview().loading).toBe(false);
    expect(service.tables().error).toBeNull();
  });

  it('retries a single widget without reloading the dashboard', () => {
    service.loadOverview();
    httpMock.expectOne(req => req.url.includes('/overview/'))
      .flush('boom', { status: 500, statusText: 'Server Error' });

    service.loadOverview();
    expect(service.overview().error).toBeNull();
    httpMock.expectOne(req => req.url.includes('/overview/')).flush(overviewResponse());
    expect(service.overview().data).not.toBeNull();
  });

  describe('menu performance view state', () => {
    beforeEach(() => {
      service.loadMenuPerformance();
      httpMock.expectOne(req => req.url.includes('/menu-performance/')).flush({
        meta: overviewResponse().meta,
        items: [
          menuRow({ menuItemId: 1, name: 'Chicken Burger', unitsSold: 10, revenue: 6500, categoryId: 10 }),
          menuRow({ menuItemId: 2, name: 'Cold Coffee', categoryName: 'Drinks', categoryId: 20, unitsSold: 25, revenue: 5000 }),
          menuRow({ menuItemId: 3, name: 'Momo', categoryId: 10, unitsSold: 2, revenue: 900 }),
        ],
      });
    });

    it('sorts by revenue descending by default', () => {
      expect(service.visibleMenuRows().map(row => row.name))
        .toEqual(['Chicken Burger', 'Cold Coffee', 'Momo']);
    });

    it('sorts by units when asked', () => {
      service.menuSort.set('units');
      expect(service.visibleMenuRows()[0].name).toBe('Cold Coffee');
    });

    it('sorts ascending when the direction flips', () => {
      service.menuSort.set('units');
      service.menuSortDescending.set(false);
      expect(service.visibleMenuRows()[0].name).toBe('Momo');
    });

    it('filters by search across item and category names', () => {
      service.menuSearch.set('momo');
      expect(service.visibleMenuRows().map(row => row.name)).toEqual(['Momo']);

      service.menuSearch.set('drinks');
      expect(service.visibleMenuRows().map(row => row.name)).toEqual(['Cold Coffee']);
    });

    it('filters by category', () => {
      service.menuCategoryFilter.set('20');
      expect(service.visibleMenuRows().map(row => row.name)).toEqual(['Cold Coffee']);
    });

    it('derives top sellers, top revenue and low sales from the one response', () => {
      expect(service.topSellingItems()[0].name).toBe('Cold Coffee');
      expect(service.topRevenueItems()[0].name).toBe('Chicken Burger');
      expect(service.lowSalesItems()[0].name).toBe('Momo');
    });

    it('does not issue a request when sorting or filtering', () => {
      service.menuSort.set('units');
      service.menuSearch.set('momo');
      service.menuCategoryFilter.set('10');
      service.visibleMenuRows();
      httpMock.verify(); // no outstanding requests
    });
  });

  describe('CSV export', () => {
    it('requests CSV with the current range and triggers one download', () => {
      const anchor = document.createElement('a');
      const clickSpy = spyOn(anchor, 'click');
      spyOn(document, 'createElement').and.returnValue(anchor);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
      const revokeSpy = spyOn(URL, 'revokeObjectURL');

      service.exportMenuPerformance();

      const request = httpMock.expectOne(req => req.url.includes('/menu-performance/'));
      expect(request.request.params.get('export')).toBe('csv');
      expect(request.request.params.get('range')).toBe('last7');
      expect(request.request.responseType).toBe('text');

      request.flush('Item,Units Sold\nMomo,2\n');

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(anchor.download).toContain('menu-performance');
      expect(revokeSpy).toHaveBeenCalled();
      expect(service.exporting()).toBeNull();
    });

    it('surfaces an export failure instead of downloading', () => {
      service.exportTables();
      httpMock.expectOne(req => req.url.includes('/tables/'))
        .flush('nope', { status: 500, statusText: 'Server Error' });

      expect(service.exportError()).toBe('Export failed. Please try again.');
      expect(service.exporting()).toBeNull();
    });
  });
});
