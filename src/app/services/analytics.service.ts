import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AnalyticsOverview, CategoryPerformanceResponse, DateRange, DateRangePreset, FeedbackResponse,
  MenuPerformanceResponse, MenuPerformanceRow, MenuSortKey, TablePerformanceResponse,
  TimePatternsResponse, TrendsResponse,
} from '../models/analytics';
import { resolvePreset } from '../utils/date-range';

/** One widget's async state. Kept per-widget so a single failing request
 *  degrades one card instead of blanking the whole dashboard. */
export interface WidgetState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function initialState<T>(): WidgetState<T> {
  return { data: null, loading: false, error: null };
}

const GENERIC_ERROR = 'Unable to load analytics.';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/analytics`;

  dateRange = signal<DateRange>(resolvePreset('last7'));
  lastUpdated = signal<Date | null>(null);
  /** Path of the export currently in flight, so only that button shows a spinner. */
  exporting = signal<string | null>(null);
  exportError = signal<string | null>(null);

  overview = signal<WidgetState<AnalyticsOverview>>(initialState());
  trends = signal<WidgetState<TrendsResponse>>(initialState());
  menuPerformance = signal<WidgetState<MenuPerformanceResponse>>(initialState());
  categories = signal<WidgetState<CategoryPerformanceResponse>>(initialState());
  timePatterns = signal<WidgetState<TimePatternsResponse>>(initialState());
  tables = signal<WidgetState<TablePerformanceResponse>>(initialState());
  feedback = signal<WidgetState<FeedbackResponse>>(initialState());

  // Menu performance table controls (client-side view state over one fetch).
  menuSort = signal<MenuSortKey>('revenue');
  menuSortDescending = signal(true);
  menuSearch = signal('');
  menuCategoryFilter = signal<string>('');
  /** How many rows the Top/Low item lists show (Top 5 vs Top 10). */
  menuTopLimit = signal(5);

  loading = computed(() =>
    [this.overview(), this.trends(), this.menuPerformance(), this.categories(),
      this.timePatterns(), this.tables(), this.feedback()].some(state => state.loading),
  );

  private allMenuRows = computed<MenuPerformanceRow[]>(() => this.menuPerformance().data?.items ?? []);

  /** The menu table's visible rows, filtered and sorted in the browser over the
   *  already-aggregated response - no request per keystroke or sort click. */
  visibleMenuRows = computed<MenuPerformanceRow[]>(() => {
    const query = this.menuSearch().trim().toLowerCase();
    const categoryId = this.menuCategoryFilter();
    const sort = this.menuSort();
    const direction = this.menuSortDescending() ? -1 : 1;

    return this.allMenuRows()
      .filter(row => !query || row.name.toLowerCase().includes(query)
        || row.categoryName.toLowerCase().includes(query))
      .filter(row => !categoryId || String(row.categoryId) === categoryId)
      .slice()
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name) * direction;
        const key = sort === 'units' ? 'unitsSold' : sort === 'orders' ? 'orders' : 'revenue';
        return (a[key] - b[key]) * direction || a.name.localeCompare(b.name);
      });
  });

  /** Best sellers by units - the Top Selling Items list. */
  topSellingItems = computed(() =>
    this.allMenuRows().slice().sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
  );

  /** Best performers by revenue. */
  topRevenueItems = computed(() =>
    this.allMenuRows().slice().sort((a, b) => b.revenue - a.revenue).slice(0, 10),
  );

  /** Items with the least traction in the period. Neutral by design: these are
   *  low-sales items, not "bad" items. */
  lowSalesItems = computed(() =>
    this.allMenuRows()
      .slice()
      .sort((a, b) => a.unitsSold - b.unitsSold || a.revenue - b.revenue)
      .slice(0, 10),
  );

  setPreset(preset: DateRangePreset) {
    this.dateRange.set(resolvePreset(preset));
    if (preset !== 'custom') this.loadAll();
  }

  setCustomRange(from: string, to: string) {
    this.dateRange.set({ preset: 'custom', from, to });
    this.loadAll();
  }

  loadAll() {
    this.loadOverview();
    this.loadTrends();
    this.loadMenuPerformance();
    this.loadCategories();
    this.loadTimePatterns();
    this.loadTables();
    this.loadFeedback();
    this.lastUpdated.set(new Date());
  }

  loadOverview() {
    this.fetch('/overview/', this.overview);
  }

  loadTrends() {
    this.fetch('/trends/', this.trends);
  }

  loadMenuPerformance() {
    this.fetch('/menu-performance/', this.menuPerformance);
  }

  loadCategories() {
    this.fetch('/categories/', this.categories);
  }

  loadTimePatterns() {
    this.fetch('/time-patterns/', this.timePatterns);
  }

  loadTables() {
    this.fetch('/tables/', this.tables);
  }

  loadFeedback() {
    this.fetch('/feedback/', this.feedback);
  }

  private rangeParams(extra: Record<string, string> = {}): HttpParams {
    const { preset, from, to } = this.dateRange();
    let params = new HttpParams().set('range', preset);
    if (preset === 'custom') {
      params = params.set('from', from).set('to', to);
    }
    return Object.entries(extra).reduce((acc, [key, value]) => acc.set(key, value), params);
  }

  private fetch<T>(path: string, state: ReturnType<typeof signal<WidgetState<T>>>) {
    state.update(current => ({ ...current, loading: true, error: null }));
    this.http.get<T>(`${this.apiUrl}${path}`, { params: this.rangeParams() }).subscribe({
      next: data => state.set({ data, loading: false, error: null }),
      error: () => state.update(current => ({ ...current, loading: false, error: GENERIC_ERROR })),
    });
  }

  /** Fetch a CSV export and hand it to the browser as a download.
   *
   * Goes through HttpClient (rather than a plain link) so the auth interceptor
   * attaches the staff token, and prepends a BOM so spreadsheet apps read it
   * as UTF-8. */
  exportCsv(path: string, filename: string) {
    this.exporting.set(path);
    this.exportError.set(null);
    this.http.get(`${this.apiUrl}${path}`, {
      params: this.rangeParams({ export: 'csv' }),
      responseType: 'text',
    }).pipe(finalize(() => this.exporting.set(null))).subscribe({
      next: csv => this.triggerDownload(csv, filename),
      error: () => this.exportError.set('Export failed. Please try again.'),
    });
  }

  private triggerDownload(csv: string, filename: string) {
    const blob = new Blob([csv.startsWith('﻿') ? csv : `﻿${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportMenuPerformance() {
    const { from, to } = this.dateRange();
    this.exportCsv('/menu-performance/', `menu-performance-${from}-to-${to}.csv`);
  }

  exportCategories() {
    const { from, to } = this.dateRange();
    this.exportCsv('/categories/', `category-performance-${from}-to-${to}.csv`);
  }

  exportTables() {
    const { from, to } = this.dateRange();
    this.exportCsv('/tables/', `table-performance-${from}-to-${to}.csv`);
  }
}
