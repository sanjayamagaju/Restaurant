import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalyticsService } from '../../../services/analytics.service';
import { Comparison, KpiKey } from '../../../models/analytics';
import { CURRENCY } from '../../../utils/constants';

interface KpiDefinition {
  key: KpiKey;
  label: string;
  icon: string;
  gradient: string;
  currency: boolean;
  /** For cancellations, a rise is bad news - flips the up/down colouring. */
  inverse?: boolean;
}

interface KpiCard extends KpiDefinition {
  value: number;
  comparison: Comparison | null;
  trend: 'up' | 'down' | 'flat' | 'none';
  deltaLabel: string;
}

@Component({
  selector: 'app-analytics-kpi-cards',
  imports: [DecimalPipe],
  templateUrl: './kpi-cards.html',
})
export class KpiCards {
  private analytics = inject(AnalyticsService);
  protected readonly CURRENCY = CURRENCY;

  state = computed(() => this.analytics.overview());
  comparisonLabel = computed(() => this.state().data?.meta.comparisonLabel ?? '');

  private definitions: KpiDefinition[] = [
    { key: 'totalOrders', label: 'Total Orders', icon: 'bi-receipt', gradient: 'linear-gradient(135deg, #ffb400, #ff8a00)', currency: false },
    { key: 'revenue', label: 'Revenue', icon: 'bi-cash-stack', gradient: 'linear-gradient(135deg, #ff7a18, #e8492f)', currency: true },
    { key: 'averageOrderValue', label: 'Average Order Value', icon: 'bi-graph-up-arrow', gradient: 'linear-gradient(135deg, #4a90d9, #2f5fa8)', currency: true },
    { key: 'completedOrders', label: 'Completed', icon: 'bi-check2-circle', gradient: 'linear-gradient(135deg, #2fbf71, #1e8f54)', currency: false },
    { key: 'cancelledOrders', label: 'Cancelled', icon: 'bi-x-circle-fill', gradient: 'linear-gradient(135deg, #e85f5f, #b83a3a)', currency: false, inverse: true },
    { key: 'itemsSold', label: 'Items Sold', icon: 'bi-basket-fill', gradient: 'linear-gradient(135deg, #9c7bd6, #6b4fa0)', currency: false },
  ];

  cards = computed<KpiCard[]>(() => {
    const overview = this.state().data;
    return this.definitions.map(definition => {
      const value = overview ? overview.kpis[definition.key] : 0;
      const comparison = overview ? overview.comparison[definition.key] : null;
      return {
        ...definition,
        value,
        comparison,
        trend: this.trendOf(comparison),
        deltaLabel: this.deltaLabelOf(comparison),
      };
    });
  });

  private trendOf(comparison: Comparison | null): KpiCard['trend'] {
    if (!comparison || comparison.value === null) return 'none';
    if (comparison.value > 0) return 'up';
    if (comparison.value < 0) return 'down';
    return 'flat';
  }

  private deltaLabelOf(comparison: Comparison | null): string {
    if (!comparison) return '';
    if (comparison.value === null) return comparison.label ?? '—';
    const sign = comparison.value > 0 ? '↑' : comparison.value < 0 ? '↓' : '';
    return `${sign} ${Math.abs(comparison.value).toFixed(1)}%`.trim();
  }

  /** Green when the movement is good news, red when it isn't - and never
   *  colour alone: the arrow glyph carries the same meaning. */
  deltaClass(card: KpiCard): string {
    if (card.trend === 'none' || card.trend === 'flat') return 'text-secondary-emphasis';
    const good = card.inverse ? card.trend === 'down' : card.trend === 'up';
    return good ? 'text-success-emphasis' : 'text-danger-emphasis';
  }

  retry() {
    this.analytics.loadOverview();
  }
}
