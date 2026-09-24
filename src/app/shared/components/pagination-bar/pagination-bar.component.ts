import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../icon.component';

/**
 * PaginationBar - Shared pagination component for all long lists.
 * 
 * Features:
 * - Shows "{from}–{to} of {total}" format
 * - Prev/Next controls with 44px touch targets
 * - Handles edge cases: total = 0, total = 1 page, hundreds of pages
 * - Consistent behavior across all pages
 */
@Component({
  selector: 'app-pagination-bar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="pagination-bar">
      <div class="pagination-bar-info">
        @if (total === 0) {
          <span>No items</span>
        } @else if (total === 1) {
          <span>1 item</span>
        } @else {
          <span>{{ from() }}–{{ to() }} of {{ total }}</span>
        }
      </div>
      
      @if (totalPages() > 1) {
        <div class="pagination-bar-controls">
          <button 
            class="pagination-bar-btn"
            [disabled]="isFirst()"
            (click)="onPrev()"
            aria-label="Previous page"
          >
            <app-icon name="chevron-left" [size]="16"></app-icon>
          </button>
          
          <span class="pagination-bar-page">
            {{ currentPage + 1 }} / {{ totalPages() }}
          </span>
          
          <button 
            class="pagination-bar-btn"
            [disabled]="isLast()"
            (click)="onNext()"
            aria-label="Next page"
          >
            <app-icon name="chevron-right" [size]="16"></app-icon>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      gap: 12px;
      flex-wrap: wrap;
    }

    .pagination-bar-info {
      font-size: 11px;
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .pagination-bar-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pagination-bar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      padding: 8px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      color: var(--color-text);
      cursor: pointer;
      transition: all 0.15s;
    }

    .pagination-bar-btn:hover:not(:disabled) {
      background: #f0f4f3;
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .pagination-bar-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .pagination-bar-page {
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text);
      padding: 0 8px;
      white-space: nowrap;
    }

    @media (max-width: 767px) {
      .pagination-bar {
        padding: 10px;
      }

      .pagination-bar-btn {
        min-width: 44px;
        min-height: 44px;
      }
    }

    @media (max-width: 320px) {
      .pagination-bar {
        flex-direction: column;
        gap: 8px;
      }

      .pagination-bar-info {
        order: 2;
      }

      .pagination-bar-controls {
        order: 1;
        width: 100%;
        justify-content: space-between;
      }
    }
  `]
})
export class PaginationBarComponent {
  @Input() currentPage = 0; // 0-indexed
  @Input() pageSize = 20;
  @Input() total = 0;

  @Output() pageChange = new EventEmitter<number>();

  totalPages = computed(() => {
    if (this.total === 0) return 0;
    return Math.ceil(this.total / this.pageSize);
  });

  from = computed(() => {
    if (this.total === 0) return 0;
    return this.currentPage * this.pageSize + 1;
  });

  to = computed(() => {
    if (this.total === 0) return 0;
    return Math.min((this.currentPage + 1) * this.pageSize, this.total);
  });

  isFirst = computed(() => this.currentPage === 0);
  isLast = computed(() => this.currentPage >= this.totalPages() - 1);

  onPrev() {
    if (!this.isFirst()) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  onNext() {
    if (!this.isLast()) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }
}
