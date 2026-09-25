import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Filter option definition
 */
export interface FilterOption {
  value: string | number | boolean;
  label: string;
}

/**
 * Filter definition
 */
export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'month' | 'year' | 'search';
  options?: FilterOption[];
  placeholder?: string;
  defaultValue?: any;
}

/**
 * FilterBar - Responsive horizontal filter row
 * 
 * Per spec section 3.3:
 * - Segmented controls, sub-type chips, and status tabs stack into:
 *   one segmented control row, then horizontally scrollable chip row
 * - Never more than 2 stacked filter rows before content on mobile
 * - Period selectors (month + year) consolidated into one row
 * 
 * Features:
 * - Horizontal scroll on mobile (<860px)
 * - Groups period selectors together
 * - Shows reset button when any filter is active
 */
@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filter-bar-container">
      <div class="filter-bar" [class.filter-bar-compact]="compact">
        @for (filter of filters; track filter.key) {
          @if (filter.type === 'search') {
            <div class="filter-search">
              <input 
                type="search" 
                [placeholder]="filter.placeholder || 'Search...'"
                [ngModel]="values[filter.key]"
                (ngModelChange)="onFilterChange(filter.key, $event)"
              />
            </div>
          } @else if (filter.type === 'select') {
            <div class="filter-group">
              <label>{{ filter.label }}</label>
              <select 
                [ngModel]="values[filter.key]"
                (ngModelChange)="onFilterChange(filter.key, $event)"
              >
                @for (opt of filter.options; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>
          }
        }

        <!-- Period selectors grouped together -->
        @if (hasPeriodFilters) {
          <div class="filter-period-group">
            @if (monthFilter) {
              <select 
                class="period-select"
                [ngModel]="values[monthFilter.key]"
                (ngModelChange)="onFilterChange(monthFilter.key, $event)"
              >
                @for (opt of monthFilter.options; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            }
            @if (yearFilter) {
              <select 
                class="period-select"
                [ngModel]="values[yearFilter.key]"
                (ngModelChange)="onFilterChange(yearFilter.key, $event)"
              >
                @for (opt of yearFilter.options; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            }
          </div>
        }

        <!-- Projected content (additional filters/controls) -->
        <ng-content></ng-content>

        <!-- Reset button -->
        @if (showReset && hasActiveFilters) {
          <button class="filter-reset" (click)="onReset()">
            Reset
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .filter-bar-container {
      margin-bottom: 12px;
    }

    .filter-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #f8faf9;
      border-radius: var(--radius-md);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .filter-bar::-webkit-scrollbar {
      display: none;
    }

    .filter-bar-compact {
      padding: 8px 12px;
      gap: 6px;
    }

    /* Filter groups */
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 20px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .filter-group label {
      padding: 8px 10px 8px 12px;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-muted);
      white-space: nowrap;
      background: transparent;
    }

    .filter-group select {
      border: none;
      background: transparent;
      padding: 8px 28px 8px 0;
      font-size: 11px;
      color: var(--color-text);
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      min-width: 80px;
    }

    /* Search input */
    .filter-search {
      flex-shrink: 0;
      min-width: 160px;
    }

    .filter-search input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      border-radius: 20px;
      font-size: 11px;
      background: var(--color-surface);
      color: var(--color-text);
      outline: none;
    }

    .filter-search input:focus {
      border-color: var(--color-primary);
    }

    .filter-search input::placeholder {
      color: var(--color-text-muted);
    }

    /* Period selectors grouped */
    .filter-period-group {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .period-select {
      padding: 8px 28px 8px 12px;
      border: 1px solid var(--color-border);
      border-radius: 20px;
      font-size: 11px;
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      min-width: 90px;
    }

    .period-select:focus {
      border-color: var(--color-primary);
    }

    /* Reset button */
    .filter-reset {
      margin-left: auto;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-primary);
      background: none;
      border: none;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .filter-reset:hover {
      text-decoration: underline;
    }

    /* Mobile adjustments */
    @media (max-width: 859px) {
      .filter-bar {
        flex-wrap: nowrap;
        padding: 10px 12px;
      }

      .filter-group label {
        padding: 10px 8px 10px 12px;
      }

      .filter-group select {
        padding: 10px 28px 10px 0;
        min-height: 44px;
      }

      .filter-search {
        min-width: 140px;
      }

      .filter-search input {
        padding: 10px 12px;
        min-height: 44px;
        font-size: 16px; /* Prevent iOS zoom */
      }

      .period-select {
        padding: 10px 28px 10px 12px;
        min-height: 44px;
        font-size: 16px;
      }

      .filter-reset {
        min-height: 44px;
        padding: 10px 12px;
      }
    }

    /* Tablet+ adjustments */
    @media (min-width: 860px) {
      .filter-bar {
        overflow-x: visible;
        flex-wrap: wrap;
      }

      .filter-search {
        min-width: 200px;
      }
    }
  `]
})
export class FilterBarComponent {
  @Input() filters: FilterConfig[] = [];
  @Input() values: { [key: string]: any } = {};
  @Input() compact = false;
  @Input() showReset = true;

  @Output() filterChange = new EventEmitter<{ key: string; value: any }>();
  @Output() reset = new EventEmitter<void>();

  get monthFilter(): FilterConfig | undefined {
    return this.filters.find(f => f.type === 'month');
  }

  get yearFilter(): FilterConfig | undefined {
    return this.filters.find(f => f.type === 'year');
  }

  get hasPeriodFilters(): boolean {
    return !!(this.monthFilter || this.yearFilter);
  }

  get regularFilters(): FilterConfig[] {
    return this.filters.filter(f => f.type !== 'month' && f.type !== 'year');
  }

  get hasActiveFilters(): boolean {
    return this.filters.some(f => {
      const value = this.values[f.key];
      const defaultValue = f.defaultValue;
      return value !== undefined && value !== '' && value !== defaultValue;
    });
  }

  onFilterChange(key: string, value: any): void {
    this.filterChange.emit({ key, value });
  }

  onReset(): void {
    this.reset.emit();
  }
}
