import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef, Directive, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../icon.component';

/**
 * Directive for marking the collapsed content
 */
@Directive({
  selector: '[collapsedContent]',
  standalone: true
})
export class CollapsedContentDirective {
  constructor(public templateRef: TemplateRef<any>) {}
}

/**
 * Directive for marking the expanded content
 */
@Directive({
  selector: '[expandedContent]',
  standalone: true
})
export class ExpandedContentDirective {
  constructor(public templateRef: TemplateRef<any>) {}
}

/**
 * CollapsibleSection - Generic tap-to-expand wrapper.
 * 
 * Features:
 * - Collapsed slot and expanded slot are both required inputs
 * - Smooth expand/collapse animation
 * - 44px minimum touch target for toggle
 * - Supports external control of expanded state
 */
@Component({
  selector: 'app-collapsible-section',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="collapsible-section" [class.collapsible-section-expanded]="expanded()">
      <!-- Collapsed Header (always visible, acts as toggle) -->
      <button 
        class="collapsible-header"
        (click)="toggle()"
        [attr.aria-expanded]="expanded()"
        type="button"
      >
        <div class="collapsible-header-content">
          <ng-container *ngTemplateOutlet="collapsedContentTemplate?.templateRef || null"></ng-container>
        </div>
        <div class="collapsible-toggle">
          <app-icon 
            [name]="expanded() ? 'chevron-down' : 'chevron-right'" 
            [size]="16"
          ></app-icon>
        </div>
      </button>

      <!-- Expanded Content -->
      @if (expanded()) {
        <div class="collapsible-body" [@expandCollapse]>
          <ng-container *ngTemplateOutlet="expandedContentTemplate?.templateRef || null"></ng-container>
        </div>
      }
    </div>
  `,
  styles: [`
    .collapsible-section {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 8px;
    }

    .collapsible-section-expanded {
      border-color: var(--color-primary-light);
    }

    .collapsible-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      padding: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      min-height: 44px;
      transition: background-color 0.15s;
    }

    .collapsible-header:hover {
      background: #f8fafa;
    }

    .collapsible-header:active {
      background: #f0f4f3;
    }

    .collapsible-header-content {
      flex: 1;
      min-width: 0;
    }

    .collapsible-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      margin: -12px;
      margin-left: 0;
      color: var(--color-text-muted);
      transition: transform 0.2s;
    }

    .collapsible-section-expanded .collapsible-toggle {
      color: var(--color-primary);
    }

    .collapsible-body {
      padding: 0 12px 12px;
      border-top: 1px solid var(--color-border);
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Mobile */
    @media (max-width: 767px) {
      .collapsible-header {
        padding: 10px;
      }

      .collapsible-body {
        padding: 0 10px 10px;
      }
    }
  `]
})
export class CollapsibleSectionComponent {
  @Input() initialExpanded = false;

  @ContentChild(CollapsedContentDirective) collapsedContentTemplate?: CollapsedContentDirective;
  @ContentChild(ExpandedContentDirective) expandedContentTemplate?: ExpandedContentDirective;

  @Output() expandedChange = new EventEmitter<boolean>();

  expanded = signal(false);

  ngOnInit() {
    this.expanded.set(this.initialExpanded);
  }

  toggle() {
    this.expanded.update(v => !v);
    this.expandedChange.emit(this.expanded());
  }

  expand() {
    this.expanded.set(true);
    this.expandedChange.emit(true);
  }

  collapse() {
    this.expanded.set(false);
    this.expandedChange.emit(false);
  }
}
