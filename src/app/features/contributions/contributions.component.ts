import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Contribution, Member, ContributionType, Penalty } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { IconComponent } from '../../shared/icon.component';

interface AvailableMember {
  id: number;
  name: string;
  memberNo: string;
  selected?: boolean;
}

@Component({
  selector: 'app-contributions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './contributions.component.html',
  styles: [`
    /* Contribution Type Chips */
    .type-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px 10px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface);
      font-size: 10px;
      font-weight: 500;
      color: var(--color-text);
      cursor: pointer;
    }
    .type-chip:hover { border-color: var(--color-primary); }
    .type-chip.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: white;
    }
    .chip-freq { font-size: 9px; opacity: 0.7; }

    /* Month Picker & Select Styling */
    .filter-input {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      font-size: 10px;
      color: var(--color-text);
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .filter-input:hover {
      border-color: var(--color-primary-light);
    }
    .filter-input:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(11, 79, 71, 0.1);
    }

    .month-input {
      border: none;
      outline: none;
      background: transparent;
      font-size: 10px;
      font-family: inherit;
      color: var(--color-text);
      cursor: pointer;
      min-width: 100px;
    }
    .month-input::-webkit-calendar-picker-indicator {
      cursor: pointer;
      opacity: 0.6;
      font-size: 10px;
    }

    .filter-select {
      appearance: none;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7a78' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 8px center;
      padding: 5px 26px 5px 10px;
      font-size: 10px;
      font-family: inherit;
      color: var(--color-text);
      cursor: pointer;
      min-width: 110px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .filter-select:hover {
      border-color: var(--color-primary-light);
    }
    .filter-select:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px rgba(11, 79, 71, 0.1);
    }

    /* Progress Bar */
    .progress-section {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      padding: 10px 12px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
    }
    .progress-label { font-size: 9px; color: var(--color-text-muted); white-space: nowrap; }
    .progress-bar-container {
      flex: 1;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #166534, #22c55e);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .progress-percent { font-size: 10px; font-weight: 600; min-width: 32px; text-align: right; }

    /* Table enhancements */
    .col-amount { text-align: right !important; }
    .col-action { text-align: right !important; width: 110px; }
    .member-name { font-weight: 500; font-size: 10.5px; }
    .member-no { font-size: 9px; color: var(--color-text-muted); }
    .text-danger { color: var(--color-danger) !important; }
    .text-success { color: var(--color-success) !important; }
    .settled-text { font-size: 9px; color: var(--color-text-muted); font-style: italic; }

    /* Generate Modal - Members List */
    .select-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .select-all-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      cursor: pointer;
    }
    .select-count { font-size: 9px; color: var(--color-text-muted); }
    .members-list {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }
    .member-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      cursor: pointer;
      border-bottom: 1px solid var(--color-border);
    }
    .member-item:last-child { border-bottom: none; }
    .member-item:hover { background: #f7faf9; }
    .member-item.selected { background: #eaf4f2; }
    .member-info { flex: 1; }

    /* Payment info block */
    .payment-info {
      background: #f9fafb;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      margin-bottom: 12px;
    }
    .payment-member { font-size: 11px; font-weight: 600; }
    .payment-reason { font-size: 9px; color: var(--color-text-muted); margin-top: 2px; }
    .payment-detail { font-size: 10px; color: var(--color-text-muted); margin-top: 4px; }
    .payment-detail strong { font-weight: 600; }
  `]
})
export class ContributionsComponent implements OnInit {
  // Main data
  contributions: Contribution[] = [];
  members: Member[] = [];
  contributionTypes: ContributionType[] = [];
  penalties: Penalty[] = [];
  
  // Filters and state
  activeTab: 'contributions' | 'penalties' = 'contributions';
  selectedContributionTypeId: number | null = null;
  selectedMonth: string = '';
  statusFilter = 'ALL';
  penaltyStatusFilter = 'ALL';
  
  // Loading states
  loading = signal(false);
  loadingPenalties = signal(false);
  saving = signal(false);
  generating = signal(false);
  
  // Payment form
  showPaymentForm = false;
  payingContribution: Contribution | null = null;
  paymentAmount: number = 0;
  
  // Penalty payment
  showPenaltyPaymentForm = false;
  payingPenalty: Penalty | null = null;
  penaltyPaymentAmount: number = 0;

  // Generate modal
  showGenerateModal = false;
  availableMembers: AvailableMember[] = [];
  loadingAvailableMembers = signal(false);
  selectAllMembers = true;

  // Check penalties
  checkingPenalties = signal(false);

  constructor(
    private api: ApiService,
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.setDefaultMonth();
    this.loadContributionTypes();
    this.loadMembers();
    this.loadPenalties();
  }

