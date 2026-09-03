import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalyticsService } from '../../../services/analytics.service';
import { CURRENCY } from '../../../utils/constants';
import { AnalyticsWidget } from './analytics-widget';

@Component({
  selector: 'app-table-performance',
  imports: [DecimalPipe, AnalyticsWidget],
  templateUrl: './table-performance.html',
})
export class TablePerformance {
  private analytics = inject(AnalyticsService);
  protected readonly CURRENCY = CURRENCY;

  state = computed(() => this.analytics.tables());
  rows = computed(() => this.state().data?.tables ?? []);
  isEmpty = computed(() => this.rows().length === 0);
  exporting = computed(() => this.analytics.exporting() === '/tables/');

  exportCsv() {
    this.analytics.exportTables();
  }

  retry() {
    this.analytics.loadTables();
  }
}
