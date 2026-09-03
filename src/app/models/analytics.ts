/** Response shapes for the /api/analytics/* endpoints. */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'this_month'
  | 'prev_month'
  | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  /** Inclusive calendar dates (YYYY-MM-DD). The backend converts these to a
   *  half-open datetime range in the restaurant's configured timezone. */
  from: string;
  to: string;
}

export interface AnalyticsMeta {
  range: DateRangePreset;
  label: string;
  from: string;
  to: string;
  comparisonLabel: string;
  granularity?: TrendGranularity;
}

/** A percentage delta against the previous equivalent period. `value` is null
 *  when there is no usable baseline, in which case `label` carries the reason
 *  ('New' when growing from zero, '—' when both periods are empty). */
export interface Comparison {
  value: number | null;
  label: string | null;
}

export interface AnalyticsKpis {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  itemsSold: number;
  averageOrderValue: number;
}

export type KpiKey = keyof AnalyticsKpis;

export interface StatusBreakdownRow {
  status: string;
  label: string;
  count: number;
}

export interface CancellationReasonRow {
  reason: string;
  label: string;
  count: number;
}

export interface CancellationBreakdown {
  cancelledOrders: number;
  totalOrders: number;
  rate: number;
  reasons: CancellationReasonRow[];
}

export interface AnalyticsOverview {
  meta: AnalyticsMeta;
  kpis: AnalyticsKpis;
  previous: AnalyticsKpis;
  comparison: Record<KpiKey, Comparison>;
  statusBreakdown: StatusBreakdownRow[];
  cancellation: CancellationBreakdown;
}

export type TrendGranularity = 'hour' | 'day' | 'week' | 'month';

export interface TrendPoint {
  bucket: string;
  orders: number;
  revenue: number;
}

export interface TrendsResponse {
  meta: AnalyticsMeta;
  points: TrendPoint[];
}

export interface MenuPerformanceRow {
  menuItemId: number;
  name: string;
  categoryId: number | null;
  categoryName: string;
  available: boolean;
  unitsSold: number;
  revenue: number;
  orders: number;
}

export interface MenuPerformanceResponse {
  meta: AnalyticsMeta;
  items: MenuPerformanceRow[];
}

export interface CategoryPerformanceRow {
  category: string;
  unitsSold: number;
  revenue: number;
  orders: number;
  pctOfRevenue: number;
}

export interface CategoryPerformanceResponse {
  meta: AnalyticsMeta;
  categories: CategoryPerformanceRow[];
}

export interface HourRow {
  hour: number;
  orders: number;
  revenue: number;
}

export interface WeekdayRow {
  weekday: string;
  orders: number;
  revenue: number;
}

export interface TimePatternsResponse {
  meta: AnalyticsMeta;
  hours: HourRow[];
  weekdays: WeekdayRow[];
}

export interface TablePerformanceRow {
  tableNumber: string;
  orders: number;
  revenue: number;
  averageOrderValue: number;
}

export interface TablePerformanceResponse {
  meta: AnalyticsMeta;
  tables: TablePerformanceRow[];
}

export interface RatingDistributionRow {
  rating: number;
  count: number;
  pct: number;
}

export interface RecentFeedback {
  orderId: number;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface FeedbackResponse {
  meta: AnalyticsMeta;
  count: number;
  averageRating: number | null;
  distribution: RatingDistributionRow[];
  recent: RecentFeedback[];
}

export type MenuSortKey = 'revenue' | 'units' | 'orders' | 'name';
