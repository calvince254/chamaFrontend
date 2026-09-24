import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * LabelValue - Shared component for displaying "label: value" pairs.
 * 
 * Features:
 * - Renders label and value as separate elements with explicit gap
 * - Never visually merges at any screen width (tested to 320px)
 * - Supports horizontal (inline) and vertical (stacked) layouts
 * - Supports currency formatting
 */
@Component({
  selector: 'app-label-value',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="label-value" [class.label-value-stacked]="stacked" [class.label-value-compact]="compact">
      <span class="label-value-label">{{ label }}</span>
      <span class="label-value-value" [class.label-value-primary]="highlight" [class.label-value-danger]="danger" [class.label-value-success]="success">
        @if (isCurrency && value !== null && value !== undefined) {
          {{ currencySymbol }} {{ formatNumber(value) }}
        } @else if (value !== null && value !== undefined && value !== '') {
          {{ value }}
        } @else {
          <span class="label-value-empty">—</span>
        }
      </span>
    </div>
  `,
  styles: [`
    .label-value {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
      flex-wrap: wrap;
    }

    .label-value-label {
      font-size: 10px;
      color: var(--color-text-muted);
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .label-value-value {
      font-size: 11px;
      color: var(--color-text);
      font-weight: 500;
      word-break: break-word;
      min-width: 0;
    }

    .label-value-primary {
      color: var(--color-primary);
      font-weight: 600;
    }

    .label-value-danger {
      color: var(--color-danger);
    }

    .label-value-success {
      color: var(--color-success);
    }

    .label-value-empty {
      color: var(--color-text-muted);
      font-style: italic;
    }

    /* Stacked layout (label above value) */
    .label-value-stacked {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .label-value-stacked .label-value-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .label-value-stacked .label-value-value {
      font-size: 12px;
    }

    /* Compact variant */
    .label-value-compact {
      gap: 4px;
    }

    .label-value-compact .label-value-label {
      font-size: 9px;
    }

    .label-value-compact .label-value-value {
      font-size: 10px;
    }

    /* Mobile: ensure proper wrapping at 320px */
    @media (max-width: 320px) {
      .label-value:not(.label-value-stacked) {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
    }
  `]
})
export class LabelValueComponent {
  @Input({ required: true }) label!: string;
  @Input() value: string | number | null | undefined;
  @Input() stacked = false;
  @Input() compact = false;
  @Input() isCurrency = false;
  @Input() currencySymbol = 'KES';
  @Input() highlight = false;
  @Input() danger = false;
  @Input() success = false;

  formatNumber(val: string | number | null | undefined): string {
    if (val === null || val === undefined) return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
}
