import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../../services/analytics.service';
import { RestaurantService } from '../../../services/restaurant.service';
import { MenuSortKey } from '../../../models/analytics';
import { CURRENCY } from '../../../utils/constants';
import { AnalyticsWidget } from './analytics-widget';

interface SortableColumn {
  key: MenuSortKey;
  label: string;
  numeric: boolean;
}

/**
 * The menu performance table, plus the top-sellers and low-sales lists.
 *
 * All three read the one aggregated `menu-performance` response - sorting,
 * searching and category filtering happen over that already-summarised array
 * rather than triggering a request per interaction.
 */
@Component({
  selector: 'app-menu-performance',
  imports: [DecimalPipe, FormsModule, AnalyticsWidget],
  templateUrl: './menu-performance.html',
})
export class MenuPerformance {
  private analytics = inject(AnalyticsService);
  private restaurantService = inject(RestaurantService);
  protected readonly CURRENCY = CURRENCY;

  state = computed(() => this.analytics.menuPerformance());
  rows = computed(() => this.analytics.visibleMenuRows());
  topSelling = computed(() => this.analytics.topSellingItems().slice(0, this.topLimit()));
  topRevenue = computed(() => this.analytics.topRevenueItems().slice(0, this.topLimit()));
  lowSales = computed(() => this.analytics.lowSalesItems().slice(0, this.topLimit()));

  categories = computed(() => this.restaurantService.categories());
  exporting = computed(() => this.analytics.exporting() === '/menu-performance/');
  exportError = computed(() => this.analytics.exportError());

  /** True only when the period genuinely has no sales, not when a filter
   *  narrowed everything away - those need different wording. */
  isEmpty = computed(() => (this.state().data?.items.length ?? 0) === 0);
  filteredToNothing = computed(() => !this.isEmpty() && this.rows().length === 0);

  topLimitOptions = [5, 10];
  topLimit = computed(() => this.analytics.menuTopLimit());

  columns: SortableColumn[] = [
    { key: 'name', label: 'Item', numeric: false },
    { key: 'units', label: 'Units Sold', numeric: true },
    { key: 'revenue', label: 'Revenue', numeric: true },
    { key: 'orders', label: 'Orders', numeric: true },
  ];

  sortKey = computed(() => this.analytics.menuSort());
  sortDescending = computed(() => this.analytics.menuSortDescending());
  search = computed(() => this.analytics.menuSearch());
  categoryFilter = computed(() => this.analytics.menuCategoryFilter());

  toggleSort(key: MenuSortKey) {
    if (this.sortKey() === key) {
      this.analytics.menuSortDescending.update(descending => !descending);
      return;
    }
    this.analytics.menuSort.set(key);
    // Text sorts read naturally A-Z; numbers are most useful largest-first.
    this.analytics.menuSortDescending.set(key !== 'name');
  }

  ariaSort(key: MenuSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDescending() ? 'descending' : 'ascending';
  }

  sortIcon(key: MenuSortKey): string {
    if (this.sortKey() !== key) return 'bi-dash';
    return this.sortDescending() ? 'bi-sort-down' : 'bi-sort-up';
  }

  onSearch(value: string) {
    this.analytics.menuSearch.set(value);
  }

  onCategoryFilter(value: string) {
    this.analytics.menuCategoryFilter.set(value);
  }

  setTopLimit(value: number) {
    this.analytics.menuTopLimit.set(value);
  }

  exportCsv() {
    this.analytics.exportMenuPerformance();
  }

  retry() {
    this.analytics.loadMenuPerformance();
  }
}
