import {Component, OnInit, computed, effect, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgClass} from '@angular/common';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {Router} from '@angular/router';
import {RestaurantService} from '../../../services/restaurant.service';
import {Table} from '../../../models/types';
import {ORDER_STATUS_META} from '../../../utils/constants';
import {qrToPngDataUrl, qrToSvgString} from '../../../utils/qr';

interface TableStatus {
  label: string;
  badgeClass: string;
  icon: string;
  orderId: string | null;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

@Component({
  selector: 'app-admin-tables',
  imports: [FormsModule, NgClass],
  templateUrl: './admin-tables.html',
  styleUrl: './admin-tables.css',
})
export class AdminTables implements OnInit {
  restaurantService = inject(RestaurantService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  newTableNumber = signal('');
  creating = signal(false);
  createError = signal<string | null>(null);

  private qrSvgByTableId = signal<Record<string, string>>({});

  tableStatuses = computed<Record<string, TableStatus>>(() => {
    const orders = this.restaurantService.orders();
    const result: Record<string, TableStatus> = {};
    for (const table of this.restaurantService.tables()) {
      const activeOrder = orders.find(
        o => o.tableNumber === table.number && !TERMINAL_STATUSES.has(o.status),
      );
      if (activeOrder) {
        const meta = ORDER_STATUS_META[activeOrder.status];
        result[table.id] = { label: meta.label, badgeClass: meta.badgeClass, icon: meta.icon, orderId: activeOrder.id };
      } else {
        result[table.id] = { label: 'Available', badgeClass: 'text-bg-secondary', icon: 'bi-check-circle', orderId: null };
      }
    }
    return result;
  });

  constructor() {
    // Lazily generate (and cache) a QR SVG for every table as soon as it appears.
    effect(() => {
      for (const table of this.restaurantService.tables()) {
        if (!this.qrSvgByTableId()[table.id]) {
          this.generateQrFor(table);
        }
      }
    });
  }

  ngOnInit() {
    this.restaurantService.loadTables();
    this.restaurantService.loadOrders();
  }

  /** Sanitized for template binding - the QR markup is entirely our own generated
   *  output (never user input), so trusting it here is safe. */
  qrSvg(table: Table): SafeHtml | null {
    const raw = this.rawQrSvg(table);
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  }

  private rawQrSvg(table: Table): string | null {
    return this.qrSvgByTableId()[table.id] ?? null;
  }

  submitNewTable() {
    const number = this.newTableNumber().trim();
    if (!number || this.creating()) return;

    this.creating.set(true);
    this.createError.set(null);
    this.restaurantService.createTable(number).subscribe({
      next: () => {
        this.creating.set(false);
        this.newTableNumber.set('');
      },
      error: (err) => {
        this.creating.set(false);
        const httpError = err as { status?: number; error?: { number?: string[] } };
        const message = httpError?.status === 401 || httpError?.status === 403
          ? 'You are not logged in (or your session expired). Please log in again.'
          : httpError?.error?.number?.[0] ?? 'Could not create that table. It may already exist.';
        this.createError.set(message);
      },
    });
  }

  viewActiveOrder(orderId: string) {
    this.router.navigate(['/admin/orders'], { queryParams: { orderId } });
  }

  async downloadQr(table: Table) {
    const url = this.restaurantService.qrUrlForTable(table.code);
    const dataUrl = await qrToPngDataUrl(url);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `table-${table.number}-qr.png`;
    link.click();
  }

  async printQr(table: Table) {
    const svg = this.rawQrSvg(table) ?? (await qrToSvgString(this.restaurantService.qrUrlForTable(table.code)));
    const printWindow = window.open('', '_blank', 'width=420,height=560');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Table ${table.number} QR</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 2rem; }
            h1 { margin-bottom: 0.25rem; }
            p { color: #555; margin-top: 0; }
            svg { width: 260px; height: 260px; margin: 1.5rem 0; }
          </style>
        </head>
        <body>
          <h1>Table ${table.number}</h1>
          <p>Scan to view the menu and order</p>
          ${svg}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  private async generateQrFor(table: Table) {
    const svg = await qrToSvgString(this.restaurantService.qrUrlForTable(table.code));
    this.qrSvgByTableId.update(map => ({ ...map, [table.id]: svg }));
  }
}
