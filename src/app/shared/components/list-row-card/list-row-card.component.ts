import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef, Directive } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { IconActionComponent } from '../icon-action/icon-action.component';

/**
 * Directive for marking content as secondary lines
 */
@Directive({
  selector: '[listRowSecondary]',
  standalone: true
})
export class ListRowSecondaryDirective {}

/**
 * Directive for marking content as footer actions
 */
@Directive({
  selector: '[listRowFooter]',
  standalone: true
})
export class ListRowFooterDirective {}

/**
 * ListRowCard - Card shell for every list row on mobile.
 * 
 * Features:
 * - Always has visible border/background (cannot be accidentally omitted)
 * - Defined slots: title row (primary text + status badge), secondary lines, footer row
 * - Primary action is REQUIRED - not optional
 * - Zero-state renders cleanly (just title + action)
 * - 44px minimum touch targets
 */
@Component({
  selector: 'app-list-row-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, IconActionComponent],
  template: `
    <div class="list-row-card" [class.list-row-card-inactive]="inactive">
      <!-- Title Row -->
      <div class="list-row-title">
        <div class="list-row-title-content">
          <span class="list-row-primary-text">{{ title }}</span>
          @if (subtitle) {
            <span class="list-row-subtitle">{{ subtitle }}</span>
          }
        </div>
        @if (status) {
          <app-status-badge [status]="status" [label]="statusLabel"></app-status-badge>
        }
      </div>

      <!-- Secondary Content (projected) -->
      <div class="list-row-secondary" *ngIf="hasSecondaryContent">
        <ng-content select="[listRowSecondary]"></ng-content>
      </div>

      <!-- Footer Row -->
      <div class="list-row-footer">
        <div class="list-row-footer-left">
          <ng-content select="[listRowFooter]"></ng-content>
        </div>
        <div class="list-row-footer-actions">
          <!-- Secondary actions (overflow menu items) -->
          @for (action of secondaryActions; track action.label) {
            <app-icon-action
              [icon]="action.icon"
              [label]="action.label"
              [variant]="action.variant || 'ghost'"
              [disabled]="action.disabled || false"
              (action)="onSecondaryAction(action)"
            ></app-icon-action>
          }
          
          <!-- Primary action - REQUIRED -->
          <button 
            class="list-row-primary-action"
            [class.list-row-primary-action-disabled]="primaryActionDisabled"
            [disabled]="primaryActionDisabled"
            (click)="onPrimaryActionClick($event)"
          >
            {{ primaryActionLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .list-row-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 12px;
      margin-bottom: 8px;
      box-shadow: var(--shadow-card);
    }

    .list-row-card-inactive {
      opacity: 0.6;
    }

    /* Title Row */
    .list-row-title {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .list-row-title-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }

    .list-row-primary-text {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text);
      line-height: 1.3;
      word-break: break-word;
    }

    .list-row-subtitle {
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* Secondary Content */
    .list-row-secondary {
      padding: 8px 0;
      border-top: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 8px;
    }

    .list-row-secondary:empty {
      display: none;
    }

    /* Footer Row */
    .list-row-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 44px;
    }

    .list-row-footer-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .list-row-footer-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    /* Primary Action Button - REQUIRED, always visible */
    .list-row-primary-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      padding: 8px 16px;
      background: var(--color-accent);
      color: #26170a;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s;
      white-space: nowrap;
    }

    .list-row-primary-action:hover:not(:disabled) {
      background: var(--color-accent-dark);
    }

    .list-row-primary-action:active:not(:disabled) {
      transform: scale(0.98);
    }

    .list-row-primary-action-disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Mobile optimization */
    @media (max-width: 859px) {
      .list-row-card {
        padding: 10px;
      }

      .list-row-primary-action {
        min-width: 44px;
        min-height: 44px;
      }
    }

    /* Small phone support */
    @media (max-width: 479px) {
      .list-row-footer {
        flex-wrap: wrap;
      }

      .list-row-footer-left {
        width: 100%;
        margin-bottom: 8px;
      }

      .list-row-footer-actions {
        width: 100%;
        justify-content: flex-end;
      }
    }
  `]
})
export class ListRowCardComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() status?: string;
  @Input() statusLabel?: string;
  @Input() inactive = false;
  
  // Primary action - REQUIRED
  @Input({ required: true }) primaryActionLabel!: string;
  @Input() primaryActionDisabled = false;
  @Output() primaryAction = new EventEmitter<void>();

  // Secondary actions (shown as icon buttons)
  @Input() secondaryActions: Array<{
    icon: string;
    label: string;
    variant?: 'ghost' | 'danger' | 'outline';
    disabled?: boolean;
    data?: any;
  }> = [];

  @Output() secondaryAction = new EventEmitter<{ label: string; data?: any }>();

  // Check if secondary content is provided
  @ContentChild(ListRowSecondaryDirective) secondaryContent?: ListRowSecondaryDirective;
  
  get hasSecondaryContent(): boolean {
    return !!this.secondaryContent;
  }

  onPrimaryActionClick(event: MouseEvent) {
    event.stopPropagation();
    if (!this.primaryActionDisabled) {
      this.primaryAction.emit();
    }
  }

  onSecondaryAction(action: { icon: string; label: string; data?: any }) {
    this.secondaryAction.emit({ label: action.label, data: action.data });
  }
}
