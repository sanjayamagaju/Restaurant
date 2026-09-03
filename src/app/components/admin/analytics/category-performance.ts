import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalyticsService } from '../../../services/analytics.service';
import { CURRENCY } from '../../../utils/constants';
import { AnalyticsWidget } from './analytics-widget';

@Component({
  selector: 'app-category-performance',
  imports: [DecimalPipe, AnalyticsWidget],
  templateUrl: './category-performance.html',
})
export class CategoryPerformance {
  private analytics = inject(AnalyticsService);
  protected readonly CURRENCY = CURRENCY;

  state = computed(() => this.analytics.categories());
  rows = computed(() => this.state().data?.categories ?? []);
  isEmpty = computed(() => this.rows().length === 0);
  exporting = computed(() => this.analytics.exporting() === '/categories/');

  exportCsv() {
    this.analytics.exportCategories();
  }

  retry() {
    this.analytics.loadCategories();
  }
}
