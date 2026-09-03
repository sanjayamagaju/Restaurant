import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import {
  CancellationReason, CartLine, MenuCategory, MenuItem, MenuItemOption, MenuItemOptionGroup,
  Order, OrderItem, OrderStatus, Table,
} from '../models/types';
import { environment } from '../../environments/environment';

/** Menu category id used to select the "Today's Specials" pseudo-category in menu browsing. */
export const SPECIALS_CATEGORY_ID = 'specials';
export const ALL_CATEGORIES_ID = 'all';

export interface MenuDisplayGroup {
  id: string;
  name: string;
  items: MenuItem[];
}

const TABLE_CODE_PARAM = 't';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'polling';

export interface OrderEvent {
  type: 'order_created' | 'order_updated';
  order: Order;
}

interface SocketController {
  stop: () => void;
}

const LAST_ORDER_KEY = 'lastOrderId';
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];
const POLL_INTERVAL_MS = 8000;
const RETRIES_BEFORE_POLL_FALLBACK = 4;

@Injectable({
  providedIn: 'root'
})
export class RestaurantService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private wsUrl = environment.wsUrl;

  // State
  menuItems = signal<MenuItem[]>([]);
  categories = signal<MenuCategory[]>([]);
  orders = signal<Order[]>([]);
  tables = signal<Table[]>([]);
  currentTable = signal<string | null>(null);
  trackedOrderId = signal<string | null>(null);
  connectionState = signal<ConnectionState>('idle');
  lastEvent = signal<OrderEvent | null>(null);

  // Customer menu browsing state
  selectedCategoryId = signal<string>(ALL_CATEGORIES_ID);
  menuSearchQuery = signal('');

  // Computed State
  regularMenuItems = computed(() => this.menuItems().filter(item => !item.isSpecial));
  specialMenuItems = computed(() => this.menuItems().filter(item => item.isSpecial));
  availableMenuItems = computed(() => this.menuItems().filter(item => item.available));

  activeCategories = computed(() =>
    this.categories()
      .filter(c => c.active)
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
  );

  private matchesSearch = (item: MenuItem, query: string) => {
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      (item.categoryName ?? '').toLowerCase().includes(query)
    );
  };

  /** Items grouped by category for the customer menu, respecting the active
   *  category tab and search query. Computed client-side against already-loaded
   *  data - no network round-trip per keystroke. */
  menuDisplayGroups = computed<MenuDisplayGroup[]>(() => {
    const query = this.menuSearchQuery().trim().toLowerCase();
    const selected = this.selectedCategoryId();
    const items = this.menuItems();

    if (selected === SPECIALS_CATEGORY_ID) {
      const specials = items.filter(i => i.isSpecial && this.matchesSearch(i, query));
      return specials.length ? [{ id: SPECIALS_CATEGORY_ID, name: "Today's Specials", items: specials }] : [];
    }

    const categories = selected === ALL_CATEGORIES_ID
      ? this.activeCategories()
      : this.activeCategories().filter(c => c.id === selected);

    return categories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        items: items.filter(i => i.category === cat.id && this.matchesSearch(i, query)),
      }))
      .filter(group => group.items.length > 0);
  });

  hasSearchQuery = computed(() => this.menuSearchQuery().trim().length > 0);

  newOrders = computed(() => this.orders().filter(o => o.status === 'NEW'));
  acceptedOrders = computed(() => this.orders().filter(o => o.status === 'ACCEPTED'));
  preparingOrders = computed(() => this.orders().filter(o => o.status === 'PREPARING'));
  readyOrders = computed(() => this.orders().filter(o => o.status === 'READY'));
  servedOrders = computed(() => this.orders().filter(o => o.status === 'SERVED'));
  completedOrders = computed(() => this.orders().filter(o => o.status === 'COMPLETED'));
  cancelledOrders = computed(() => this.orders().filter(o => o.status === 'CANCELLED'));

  // Orders that still need staff attention before the kitchen is done with them.
  pendingCount = computed(() => this.newOrders().length);

  trackedOrder = computed(() => this.orders().find(o => o.id === this.trackedOrderId()) ?? null);

  private staffSocket?: SocketController;
  private customerSocket?: SocketController;

  constructor() {
    this.loadMenuItems();
    this.loadCategories();

    const scannedCode = new URLSearchParams(window.location.search).get(TABLE_CODE_PARAM);
    if (scannedCode) {
      // Strip the code from the address bar immediately so a refresh or bookmark
      // doesn't keep re-resolving it (or leak it) once the table is set.
      window.history.replaceState({}, '', window.location.pathname);
      this.resolveTableCode(scannedCode);
    } else {
      const savedTable = localStorage.getItem('restaurantTable');
      if (savedTable) {
        this.currentTable.set(savedTable);
      }
    }

    const lastOrderId = localStorage.getItem(LAST_ORDER_KEY);
    if (lastOrderId) {
      this.trackedOrderId.set(lastOrderId);
      this.getOrder(lastOrderId).subscribe({
        next: () => this.connectCustomerSocket(lastOrderId),
        error: () => this.clearTrackedOrder(),
      });
    }
  }

  // Data loading
  loadMenuItems() {
    this.http.get<MenuItem[]>(`${this.apiUrl}/menu-items/`).subscribe(items => {
      this.menuItems.set(items.map(item => this.normalizeMenuItem(item)));
    });
  }

  loadCategories() {
    this.http.get<MenuCategory[]>(`${this.apiUrl}/menu-categories/`).subscribe(categories => {
      this.categories.set(categories.map(c => ({ ...c, id: String(c.id) })));
    });
  }

  private normalizeMenuItem(item: MenuItem): MenuItem {
    return {
      ...item,
      id: String(item.id),
      category: item.category != null ? String(item.category) : null,
      optionGroups: (item.optionGroups ?? []).map(group => ({
        ...group,
        id: String(group.id),
        options: (group.options ?? []).map(option => ({ ...option, id: String(option.id) })),
      })),
    };
  }

  private upsertMenuItem(item: MenuItem) {
    const normalized = this.normalizeMenuItem(item);
    this.menuItems.update(items => {
      const index = items.findIndex(i => i.id === normalized.id);
      if (index === -1) return [...items, normalized];
      const next = items.slice();
      next[index] = normalized;
      return next;
    });
  }

  /** Re-fetches one menu item, e.g. after an option-group/option mutation that
   *  isn't reflected in the local state (the API nests groups/options under
   *  the menu item rather than tracking them as separate signal collections). */
  private refreshMenuItem(menuItemId: string) {
    this.http.get<MenuItem>(`${this.apiUrl}/menu-items/${menuItemId}/`).subscribe(item => this.upsertMenuItem(item));
  }

  loadOrders() {
    this.http.get<Order[]>(`${this.apiUrl}/orders/`).subscribe(orders => {
      this.orders.set(orders.map(order => this.normalizeOrder(order)));
    });
  }

  getOrder(orderId: string) {
    return this.http.get<Order>(`${this.apiUrl}/orders/${orderId}/`).pipe(
      tap(order => this.upsertOrder(this.normalizeOrder(order))),
    );
  }

  // Table provisioning (staff-only) + QR-driven table detection (public)
  loadTables() {
    this.http.get<Table[]>(`${this.apiUrl}/tables/`).subscribe(tables => {
      this.tables.set(tables.map(t => ({ ...t, id: String(t.id) })));
    });
  }

  createTable(number: string) {
    return this.http.post<Table>(`${this.apiUrl}/tables/`, { number }).pipe(
      tap(created => {
        const table = { ...created, id: String(created.id) };
        this.tables.update(tables => [...tables, table]);
      }),
    );
  }

  /** The URL to embed in a table's printed QR code. */
  qrUrlForTable(code: string): string {
    return `${window.location.origin}/?${TABLE_CODE_PARAM}=${code}`;
  }

  private resolveTableCode(code: string) {
    this.http.get<{ number: string }>(`${this.apiUrl}/tables/resolve/${encodeURIComponent(code)}/`).subscribe({
      next: ({ number }) => this.setTableNumber(number),
      error: () => {
        // Unknown/stale code - fall back to whatever table (if any) was set before.
        const savedTable = localStorage.getItem('restaurantTable');
        if (savedTable) {
          this.currentTable.set(savedTable);
        }
      },
    });
  }

  private normalizeOrder(order: Order): Order {
    return {
      ...order,
      id: String(order.id),
      items: order.items.map(item => ({
        ...item,
        id: item.id !== undefined ? String(item.id) : undefined,
        menuItem: this.normalizeMenuItem(item.menuItem),
      })),
    };
  }

  private upsertOrder(order: Order) {
    this.orders.update(orders => {
      const index = orders.findIndex(o => o.id === order.id);
      if (index === -1) {
        return [...orders, order];
      }
      const next = orders.slice();
      next[index] = order;
      return next;
    });
  }

  // Mutations
  setTableNumber(tableNumber: string) {
    this.currentTable.set(tableNumber);
    localStorage.setItem('restaurantTable', tableNumber);
  }

  // Menu category management (staff-only writes; enforced server-side too)
  createCategory(payload: { name: string; description?: string; displayOrder?: number; active?: boolean }) {
    return this.http.post<MenuCategory>(`${this.apiUrl}/menu-categories/`, payload).pipe(
      tap(created => {
        const category = { ...created, id: String(created.id) };
        this.categories.update(categories => [...categories, category]);
      }),
    );
  }

  updateCategory(id: string, payload: Partial<Pick<MenuCategory, 'name' | 'description' | 'displayOrder' | 'active'>>) {
    return this.http.patch<MenuCategory>(`${this.apiUrl}/menu-categories/${id}/`, payload).pipe(
      tap(updated => {
        const category = { ...updated, id: String(updated.id) };
        this.categories.update(categories => categories.map(c => (c.id === category.id ? category : c)));
      }),
    );
  }

  deleteCategory(id: string) {
    return this.http.delete(`${this.apiUrl}/menu-categories/${id}/`).pipe(
      tap(() => this.categories.update(categories => categories.filter(c => c.id !== id))),
    );
  }

  // Menu item management
  createMenuItem(item: {
    name: string; price: number; description: string; isSpecial: boolean; imageUrl?: string;
    category?: string | null; available?: boolean; preparationTime?: number | null; displayOrder?: number;
  }) {
    return this.http.post<MenuItem>(`${this.apiUrl}/menu-items/`, item).pipe(
      tap(created => this.upsertMenuItem(created)),
    );
  }

  updateMenuItem(id: string, item: Partial<{
    name: string; price: number; description: string; isSpecial: boolean; imageUrl: string;
    category: string | null; available: boolean; preparationTime: number | null; displayOrder: number;
  }>) {
    return this.http.patch<MenuItem>(`${this.apiUrl}/menu-items/${id}/`, item).pipe(
      tap(updated => this.upsertMenuItem(updated)),
    );
  }

  deleteMenuItem(id: string) {
    return this.http.delete(`${this.apiUrl}/menu-items/${id}/`).pipe(
      tap(() => this.menuItems.update(items => items.filter(i => i.id !== id))),
    );
  }

  toggleAvailability(id: string) {
    return this.http.post<MenuItem>(`${this.apiUrl}/menu-items/${id}/toggle-availability/`, {}).pipe(
      tap(updated => this.upsertMenuItem(updated)),
    );
  }

  // Option group / option management - the API nests these under their menu
  // item on read, so mutations refresh that one menu item afterward.
  createOptionGroup(payload: {
    menuItemId: string; name: string; required: boolean; minSelection: number; maxSelection: number; displayOrder?: number;
  }) {
    return this.http.post<MenuItemOptionGroup>(`${this.apiUrl}/menu-option-groups/`, payload).pipe(
      tap(() => this.refreshMenuItem(payload.menuItemId)),
    );
  }

  updateOptionGroup(id: string, menuItemId: string, payload: Partial<{
    name: string; required: boolean; minSelection: number; maxSelection: number; displayOrder: number; active: boolean;
  }>) {
    return this.http.patch<MenuItemOptionGroup>(`${this.apiUrl}/menu-option-groups/${id}/`, payload).pipe(
      tap(() => this.refreshMenuItem(menuItemId)),
    );
  }

  deleteOptionGroup(id: string, menuItemId: string) {
    return this.http.delete(`${this.apiUrl}/menu-option-groups/${id}/`).pipe(
      tap(() => this.refreshMenuItem(menuItemId)),
    );
  }

  createOption(payload: { optionGroupId: string; name: string; additionalPrice: number; displayOrder?: number }, menuItemId: string) {
    return this.http.post<MenuItemOption>(`${this.apiUrl}/menu-item-options/`, payload).pipe(
      tap(() => this.refreshMenuItem(menuItemId)),
    );
  }

  updateOption(id: string, menuItemId: string, payload: Partial<{ name: string; additionalPrice: number; displayOrder: number; active: boolean }>) {
    return this.http.patch<MenuItemOption>(`${this.apiUrl}/menu-item-options/${id}/`, payload).pipe(
      tap(() => this.refreshMenuItem(menuItemId)),
    );
  }

  deleteOption(id: string, menuItemId: string) {
    return this.http.delete(`${this.apiUrl}/menu-item-options/${id}/`).pipe(
      tap(() => this.refreshMenuItem(menuItemId)),
    );
  }

  /** Places an order from cart lines. The backend recomputes every price from
   *  scratch (menu item + options) and rejects sold-out items/options - the
   *  client never sends a trusted price or total. */
  placeOrder(cartLines: CartLine[], orderSpecialInstructions = '') {
    const table = this.currentTable();
    if (!table) return;

    const payload = {
      tableNumber: table,
      specialInstructions: orderSpecialInstructions,
      items: cartLines.map(line => ({
        menuItemId: line.menuItem.id,
        quantity: line.quantity,
        selectedOptionIds: line.selectedOptions.map(o => o.optionId),
        specialInstructions: line.specialInstructions,
      })),
    };

    return this.http.post<Order>(`${this.apiUrl}/orders/`, payload).pipe(
      tap(created => {
        const normalized = this.normalizeOrder(created);
        this.upsertOrder(normalized);
        this.trackNewOrder(normalized.id);
      }),
    );
  }

  /** Staff-only: transition an order to a new lifecycle status.
   *
   * `cancellationReason` is only recorded when the target status is CANCELLED;
   * the backend ignores it on any other transition. */
  updateOrderStatus(orderId: string, status: OrderStatus, cancellationReason?: CancellationReason) {
    const payload: { status: OrderStatus; cancellationReason?: CancellationReason } = { status };
    if (cancellationReason) payload.cancellationReason = cancellationReason;

    return this.http.patch<Order>(`${this.apiUrl}/orders/${orderId}/`, payload).pipe(
      tap(updated => this.upsertOrder(this.normalizeOrder(updated))),
    );
  }

  /** Customer-facing: rate a completed order. Anonymous, one rating per order. */
  submitFeedback(orderId: string, rating: number, comment = '') {
    return this.http.post(`${this.apiUrl}/orders/${orderId}/feedback/`, { rating, comment });
  }

  toggleOrderItemStatus(orderId: string, itemIndex: number) {
    const order = this.orders().find(o => o.id === orderId);
    const item = order?.items[itemIndex];
    if (!order || !item || item.id === undefined) return;

    const completed = !item.completed;
    this.http
      .patch<OrderItem>(`${this.apiUrl}/order-items/${item.id}/`, { completed })
      .subscribe(() => {
        this.orders.update(orders =>
          orders.map(o => {
            if (o.id === orderId) {
              const updatedItems = [...o.items];
              updatedItems[itemIndex] = { ...updatedItems[itemIndex], completed };
              return { ...o, items: updatedItems };
            }
            return o;
          })
        );
      });
  }

  // Customer order tracking
  private trackNewOrder(orderId: string) {
    this.trackedOrderId.set(orderId);
    localStorage.setItem(LAST_ORDER_KEY, orderId);
    this.connectCustomerSocket(orderId);
  }

  clearTrackedOrder() {
    this.trackedOrderId.set(null);
    localStorage.removeItem(LAST_ORDER_KEY);
    this.disconnectCustomerSocket();
  }

  // Real-time (WebSocket) wiring, with reconnect backoff and polling fallback.
  // Shared by any staff-facing screen (admin panel, kitchen display) that needs
  // the full order stream.
  connectStaffSocket() {
    this.disconnectStaffSocket();
    this.staffSocket = this.openSocket(
      () => `/orders/admin/?token=${encodeURIComponent(localStorage.getItem('authToken') ?? '')}`,
      event => this.handleOrderEvent(event),
      () => this.loadOrders(),
    );
  }

  disconnectStaffSocket() {
    this.staffSocket?.stop();
    this.staffSocket = undefined;
  }

  private connectCustomerSocket(orderId: string) {
    this.disconnectCustomerSocket();
    this.customerSocket = this.openSocket(
      `/orders/${orderId}/`,
      event => this.handleOrderEvent(event),
      () => this.getOrder(orderId).subscribe(),
    );
  }

  private disconnectCustomerSocket() {
    this.customerSocket?.stop();
    this.customerSocket = undefined;
  }

  private handleOrderEvent(raw: any) {
    if (!raw || !raw.order) return;
    const order = this.normalizeOrder(raw.order);
    this.upsertOrder(order);
    this.lastEvent.set({ type: raw.type === 'order_created' ? 'order_created' : 'order_updated', order });
  }

  private openSocket(
    path: string | (() => string),
    onMessage: (data: any) => void,
    onFallbackPoll: () => void,
  ): SocketController {
    let ws: WebSocket | null = null;
    let stopped = false;
    let retryCount = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const stopPolling = () => {
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    const startPolling = () => {
      if (pollTimer !== undefined) return;
      this.connectionState.set('polling');
      pollTimer = setInterval(onFallbackPoll, POLL_INTERVAL_MS);
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      this.connectionState.set('reconnecting');
      const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
      retryCount++;
      if (retryCount >= RETRIES_BEFORE_POLL_FALLBACK) {
        startPolling();
      }
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (stopped) return;
      this.connectionState.set(retryCount === 0 ? 'connecting' : 'reconnecting');
      const resolvedPath = typeof path === 'function' ? path() : path;
      try {
        ws = new WebSocket(`${this.wsUrl}${resolvedPath}`);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        retryCount = 0;
        stopPolling();
        this.connectionState.set('open');
      };
      ws.onmessage = (event: MessageEvent) => {
        try {
          onMessage(JSON.parse(event.data));
        } catch {
          // Ignore malformed payloads rather than crashing the socket handler.
        }
      };
      ws.onclose = () => scheduleReconnect();
      ws.onerror = () => ws?.close();
    };

    connect();

    return {
      stop: () => {
        stopped = true;
        if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
        stopPolling();
        ws?.close();
        this.connectionState.set('idle');
      },
    };
  }
}
