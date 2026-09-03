import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalyticsService } from '../../../services/analytics.service';
import { HourRow, WeekdayRow } from '../../../models/analytics';
import { CURRENCY } from '../../../utils/constants';
import { AnalyticsWidget } from './analytics-widget';

interface Bar {
  label: string;
  orders: number;
  revenue: number;
  pct: number;
}

/** Peak hours and day-of-week demand, both from the one time-patterns response. */
@Component({
  selector: 'app-time-patterns',
  imports: [DecimalPipe, AnalyticsWidget],
  templateUrl: './time-patterns.html',
})
export class TimePatterns {
  private analytics = inject(AnalyticsService);
  protected readonly CURRENCY = CURRENCY;

  state = computed(() => this.analytics.timePatterns());

  private hours = computed<HourRow[]>(() => this.state().data?.hours ?? []);
  private weekdays = computed<WeekdayRow[]>(() => this.state().data?.weekdays ?? []);

  isEmpty = computed(() => this.hours().every(hour => hour.orders === 0));

  /** Only hours that saw orders - a 24-row list of mostly zeroes reads as noise. */
  hourBars = computed<Bar[]>(() => {
    const rows = this.hours().filter(row => row.orders > 0);
    const peak = Math.max(...rows.map(row => row.orders), 1);
    return rows.map(row => ({
      label: this.hourLabel(row.hour),
      orders: row.orders,
      revenue: Number(row.revenue),
      pct: (row.orders / peak) * 100,
    }));
  });

  weekdayBars = computed<Bar[]>(() => {
    const rows = this.weekdays();
    const peak = Math.max(...rows.map(row => row.orders), 1);
    return rows.map(row => ({
      label: row.weekday,
      orders: row.orders,
      revenue: Number(row.revenue),
      pct: (row.orders / peak) * 100,
    }));
  });

  busiestHour = computed(() => {
    const bars = this.hourBars();
    if (!bars.length) return null;
    return bars.reduce((best, bar) => (bar.orders > best.orders ? bar : best), bars[0]);
  });

  busiestDay = computed(() => {
    const bars = this.weekdayBars().filter(bar => bar.orders > 0);
    if (!bars.length) return null;
    return bars.reduce((best, bar) => (bar.orders > best.orders ? bar : best), bars[0]);
  });

  private hourLabel(hour: number): string {
    const suffix = hour < 12 ? 'AM' : 'PM';
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display} ${suffix}`;
  }

  retry() {
    this.analytics.loadTimePatterns();
  }
}
