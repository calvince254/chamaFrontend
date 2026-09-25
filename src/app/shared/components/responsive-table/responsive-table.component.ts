import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef, Directive } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Directive for marking the mobile card template
 */
@Directive({
  selector: '[mobileCardTemplate]',
  standalone: true
})
export class MobileCardTemplateDirective {
  constructor(public templateRef: TemplateRef<any>) {}
}

/**
 * Column definition for the responsive table
 */
export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  hideOnMobile?: boolean;
  format?: (value: any, row: any) => string;
}

/**
 * ResponsiveTable - Renders as table on tablet+ (>=860px), cards on mobile (<860px)
 * 
 * Per spec section 3.2:
 * - Tables with >3 columns convert to stacked card list below 860px
 * - Each row becomes a card: primary identifier + status at top, figures row, actions at bottom
 * - Never shrink font or horizontal scroll as mobile solution
 * 
 * Usage:
 * <app-responsive-table 
 *   [columns]="columns" 
 *   [data]="items" 
 *   [loading]="loading"
 *   [emptyMessage]="'No items found'"
 *   (rowClick)="onRowClick($event)"
 * >
 *   <ng-template mobileCardTemplate let-item>
 *     <!-- Custom mobile card content -->
 *   </ng-template>
 * </app-responsive-table>
 */
@Component({
  selector: 'app-responsive-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Desktop/Tablet Table (>=860px) -->
    <div class="table-container desktop-table">
      @if (loading) {
        <div class="loading-inline">
          <div class="spinner-sm"></div>
          <span>Loading...</span>
        </div>
      } @else if (data.length === 0) {
        <div class="empty-state-small">
          <p>{{ emptyMessage }}</p>
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              @for (col of columns; track col.key) {
                <th [style.width]="col.width" [style.text-align]="col.align || 'left'">
                  {{ col.label }}
                </th>
              }
              @if (hasActions) {
                <th style="width: 100px;"></th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of data; track trackByFn(row)) {
              <tr 
                [class.inactive-row]="row.inactive || row.active === false"
                [class.clickable]="rowClickable"
                (click)="onRowClick(row)"
              >
                @for (col of columns; track col.key) {
                  <td [style.text-align]="col.align || 'left'">
                    @if (col.format) {
                      {{ col.format(row[col.key], row) }}
                    } @else {
                      {{ row[col.key] ?? '—' }}
                    }
                  </td>
                }
                @if (hasActions) {
                  <td class="actions-cell">
                    <ng-content select="[tableActions]"></ng-content>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    <!-- Mobile Cards (<860px) -->
    <div class="mobile-cards">
      @if (loading) {
        <div class="loading-inline">
          <div class="spinner-sm"></div>
          <span>Loading...</span>
        </div>
      } @else if (data.length === 0) {
        <div class="empty-state-small">
          <p>{{ emptyMessage }}</p>
        </div>
      } @else {
        @for (row of data; track trackByFn(row)) {
          <div 
            class="mobile-card"
            [class.mobile-card-inactive]="row.inactive || row.active === false"
            [class.clickable]="rowClickable"
            (click)="onRowClick(row)"
          >
            @if (mobileCardTemplate) {
              <ng-container *ngTemplateOutlet="mobileCardTemplate.templateRef; context: { $implicit: row }"></ng-container>
            } @else {
              <!-- Default card layout -->
              <div class="mobile-card-header">
                <span class="mobile-card-title">{{ row[primaryKey] }}</span>
                @if (statusKey && row[statusKey]) {
                  <span class="badge" [ngClass]="getStatusBadgeClass(row[statusKey])">
                    {{ row[statusKey] }}
                  </span>
                }
              </div>
              <div class="mobile-card-stats">
                @for (col of mobileColumns; track col.key) {
                  <div class="mobile-card-stat">
                    <span class="mobile-card-stat-label">{{ col.label }}</span>
                    <span class="mobile-card-stat-value">
                      @if (col.format) {
                        {{ col.format(row[col.key], row) }}
                      } @else {
                        {{ row[col.key] ?? '—' }}
                      }
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    /* Desktop table - shown on tablet+ */
    .table-container.desktop-table {
      display: none;
    }

    @media (min-width: 860px) {
      .table-container.desktop-table {
        display: block;
      }

      .mobile-cards {
        display: none !important;
      }
    }

    /* Mobile cards - shown below 860px */
    .mobile-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .mobile-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 14px;
      transition: border-color 0.15s;
    }

    .mobile-card.clickable {
      cursor: pointer;
    }

    .mobile-card.clickable:hover {
      border-color: var(--color-primary);
    }

    .mobile-card.clickable:active {
      background: var(--color-bg);
    }

    .mobile-card-inactive {
      opacity: 0.6;
    }

    .mobile-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 10px;
    }

    .mobile-card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text);
      flex: 1;
      word-break: break-word;
    }

    .mobile-card-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding: 10px 0;
      border-top: 1px solid var(--color-border);
    }

    .mobile-card-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .mobile-card-stat-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .mobile-card-stat-value {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text);
    }

    /* Table styling */
    .data-table tbody tr.clickable {
      cursor: pointer;
    }

    .data-table tbody tr.clickable:hover {
      background: var(--color-bg);
    }

    /* Loading and empty states */
    .loading-inline {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 24px;
      color: var(--color-text-muted);
      font-size: 13px;
    }

    .empty-state-small {
      text-align: center;
      padding: 32px 16px;
      color: var(--color-text-muted);
    }

    .empty-state-small p {
      font-size: 13px;
      margin: 0;
    }
  `]
})
export class ResponsiveTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() loading = false;
  @Input() emptyMessage = 'No data found';
  @Input() primaryKey = 'name'; // Key for main identifier in mobile cards
  @Input() statusKey?: string; // Key for status badge in mobile cards
  @Input() trackBy?: string; // Property to use for trackBy
  @Input() rowClickable = false;
  @Input() hasActions = false;

  @Output() rowClick = new EventEmitter<any>();

  @ContentChild(MobileCardTemplateDirective) mobileCardTemplate?: MobileCardTemplateDirective;

  get mobileColumns(): TableColumn[] {
    return this.columns.filter(col => 
      !col.hideOnMobile && 
      col.key !== this.primaryKey && 
      col.key !== this.statusKey
    ).slice(0, 4); // Show max 4 stats on mobile
  }

  trackByFn(row: any): any {
    if (this.trackBy && row[this.trackBy]) {
      return row[this.trackBy];
    }
    return row.id || row;
  }

  onRowClick(row: any): void {
    if (this.rowClickable) {
      this.rowClick.emit(row);
    }
  }

  getStatusBadgeClass(status: string): string {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('active') || statusLower.includes('paid') || statusLower.includes('complete')) {
      return 'badge-success';
    }
    if (statusLower.includes('pending') || statusLower.includes('partial')) {
      return 'badge-warning';
    }
    if (statusLower.includes('inactive') || statusLower.includes('suspend') || statusLower.includes('overdue')) {
      return 'badge-danger';
    }
    return 'badge-neutral';
  }
}
