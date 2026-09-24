import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * StatusBadge - Shared component for displaying status/enum values across the app.
 * 
 * Features:
 * - Humanizes raw status values (PENDING_GUARANTORS → "Pending Guarantors")
 * - Centralized color mapping - one lookup table for all statuses
 * - Falls back to neutral gray for unrecognized statuses
 * - Never renders raw enum strings or blank
 */

// Central color mapping for ALL statuses in the app
// Add new statuses here - this is the ONE place to update
const STATUS_COLOR_MAP: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  // General positive statuses
  'active': 'success',
  'paid': 'success',
  'settled': 'success',
  'completed': 'success',
  'approved': 'success',
  'confirmed': 'success',
  'disbursed': 'success',
  'met': 'success',
  'present': 'success',
  'attending': 'success',
  'verified': 'success',
  'uploaded': 'success',
  'success': 'success',
  'login': 'success',
  'yes': 'success',
  'enabled': 'success',
  'available': 'success',
  'open': 'success',
  'running': 'success',
  'healthy': 'success',

  // Warning/pending statuses
  'pending': 'warning',
  'partial': 'warning',
  'pending_approval': 'warning',
  'pending_guarantors': 'warning',
  'pending_disbursement': 'warning',
  'awaiting_confirmation': 'warning',
  'in_progress': 'warning',
  'processing': 'warning',
  'draft': 'warning',
  'suspended': 'warning',
  'paused': 'warning',
  'on_hold': 'warning',
  'not_met': 'warning',
  'no_quorum': 'warning',
  'maybe': 'warning',
  'not_attending': 'warning',
  'absent': 'warning',
  'trial': 'warning',
  'expiring_soon': 'warning',

  // Danger/negative statuses
  'overdue': 'danger',
  'rejected': 'danger',
  'failed': 'danger',
  'cancelled': 'danger',
  'written_off': 'danger',
  'defaulted': 'danger',
  'expired': 'danger',
  'inactive': 'danger',
  'exited': 'danger',
  'deleted': 'danger',
  'blocked': 'danger',
  'error': 'danger',
  'closed': 'danger',
  'terminated': 'danger',
  'waived': 'danger',
  'unpaid': 'danger',

  // Info/neutral statuses
  'regular': 'info',
  'agm': 'info',
  'special': 'info',
  'monthly': 'info',
  'weekly': 'info',
  'annual': 'info',
  'quarterly': 'info',
  'view': 'info',
  'download': 'info',
  'create': 'info',
  'update': 'info',
  'edit': 'info',
  'delete': 'info',
  'upload': 'info',
  'export': 'info',
  'import': 'info',

  // Neutral statuses
  'new': 'neutral',
  'unknown': 'neutral',
  'n/a': 'neutral',
  'none': 'neutral',
  'default': 'neutral',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="status-badge" [class]="badgeClass()">
      {{ displayText() }}
    </span>
  `,
  styles: [`
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
      white-space: nowrap;
      line-height: 1.2;
    }

    .status-badge-success {
      background: var(--color-success-bg);
      color: var(--color-success);
    }

    .status-badge-warning {
      background: var(--color-warning-bg);
      color: #92400e;
    }

    .status-badge-danger {
      background: var(--color-danger-bg);
      color: var(--color-danger);
    }

    .status-badge-info {
      background: var(--color-info-bg);
      color: var(--color-info);
    }

    .status-badge-neutral {
      background: #eef2f1;
      color: var(--color-text-muted);
    }
  `]
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: string | null | undefined;
  
  // Optional override for display text (use sparingly)
  @Input() label?: string;

  // Computed display text - humanizes the status
  displayText = computed(() => {
    if (this.label) return this.label;
    return this.humanizeStatus(this.status);
  });

  // Computed badge class based on status
  badgeClass = computed(() => {
    const tone = this.getStatusTone(this.status);
    return `status-badge-${tone}`;
  });

  /**
   * Humanizes a raw status string:
   * - PENDING_GUARANTORS → "Pending Guarantors"
   * - written_off → "Written Off"
   * - NO_QUORUM → "No Quorum"
   */
  private humanizeStatus(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    
    // Replace underscores with spaces, then title-case each word
    return status
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Gets the color tone for a status from the central lookup table.
   * Falls back to 'neutral' for unrecognized statuses.
   */
  private getStatusTone(status: string | null | undefined): string {
    if (!status) return 'neutral';
    
    const normalizedStatus = status.toLowerCase().replace(/_/g, '_');
    return STATUS_COLOR_MAP[normalizedStatus] || 'neutral';
  }
}
