import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalyticsService } from '../../../services/analytics.service';
import { OrderStatus } from '../../../models/types';
import { ORDER_STATUS_META } from '../../../utils/constants';
import { AnalyticsWidget } from './analytics-widget';

/** Order status distribution plus cancellation rate, both from `overview`. */
@Component({
  selector: 'app-status-breakdown',
  imports: [DecimalPipe, AnalyticsWidget],
  templateUrl: './status-breakdown.html',
})
export class StatusBreakdown {
  private analytics = inject(AnalyticsService);

  state = computed(() => this.analytics.overview());

  rows = computed(() => {
    const breakdown = this.state().data?.statusBreakdown ?? [];
    const total = breakdown.reduce((sum, row) => sum + row.count, 0);
    return breakdown.map(row => ({
      ...row,
      pct: total ? (row.count / total) * 100 : 0,
      meta: ORDER_STATUS_META[row.status as OrderStatus],
    }));
  });

  cancellation = computed(() => this.state().data?.cancellation ?? null);
  isEmpty = computed(() => (this.state().data?.kpis.totalOrders ?? 0) === 0);

  retry() {
    this.analytics.loadOverview();
  }
}
