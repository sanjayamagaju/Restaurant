import { Component, computed, inject, input } from '@angular/core';
import { AnalyticsService } from '../../../services/analytics.service';
import { TrendGranularity, TrendPoint } from '../../../models/analytics';
import { CURRENCY } from '../../../utils/constants';

type Metric = 'revenue' | 'orders';

interface PlottedPoint {
  x: number;
  y: number;
  label: string;
  value: number;
  display: string;
}

interface GridLine {
  y: number;
  label: string;
}

// Chart geometry in viewBox units; the SVG itself scales to its container.
const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };
const PLOT_WIDTH = VIEW_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = VIEW_HEIGHT - PADDING.top - PADDING.bottom;
const GRID_LINES = 4;
const MAX_X_LABELS = 7;

/**
 * Line chart for a single trend metric, drawn as inline SVG.
 *
 * Hand-rolled rather than pulled from a charting library: two line charts do
 * not justify a dependency, and this keeps the admin bundle free of one.
 * Rendered from the shared `trends` response, so the revenue and order-volume
 * charts always describe the same date range and buckets.
 */
@Component({
  selector: 'app-trend-chart',
  templateUrl: './trend-chart.html',
  styleUrl: './trend-chart.css',
})
export class TrendChart {
  private analytics = inject(AnalyticsService);
  protected readonly CURRENCY = CURRENCY;
  protected readonly viewBox = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
  protected readonly plot = { ...PADDING, width: PLOT_WIDTH, height: PLOT_HEIGHT };

  metric = input.required<Metric>();

  state = computed(() => this.analytics.trends());
  private points = computed<TrendPoint[]>(() => this.state().data?.points ?? []);
  private granularity = computed<TrendGranularity>(() => this.state().data?.meta.granularity ?? 'day');

  isCurrency = computed(() => this.metric() === 'revenue');
  isEmpty = computed(() => this.points().every(point => this.valueOf(point) === 0));

  private maxValue = computed(() => {
    const highest = Math.max(...this.points().map(point => this.valueOf(point)), 0);
    return highest > 0 ? this.niceCeiling(highest) : 1;
  });

  plotted = computed<PlottedPoint[]>(() => {
    const points = this.points();
    if (!points.length) return [];

    const max = this.maxValue();
    const step = points.length > 1 ? PLOT_WIDTH / (points.length - 1) : 0;

    return points.map((point, index) => {
      const value = this.valueOf(point);
      return {
        x: PADDING.left + (points.length > 1 ? index * step : PLOT_WIDTH / 2),
        y: PADDING.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT,
        label: this.bucketLabel(point.bucket),
        value,
        display: this.formatValue(value),
      };
    });
  });

  linePath = computed(() =>
    this.plotted().map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
  );

  /** The line closed along the baseline, so the area beneath can be filled. */
  areaPath = computed(() => {
    const plotted = this.plotted();
    if (plotted.length < 2) return '';
    const baseline = PADDING.top + PLOT_HEIGHT;
    const line = plotted.map(point => `L ${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    return `M ${plotted[0].x.toFixed(1)},${baseline} ${line} `
      + `L ${plotted[plotted.length - 1].x.toFixed(1)},${baseline} Z`;
  });

  gridLines = computed<GridLine[]>(() => {
    const max = this.maxValue();
    return Array.from({ length: GRID_LINES + 1 }, (_, index) => {
      const fraction = index / GRID_LINES;
      return {
        y: PADDING.top + PLOT_HEIGHT - fraction * PLOT_HEIGHT,
        label: this.formatAxisValue(max * fraction),
      };
    });
  });

  /** Thinned x labels so they never overlap on long ranges. */
  xLabels = computed(() => {
    const plotted = this.plotted();
    if (!plotted.length) return [];
    const stride = Math.max(1, Math.ceil(plotted.length / MAX_X_LABELS));
    return plotted.filter((_point, index) => index % stride === 0 || index === plotted.length - 1);
  });

  /** Spoken/scraped equivalent of the chart for assistive tech (the SVG itself
   *  is decorative; the table below it carries the same numbers). */
  accessibleSummary = computed(() => {
    const plotted = this.plotted();
    if (!plotted.length) return 'No data for this period.';
    const total = plotted.reduce((sum, point) => sum + point.value, 0);
    const peak = plotted.reduce((best, point) => (point.value > best.value ? point : best), plotted[0]);
    const noun = this.isCurrency() ? 'revenue' : 'orders';
    return `${this.title()}: ${this.formatValue(total)} total ${noun} across ${plotted.length} `
      + `${this.granularity()} buckets. Highest was ${peak.display} on ${peak.label}.`;
  });

  title = computed(() => (this.isCurrency() ? 'Revenue Trend' : 'Order Volume Trend'));

  private valueOf(point: TrendPoint): number {
    return this.metric() === 'revenue' ? Number(point.revenue) : point.orders;
  }

  formatValue(value: number): string {
    if (!this.isCurrency()) return `${Math.round(value)}`;
    return `${CURRENCY} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  private formatAxisValue(value: number): string {
    if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return `${Math.round(value)}`;
  }

  /** Round up to a readable axis maximum.
   *
   * Counts round to a multiple of the gridline count so every label lands on a
   * whole number (4 orders gives 0..4, not 0, 1.25, 2.5); money uses the usual
   * 1/2/5 x power-of-ten steps. */
  private niceCeiling(value: number): number {
    if (!this.isCurrency()) {
      return Math.max(GRID_LINES, Math.ceil(value / GRID_LINES) * GRID_LINES);
    }
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalised = value / magnitude;
    const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
    return step * magnitude;
  }

  private bucketLabel(bucket: string): string {
    const date = new Date(bucket);
    if (Number.isNaN(date.getTime())) return bucket;
    switch (this.granularity()) {
      case 'hour':
        return date.toLocaleTimeString(undefined, { hour: 'numeric' });
      case 'month':
        return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  retry() {
    this.analytics.loadTrends();
  }
}
