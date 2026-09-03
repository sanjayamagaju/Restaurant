import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AnalyticsService } from '../../../services/analytics.service';
import { AnalyticsOverview, FeedbackResponse, TrendsResponse } from '../../../models/analytics';
import { AnalyticsWidget } from './analytics-widget';
import { FeedbackSummary } from './feedback-summary';
import { KpiCards } from './kpi-cards';
import { StatusBreakdown } from './status-breakdown';
import { TimePatterns } from './time-patterns';
import { TrendChart } from './trend-chart';

const META = {
  range: 'last7' as const, label: 'Last 7 Days', from: '2026-09-03', to: '2026-09-09',
  comparisonLabel: 'vs previous 7 days',
};

function overview(overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview {
  return {
    meta: META,
    kpis: {
      totalOrders: 1248, completedOrders: 1102, cancelledOrders: 38,
      revenue: 845250, itemsSold: 3421, averageOrderValue: 677,
    },
    previous: {
      totalOrders: 1100, completedOrders: 1000, cancelledOrders: 50,
      revenue: 752000, itemsSold: 3100, averageOrderValue: 700,
    },
    comparison: {
      totalOrders: { value: 13.5, label: null },
      completedOrders: { value: 10.2, label: null },
      cancelledOrders: { value: -24, label: null },
      revenue: { value: 12.4, label: null },
      itemsSold: { value: 10.4, label: null },
      averageOrderValue: { value: null, label: 'New' },
    },
    statusBreakdown: [
      { status: 'COMPLETED', label: 'Completed', count: 1102 },
      { status: 'PREPARING', label: 'Preparing', count: 52 },
      { status: 'CANCELLED', label: 'Cancelled', count: 38 },
    ],
    cancellation: {
      cancelledOrders: 38, totalOrders: 1216, rate: 3.1,
      reasons: [{ reason: 'CUSTOMER_REQUEST', label: 'Customer request', count: 18 }],
    },
    ...overrides,
  };
}

describe('Analytics dashboard widgets', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match(() => true).forEach(request => request.flush({}));
  });

  describe('KpiCards', () => {
    let fixture: ComponentFixture<KpiCards>;

    beforeEach(() => {
      fixture = TestBed.createComponent(KpiCards);
    });

    it('renders all six KPIs with their values', () => {
      service.overview.set({ data: overview(), loading: false, error: null });
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Total Orders');
      expect(text).toContain('1,248');
      expect(text).toContain('Revenue');
      expect(text).toContain('845,250');
      expect(text).toContain('Average Order Value');
      expect(text).toContain('Completed');
      expect(text).toContain('Cancelled');
      expect(text).toContain('Items Sold');
      expect(text).toContain('3,421');
    });

    it('shows an arrow and percentage against the previous period', () => {
      service.overview.set({ data: overview(), loading: false, error: null });
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('↑ 12.4%');
      expect(text).toContain('vs previous 7 days');
    });

    it('shows "New" rather than an infinite percentage when there is no baseline', () => {
      service.overview.set({ data: overview(), loading: false, error: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('New');
    });

    it('treats a fall in cancellations as good news and a rise as bad', () => {
      service.overview.set({ data: overview(), loading: false, error: null });
      fixture.detectChanges();

      const cancelled = fixture.componentInstance.cards().find(card => card.key === 'cancelledOrders')!;
      expect(fixture.componentInstance.deltaClass(cancelled)).toBe('text-success-emphasis');

      const revenue = fixture.componentInstance.cards().find(card => card.key === 'revenue')!;
      expect(fixture.componentInstance.deltaClass(revenue)).toBe('text-success-emphasis');
    });

    it('renders skeletons while loading', () => {
      service.overview.set({ data: null, loading: true, error: null });
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('.analytics-kpi-skeleton').length).toBeGreaterThan(0);
      expect(element.querySelector('[role="status"]')).toBeTruthy();
    });

    it('offers a retry when the request failed', () => {
      service.overview.set({ data: null, loading: false, error: 'Unable to load analytics.' });
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('Unable to load analytics.');

      const retry = element.querySelector('button') as HTMLButtonElement;
      expect(retry.textContent).toContain('Try Again');

      retry.click();
      httpMock.expectOne(request => request.url.includes('/overview/'));
    });
  });

  describe('AnalyticsWidget shell', () => {
    it('renders the empty state instead of zeroes when there is no data', () => {
      const fixture = TestBed.createComponent(AnalyticsWidget);
      fixture.componentRef.setInput('title', 'Table Performance');
      fixture.componentRef.setInput('empty', true);
      fixture.componentRef.setInput('emptyMessage', 'No orders found for this period.');
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('No orders found for this period.');
    });

    it('emits a retry event from the error branch', () => {
      const fixture = TestBed.createComponent(AnalyticsWidget);
      fixture.componentRef.setInput('error', 'Unable to load analytics.');
      fixture.detectChanges();

      let retried = false;
      fixture.componentInstance.retry.subscribe(() => (retried = true));
      (fixture.nativeElement as HTMLElement).querySelector('button')!.dispatchEvent(new Event('click'));

      expect(retried).toBe(true);
    });
  });

  describe('TrendChart', () => {
    function trends(points: TrendsResponse['points']): TrendsResponse {
      return { meta: { ...META, granularity: 'day' }, points };
    }

    it('plots a point per bucket and describes the series for assistive tech', () => {
      service.trends.set({
        data: trends([
          { bucket: '2026-09-03T00:00:00Z', orders: 4, revenue: 4000 },
          { bucket: '2026-09-04T00:00:00Z', orders: 6, revenue: 6000 },
          { bucket: '2026-09-05T00:00:00Z', orders: 2, revenue: 2000 },
        ]),
        loading: false,
        error: null,
      });

      const fixture = TestBed.createComponent(TrendChart);
      fixture.componentRef.setInput('metric', 'revenue');
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('circle.analytics-chart-point').length).toBe(3);
      expect(element.querySelector('polyline.analytics-chart-line')).toBeTruthy();

      const svg = element.querySelector('svg')!;
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label')).toContain('Revenue Trend');

      // The same numbers stay available as a table.
      expect(element.querySelector('table')).toBeTruthy();
      expect(element.textContent).toContain('12,000');
    });

    it('plots order counts when asked for the orders metric', () => {
      service.trends.set({
        data: trends([{ bucket: '2026-09-03T00:00:00Z', orders: 7, revenue: 0 }]),
        loading: false,
        error: null,
      });

      const fixture = TestBed.createComponent(TrendChart);
      fixture.componentRef.setInput('metric', 'orders');
      fixture.detectChanges();

      expect(fixture.componentInstance.plotted()[0].value).toBe(7);
      expect((fixture.nativeElement as HTMLElement).querySelector('svg')!.getAttribute('aria-label'))
        .toContain('Order Volume Trend');
    });

    it('shows an empty state when every bucket is zero', () => {
      service.trends.set({
        data: trends([{ bucket: '2026-09-03T00:00:00Z', orders: 0, revenue: 0 }]),
        loading: false,
        error: null,
      });

      const fixture = TestBed.createComponent(TrendChart);
      fixture.componentRef.setInput('metric', 'revenue');
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('No revenue recorded for this period.');
      expect(element.querySelector('svg')).toBeNull();
    });

    it('shows a skeleton while loading and a retry on failure', () => {
      service.trends.set({ data: null, loading: true, error: null });
      const fixture = TestBed.createComponent(TrendChart);
      fixture.componentRef.setInput('metric', 'revenue');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.analytics-chart-skeleton')).toBeTruthy();

      service.trends.set({ data: null, loading: false, error: 'Unable to load analytics.' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Try Again');
    });
  });

  describe('StatusBreakdown', () => {
    it('lists statuses and the cancellation rate', () => {
      service.overview.set({ data: overview(), loading: false, error: null });

      const fixture = TestBed.createComponent(StatusBreakdown);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Completed');
      expect(text).toContain('1,102');
      expect(text).toContain('3.1%');
      expect(text).toContain('38 cancelled / 1,216 orders');
      expect(text).toContain('Customer request');
    });
  });

  describe('TimePatterns', () => {
    it('lists only hours with orders, and every weekday Monday-first', () => {
      service.timePatterns.set({
        data: {
          meta: META,
          hours: Array.from({ length: 24 }, (_, hour) => ({
            hour,
            orders: hour === 12 ? 9 : hour === 19 ? 14 : 0,
            revenue: hour === 19 ? 9000 : 0,
          })),
          weekdays: [
            { weekday: 'Monday', orders: 3, revenue: 1000 },
            { weekday: 'Tuesday', orders: 5, revenue: 2000 },
            { weekday: 'Wednesday', orders: 0, revenue: 0 },
            { weekday: 'Thursday', orders: 0, revenue: 0 },
            { weekday: 'Friday', orders: 15, revenue: 9000 },
            { weekday: 'Saturday', orders: 0, revenue: 0 },
            { weekday: 'Sunday', orders: 0, revenue: 0 },
          ],
        },
        loading: false,
        error: null,
      });

      const fixture = TestBed.createComponent(TimePatterns);
      fixture.detectChanges();

      expect(fixture.componentInstance.hourBars().map(bar => bar.label)).toEqual(['12 PM', '7 PM']);
      expect(fixture.componentInstance.busiestHour()!.label).toBe('7 PM');
      expect(fixture.componentInstance.weekdayBars().length).toBe(7);
      expect(fixture.componentInstance.weekdayBars()[0].label).toBe('Monday');
      expect(fixture.componentInstance.busiestDay()!.label).toBe('Friday');
    });

    it('reports empty when nothing was ordered', () => {
      service.timePatterns.set({
        data: {
          meta: META,
          hours: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 })),
          weekdays: [],
        },
        loading: false,
        error: null,
      });

      const fixture = TestBed.createComponent(TimePatterns);
      fixture.detectChanges();

      expect(fixture.componentInstance.isEmpty()).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('No orders found for this period.');
    });
  });

  describe('FeedbackSummary', () => {
    function feedback(overrides: Partial<FeedbackResponse> = {}): FeedbackResponse {
      return {
        meta: META,
        count: 100,
        averageRating: 4.6,
        distribution: [
          { rating: 5, count: 72, pct: 72 },
          { rating: 4, count: 18, pct: 18 },
          { rating: 3, count: 6, pct: 6 },
          { rating: 2, count: 3, pct: 3 },
          { rating: 1, count: 1, pct: 1 },
        ],
        recent: [
          { orderId: 1042, rating: 5, comment: 'Great food and quick service.', createdAt: '2026-09-09T10:00:00Z' },
          { orderId: 1039, rating: 4, comment: 'Burger was good.', createdAt: '2026-09-09T09:00:00Z' },
        ],
        ...overrides,
      };
    }

    it('renders the average, the distribution and recent comments', () => {
      service.feedback.set({ data: feedback(), loading: false, error: null });

      const fixture = TestBed.createComponent(FeedbackSummary);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('4.6');
      expect(text).toContain('72%');
      expect(text).toContain('Great food and quick service.');
      expect(text).toContain('Order #1042');
    });

    it('exposes no table or customer identity in recent feedback', () => {
      service.feedback.set({ data: feedback(), loading: false, error: null });

      const fixture = TestBed.createComponent(FeedbackSummary);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Table');
    });

    it('shows an empty state when no ratings were left', () => {
      service.feedback.set({
        data: feedback({ count: 0, averageRating: null, recent: [] }),
        loading: false,
        error: null,
      });

      const fixture = TestBed.createComponent(FeedbackSummary);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent)
        .toContain('No feedback received for this period.');
    });
  });
});
