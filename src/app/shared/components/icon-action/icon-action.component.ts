import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../icon.component';

/**
 * IconAction - Shared component for tappable icons in list rows.
 * 
 * Features:
 * - Minimum 44x44px tap target (accessibility requirement)
 * - Explicit icon name and label (for accessibility and tooltip)
 * - Visible fallback when icon not found (never silent failure)
 * - Supports primary, ghost, and danger variants
 */

// Known valid icon names from IconComponent
const VALID_ICONS = new Set([
  'grid', 'users', 'calendar', 'wallet', 'cash', 'refresh', 'pie', 'pie-chart',
  'heart', 'trending', 'chart', 'shield', 'gear', 'logout', 'search', 'plus',
  'bell', 'chevronDown', 'close', 'check', 'trending-up', 'refresh-cw', 'file-text',
  'check-circle', 'x-circle', 'alert-triangle', 'alert-circle', 'info', 'x', 'mail',
  'phone', 'pause', 'menu', 'eye', 'trash', 'edit', 'chevron-left', 'chevron-right',
  'arrow-left', 'edit-2', 'dollar-sign', 'bar-chart-2', 'folder', 'activity',
  'download', 'upload', 'file-badge', 'user', 'file', 'bar-chart', 'file-spreadsheet',
  'image', 'video', 'music', 'archive', 'copy', 'monitor', 'more-vertical', 'lock',
  'settings', 'external-link'
]);

@Component({
  selector: 'app-icon-action',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <button 
      class="icon-action" 
      [class]="buttonClass()"
      [attr.aria-label]="label"
      [attr.title]="label"
      [disabled]="disabled"
      (click)="handleClick($event)"
    >
      @if (isValidIcon()) {
        <app-icon [name]="icon" [size]="iconSize"></app-icon>
      } @else {
        <!-- Fallback: show visible text button when icon not found -->
        <span class="icon-action-fallback">{{ fallbackText() }}</span>
      }
    </button>
  `,
  styles: [`
    .icon-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      padding: 8px;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
      color: var(--color-text-muted);
    }

    .icon-action:hover:not(:disabled) {
      background: #f0f4f3;
      color: var(--color-text);
    }

    .icon-action:active:not(:disabled) {
      background: #e5eae8;
    }

    .icon-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Primary variant */
    .icon-action-primary {
      background: var(--color-primary);
      color: white;
    }

    .icon-action-primary:hover:not(:disabled) {
      background: var(--color-primary-dark);
      color: white;
    }

    /* Ghost variant (default) */
    .icon-action-ghost {
      background: transparent;
    }

    /* Danger variant */
    .icon-action-danger:hover:not(:disabled) {
      background: var(--color-danger-bg);
      color: var(--color-danger);
    }

    /* Outlined variant */
    .icon-action-outline {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    .icon-action-outline:hover:not(:disabled) {
      border-color: var(--color-primary);
      background: #f0f6f4;
    }

    /* Fallback text styling - make it VISIBLE that something is wrong */
    .icon-action-fallback {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 4px;
      background: var(--color-warning-bg);
      color: var(--color-warning);
      border-radius: 2px;
    }

    /* Compact variant for tight spaces */
    .icon-action-compact {
      min-width: 36px;
      min-height: 36px;
      padding: 6px;
    }

    @media (max-width: 767px) {
      .icon-action {
        min-width: 44px;
        min-height: 44px;
      }
    }
  `]
})
export class IconActionComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) label!: string;
  @Input() variant: 'ghost' | 'primary' | 'danger' | 'outline' = 'ghost';
  @Input() disabled = false;
  @Input() compact = false;
  @Input() iconSize = 18;

  @Output() action = new EventEmitter<MouseEvent>();

  isValidIcon = computed(() => {
    return VALID_ICONS.has(this.icon);
  });

  buttonClass = computed(() => {
    const classes = [`icon-action-${this.variant}`];
    if (this.compact) {
      classes.push('icon-action-compact');
    }
    return classes.join(' ');
  });

  // Fallback text is derived from the label - shows what the action is
  fallbackText = computed(() => {
    // Take first 3 chars of label as abbreviation
    return this.label.substring(0, 3).toUpperCase();
  });

  handleClick(event: MouseEvent) {
    if (!this.disabled) {
      this.action.emit(event);
    }
  }
}
