import { Component, Input, ContentChildren, QueryList, AfterContentInit, TemplateRef, Directive } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * StatChip - Individual stat item within a StatStrip
 */
@Component({
  selector: 'app-stat-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-chip" [class.stat-chip-highlight]="highlight">
      <span class="stat-chip-label">{{ label }}</span>
      <span class="stat-chip-value" [class.stat-chip-value-danger]="danger" [class.stat-chip-value-success]="success">
        @if (isCurrency && value !== null && value !== undefined) {
          {{ currencySymbol }} {{ formatNumber(value) }}
        } @else if (value !== null && value !== undefined) {
          {{ value }}
        } @else {
          —
        }
      </span>
    </div>
  `,
  styles: [`
    .stat-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      min-width: 90px;
      flex-shrink: 0;
      text-align: center;
    }

    .stat-chip-highlight {
      border-color: var(--color-primary);
      background: linear-gradient(135deg, var(--color-surface) 0%, #f0f6f4 100%);
    }

    .stat-chip-label {
      font-size: 9px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    .stat-chip-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text);
      white-space: nowrap;
    }

    .stat-chip-value-danger {
      color: var(--color-danger);
    }

    .stat-chip-value-success {
      color: var(--color-success);
    }

    @media (max-width: 767px) {
      .stat-chip {
        padding: 8px 12px;
        min-width: 80px;
      }

      .stat-chip-value {
        font-size: 13px;
      }
    }
  `]
})
export class StatChipComponent {
  @Input({ required: true }) label!: string;
  @Input() value: string | number | null | undefined;
  @Input() isCurrency = false;
  @Input() currencySymbol = 'KES';
  @Input() highlight = false;
  @Input() danger = false;
  @Input() success = false;

  formatNumber(val: string | number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}

/**
 * StatStrip - Horizontal scrolling row of stat chips.
 * 
 * Features:
 * - Horizontal scrolling on mobile (handles 5+ stats without breaking)
 * - Each chip is a bordered element with label above value
 * - Never wraps or compresses unreadably
 */
@Component({
  selector: 'app-stat-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stat-strip" [class.stat-strip-compact]="compact">
      <div class="stat-strip-inner">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .stat-strip {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
      margin-bottom: 12px;
    }

    .stat-strip::-webkit-scrollbar {
      height: 4px;
    }

    .stat-strip::-webkit-scrollbar-track {
      background: transparent;
    }

    .stat-strip::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 2px;
    }

    .stat-strip-inner {
      display: flex;
      gap: 10px;
      padding: 2px;
      min-width: min-content;
    }

    .stat-strip-compact .stat-strip-inner {
      gap: 6px;
    }

    /* Desktop: allow wrapping if there's space */
    @media (min-width: 768px) {
      .stat-strip {
        overflow-x: visible;
      }

      .stat-strip-inner {
        flex-wrap: wrap;
      }
    }

    /* Mobile: always horizontal scroll */
    @media (max-width: 767px) {
      .stat-strip-inner {
        flex-wrap: nowrap;
      }
    }
  `]
})
export class StatStripComponent {
  @Input() compact = false;
}
