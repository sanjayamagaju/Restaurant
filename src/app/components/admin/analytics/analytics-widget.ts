import { Component, input, output } from '@angular/core';

/**
 * Card shell shared by every analytics widget: it owns the loading skeleton,
 * the retry-on-error branch and the empty state, so each widget only has to
 * describe its own content.
 */
@Component({
  selector: 'app-analytics-widget',
  templateUrl: './analytics-widget.html',
  styleUrl: './analytics-widget.css',
})
export class AnalyticsWidget {
  title = input<string>('');
  icon = input<string>('');
  loading = input(false);
  error = input<string | null>(null);
  /** True when the request succeeded but there is nothing to show. */
  empty = input(false);
  emptyMessage = input('No data available for this period.');
  /** Number of skeleton rows to draw while loading. */
  skeletonRows = input(4);

  retry = output<void>();

  get skeletonRange(): number[] {
    return Array.from({ length: this.skeletonRows() }, (_, index) => index);
  }
}
