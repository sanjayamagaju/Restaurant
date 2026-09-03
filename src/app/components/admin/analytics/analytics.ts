import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../../services/analytics.service';
import { RestaurantService } from '../../../services/restaurant.service';
import { DateRangePreset } from '../../../models/analytics';
import { DATE_RANGE_PRESETS, isValidCustomRange, toIsoDate } from '../../../utils/date-range';
import { AnalyticsWidget } from './analytics-widget';
import { CategoryPerformance } from './category-performance';
import { FeedbackSummary } from './feedback-summary';
import { KpiCards } from './kpi-cards';
import { MenuPerformance } from './menu-performance';
import { StatusBreakdown } from './status-breakdown';
import { TablePerformance } from './table-performance';
import { TimePatterns } from './time-patterns';
import { TrendChart } from './trend-chart';

/**
 * Analytics dashboard. One date range drives every widget: the range lives in
 * `AnalyticsService`, and each widget fetches its own slice with the same
 * parameters, so no two cards can ever describe different periods.
 */
@Component({
  selector: 'app-analytics',
  imports: [
    DatePipe,
    FormsModule,
    AnalyticsWidget,
    CategoryPerformance,
    FeedbackSummary,
    KpiCards,
    MenuPerformance,
    StatusBreakdown,
    TablePerformance,
    TimePatterns,
    TrendChart,
  ],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class Analytics implements OnInit {
  protected analytics = inject(AnalyticsService);
  private restaurantService = inject(RestaurantService);

  readonly presets = DATE_RANGE_PRESETS;
  readonly today = toIsoDate(new Date());

  dateRange = computed(() => this.analytics.dateRange());
  isCustom = computed(() => this.dateRange().preset === 'custom');
  lastUpdated = computed(() => this.analytics.lastUpdated());
  refreshing = computed(() => this.analytics.loading());

  customFrom = signal('');
  customTo = signal('');
  customError = signal<string | null>(null);

  ngOnInit() {
    const { from, to } = this.dateRange();
    this.customFrom.set(from);
    this.customTo.set(to);
    // Categories power the menu table's filter dropdown.
    if (!this.restaurantService.categories().length) {
      this.restaurantService.loadCategories();
    }
    this.analytics.loadAll();
  }

  selectPreset(preset: DateRangePreset) {
    this.customError.set(null);
    this.analytics.setPreset(preset);
    const { from, to } = this.analytics.dateRange();
    this.customFrom.set(from);
    this.customTo.set(to);
  }

  applyCustomRange() {
    const from = this.customFrom();
    const to = this.customTo();
    if (!isValidCustomRange(from, to)) {
      this.customError.set('Choose a start date on or before the end date.');
      return;
    }
    this.customError.set(null);
    this.analytics.setCustomRange(from, to);
  }

  refresh() {
    this.analytics.loadAll();
  }
}