  setDefaultMonth() {
    const now = new Date();
    this.selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  loadContributionTypes() {
    this.api.getContributionTypes().subscribe({
      next: (types) => {
        this.contributionTypes = types.filter(t => t.active);
        if (this.contributionTypes.length > 0 && !this.selectedContributionTypeId) {
          this.selectedContributionTypeId = this.contributionTypes[0].id;
          this.loadContributions();
        }
      },
      error: (err) => {
        if (err.status !== 403) {
          console.error('Failed to load contribution types:', err);
        }
      }
    });
  }

  loadContributions() {
    if (!this.selectedContributionTypeId) return;
    
    this.loading.set(true);
    this.api.getContributions(this.selectedMonth, this.selectedContributionTypeId).subscribe({
      next: (c) => {
        this.contributions = c;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          console.error('Failed to load contributions:', err);
        }
      }
    });
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (m) => this.members = m.filter(member => member.status === 'ACTIVE'),
      error: () => this.members = []
    });
  }

  loadPenalties() {
    this.loadingPenalties.set(true);
    this.api.getPenalties(this.selectedMonth).subscribe({
      next: (p) => {
        this.penalties = p;
        this.loadingPenalties.set(false);
      },
      error: (err) => {
        this.loadingPenalties.set(false);
        if (err.status !== 403) {
          console.error('Failed to load penalties:', err);
        }
      }
    });
  }

  // ==================== Filtered Data ====================
  get filteredContributions() {
    if (this.statusFilter === 'ALL') {
      return this.contributions;
    }
    return this.contributions.filter(c => c.status === this.statusFilter);
  }

  get filteredPenalties() {
    if (this.penaltyStatusFilter === 'ALL') {
      return this.penalties;
    }
    return this.penalties.filter(p => p.status === this.penaltyStatusFilter);
  }

  // ==================== Summary Stats ====================
  get totalDue() {
    return this.contributions.reduce((s, c) => s + c.amountDue, 0);
  }
  
  get totalPaid() {
    return this.contributions.reduce((s, c) => s + c.amountPaid, 0);
  }
  
  get paidCount() {
    return this.contributions.filter(c => c.status === 'PAID').length;
  }

  get pendingCount() {
    return this.contributions.filter(c => c.status === 'PENDING' || c.status === 'PARTIAL').length;
  }

  get totalPenaltiesAmount() {
    return this.penalties.reduce((s, p) => s + p.amount, 0);
  }

  get totalPenaltiesPaid() {
    return this.penalties.reduce((s, p) => s + p.paidAmount, 0);
  }

  get totalPenaltiesUnpaid() {
    return this.penalties
      .filter(p => p.status !== 'PAID' && p.status !== 'WAIVED')
      .reduce((s, p) => s + p.balance, 0);
  }

  get unpaidPenaltiesCount() {
    return this.penalties.filter(p => p.status === 'UNPAID' || p.status === 'PARTIAL').length;
  }

  get collectionProgress(): number {
    if (this.totalDue === 0) return 0;
    return (this.totalPaid / this.totalDue) * 100;
  }

  // ==================== Tab & Filter Actions ====================
  selectContributionType(typeId: number) {
    this.selectedContributionTypeId = typeId;
    this.loadContributions();
  }

  onMonthChange() {
    this.loadContributions();
  }

  getSelectedContributionType(): ContributionType | undefined {
    return this.contributionTypes.find(ct => ct.id === this.selectedContributionTypeId);
  }

  // ==================== Generate Contributions ====================
  openGenerateModal() {
    if (!this.selectedContributionTypeId) {
      this.toast.warning('Select type', 'Please select a contribution type first');
      return;
    }

    this.showGenerateModal = true;
    this.selectAllMembers = true;
    this.loadAvailableMembers();
  }

  closeGenerateModal() {
    this.showGenerateModal = false;
    this.availableMembers = [];
  }

  loadAvailableMembers() {
    if (!this.selectedContributionTypeId) return;
    
    this.loadingAvailableMembers.set(true);
    this.api.getAvailableMembersForContribution(this.selectedContributionTypeId, this.selectedMonth).subscribe({
      next: (members) => {
        this.availableMembers = members.map(m => ({ ...m, selected: true }));
        this.loadingAvailableMembers.set(false);
      },
      error: (err) => {
        this.loadingAvailableMembers.set(false);
        if (err.status !== 403) {
          this.toast.error('Error', 'Failed to load available members');
          console.error('Failed to load available members:', err);
        }
      }
    });
  }

  toggleSelectAll() {
    this.selectAllMembers = !this.selectAllMembers;
    this.availableMembers.forEach(m => m.selected = this.selectAllMembers);
  }

  toggleMember(member: AvailableMember) {
    member.selected = !member.selected;
    this.selectAllMembers = this.availableMembers.every(m => m.selected);
  }

  get selectedMembersCount(): number {
    return this.availableMembers.filter(m => m.selected).length;
  }

  generateContributions() {
    if (!this.selectedContributionTypeId) return;

    const selectedIds = this.availableMembers.filter(m => m.selected).map(m => m.id);
    
    if (selectedIds.length === 0) {
      this.toast.warning('No members', 'Please select at least one member');
      return;
    }

    this.generating.set(true);
    // If all members are selected, pass empty array to generate for all
    const memberIds = selectedIds.length === this.availableMembers.length ? [] : selectedIds;
    
    this.api.generateContributions(this.selectedContributionTypeId, this.selectedMonth, memberIds).subscribe({
      next: (res) => {
        this.generating.set(false);
        this.closeGenerateModal();
        this.toast.success('Generated', `${res.created} contribution records created`);
        this.loadContributions();
      },
      error: (err) => {
        this.generating.set(false);
        this.toast.error('Failed', err.error?.message || 'Could not generate contributions');
      }
    });
  }

  // ==================== Payment Recording ====================
  openPaymentForm(c: Contribution) {
    this.payingContribution = c;
    this.paymentAmount = c.amountDue - c.amountPaid;
    this.showPaymentForm = true;
  }

  closePaymentForm() {
    this.showPaymentForm = false;
    this.payingContribution = null;
    this.paymentAmount = 0;
  }

  recordPayment() {
    if (!this.payingContribution || this.paymentAmount <= 0) {
      this.toast.warning('Invalid amount', 'Please enter a valid payment amount');
      return;
    }

    this.saving.set(true);
    this.api.recordPayment(this.payingContribution.id, this.paymentAmount).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePaymentForm();
        this.toast.success('Payment recorded', 'The payment has been recorded successfully.');
        this.loadContributions();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Failed', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Penalty Management ====================
  openPenaltyPaymentForm(p: Penalty) {
    this.payingPenalty = p;
    this.penaltyPaymentAmount = p.balance;
    this.showPenaltyPaymentForm = true;
  }

  closePenaltyPaymentForm() {
    this.showPenaltyPaymentForm = false;
    this.payingPenalty = null;
    this.penaltyPaymentAmount = 0;
  }

  recordPenaltyPayment() {
    if (!this.payingPenalty || this.penaltyPaymentAmount <= 0) {
      this.toast.warning('Invalid amount', 'Please enter a valid payment amount');
      return;
    }

    this.saving.set(true);
    this.api.recordPenaltyPayment(this.payingPenalty.id, this.penaltyPaymentAmount).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePenaltyPaymentForm();
        this.toast.success('Payment recorded', 'The penalty payment has been recorded.');
        this.loadPenalties();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Failed', err.error?.message || 'Please try again.');
      }
    });
  }

  async waivePenalty(p: Penalty) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Waive Penalty?',
      message: `Are you sure you want to waive the penalty for ${p.memberName}? This action cannot be undone.`,
      confirmText: 'Waive',
      type: 'warning'
    });

    if (confirmed) {
      this.api.waivePenalty(p.id).subscribe({
        next: () => {
          this.toast.success('Penalty waived', 'The penalty has been waived.');
          this.loadPenalties();
        },
        error: (err) => {
          this.toast.error('Failed', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  // ==================== Helpers ====================
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PAID': return 'badge-success';
      case 'PARTIAL': return 'badge-warning';
      case 'PENDING': return 'badge-neutral';
      case 'OVERDUE': 
      case 'DEFAULTED': return 'badge-danger';
      case 'WAIVED': return 'badge-info';
      case 'UNPAID': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  getPenaltyTypeLabel(type: string): string {
    switch (type) {
      case 'MEETING_ABSENT': return 'Meeting Absence';
      case 'LATE_PAYMENT': return 'Late Payment';
      default: return type;
    }
  }

  getFrequencyLabel(ct: ContributionType | undefined): string {
    if (!ct) return '';
    switch (ct.frequency) {
      case 'WEEKLY': return 'Weekly';
      case 'MONTHLY': return 'Monthly';
      case 'QUARTERLY': return 'Quarterly';
      case 'YEARLY': return 'Yearly';
      default: return ct.frequency;
    }
  }

  // ==================== Check Penalties ====================
  checkPenalties() {
    this.checkingPenalties.set(true);
    this.api.checkAndImposePenalties(this.selectedMonth).subscribe({
      next: (res) => {
        this.checkingPenalties.set(false);
        if (res.penaltiesImposed > 0) {
          this.toast.success('Penalties Checked', `${res.penaltiesImposed} late payment penalties imposed`);
        } else {
          this.toast.info('No Penalties', 'No new penalties to impose for this period');
        }
        this.loadPenalties();
        this.loadContributions(); // Reload contributions to show updated status
      },
      error: (err) => {
        this.checkingPenalties.set(false);
        this.toast.error('Failed', err.error?.message || 'Could not check penalties');
      }
    });
  }
}
