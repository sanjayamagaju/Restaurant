import { Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AnalyticsService } from '../../../services/analytics.service';
import { AnalyticsWidget } from './analytics-widget';

@Component({
  selector: 'app-feedback-summary',
  imports: [DatePipe, DecimalPipe, AnalyticsWidget],
  templateUrl: './feedback-summary.html',
})
export class FeedbackSummary {
  private analytics = inject(AnalyticsService);

  state = computed(() => this.analytics.feedback());
  summary = computed(() => this.state().data);
  isEmpty = computed(() => (this.summary()?.count ?? 0) === 0);
  distribution = computed(() => this.summary()?.distribution ?? []);
  recent = computed(() => this.summary()?.recent ?? []);

  /** Filled/empty star glyphs for a rating, so the score isn't conveyed by colour alone. */
  stars(rating: number | null): boolean[] {
    const filled = Math.round(rating ?? 0);
    return Array.from({ length: 5 }, (_, index) => index < filled);
  }

  retry() {
    this.analytics.loadFeedback();
  }
}
