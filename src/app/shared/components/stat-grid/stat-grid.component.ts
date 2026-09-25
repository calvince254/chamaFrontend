import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Stat card definition
 */
export interface StatItem {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
}

/**
 * StatGrid - Responsive stat cards grid
 * 
 * Per spec section 3.1:
 * - Desktop: N cards in a single row
 * - Tablet: 3 per row
 * - Mobile: 2 per row if ≤4 stats, otherwise horizontal scroll
 * 
 * Features:
 * - Automatic layout based on number of stats
 * - Horizontal scroll for >4 stats on mobile
 * - Consistent card styling across the app
 */
@Component({
  selector: 'app-stat-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="stat-grid-container" 
      [class.stat-grid-scroll]="scrollOnMobile && stats.length > 4"
    >
      @for (stat of stats; track stat.label) {
        <div class="stat-grid-card" [class]="'stat-color-' + (stat.color || 'default')">
          <span class="stat-grid-label">{{ stat.label }}</span>
          <span class="stat-grid-value">
            @if (stat.prefix) { {{ stat.prefix }} }
            {{ formatValue(stat.value) }}
            @if (stat.suffix) { {{ stat.suffix }} }
          </span>
          @if (stat.subtitle) {
            <span class="stat-grid-subtitle">{{ stat.subtitle }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .stat-grid-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }

    /* Scrollable variant for >4 stats on mobile */
    .stat-grid-scroll {
      display: flex;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      gap: 8px;
      padding-bottom: 4px;
    }

    .stat-grid-scroll::-webkit-scrollbar {
      display: none;
    }

    .stat-grid-scroll .stat-grid-card {
      flex: 0 0 auto;
      min-width: 130px;
    }

    /* Stat card */
    .stat-grid-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-grid-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .stat-grid-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.2;
    }

    .stat-grid-subtitle {
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* Color variants */
    .stat-color-success .stat-grid-value {
      color: var(--color-success);
    }

    .stat-color-warning .stat-grid-value {
      color: var(--color-warning);
    }

    .stat-color-danger .stat-grid-value {
      color: var(--color-danger);
    }

    .stat-color-info .stat-grid-value {
      color: var(--color-info);
    }

    /* Tablet: 3 per row */
    @media (min-width: 860px) {
      .stat-grid-container {
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }

      .stat-grid-scroll {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        overflow-x: visible;
      }

      .stat-grid-scroll .stat-grid-card {
        min-width: auto;
      }

      .stat-grid-card {
        padding: 14px 16px;
      }

      .stat-grid-value {
        font-size: 20px;
      }
    }

    /* Desktop: 4+ per row */
    @media (min-width: 1200px) {
      .stat-grid-container {
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
      }

      .stat-grid-scroll {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }

      .stat-grid-card {
        padding: 14px 18px;
      }

      .stat-grid-value {
        font-size: 22px;
      }
    }
  `]
})
export class StatGridComponent {
  @Input() stats: StatItem[] = [];
  @Input() scrollOnMobile = true;

  formatValue(value: string | number): string {
    if (typeof value === 'number') {
      return value.toLocaleString('en-US');
    }
    return value;
  }
}
