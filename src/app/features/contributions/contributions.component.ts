import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Contribution, Member, ContributionType, Penalty, PageResponse, ContributionTopUp } from '../../core/models/models';
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
    .date-picker-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

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
  activeTab: 'contributions' | 'penalties' | 'topups' = 'contributions';
  selectedContributionTypeId: number | null = null;
  selectedMonth: string = '';
  selectedYear: number = new Date().getFullYear();
  selectedMonthNum: number = new Date().getMonth() + 1;
  generateMonth: string = ''; // Separate month for generation modal
  statusFilter = 'ALL';
  penaltyStatusFilter = 'ALL';

  // Pagination for contributions
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;
  Math = Math;

  // Pagination for penalties
  penaltyPage = 0;
  penaltyTotalElements = 0;
  penaltyTotalPages = 0;
  penaltyIsFirst = true;
  penaltyIsLast = true;
  
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

  // Top-up state
  topUps: ContributionTopUp[] = [];
  loadingTopUps = signal(false);
  topUpPage = 0;
  topUpTotalElements = 0;
  topUpTotalPages = 0;
  topUpIsFirst = true;
  topUpIsLast = true;
  topUpStatusFilter = 'ALL';
  pendingTopUpsCount = 0;

  // Create top-up form
  showTopUpForm = false;
  topUpFormData = {
    contributionTypeId: null as number | null,
    amount: 0,
    paymentReference: '',
    notes: ''
  };
  submittingTopUp = signal(false);

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
    this.loadTopUps();
    this.loadPendingTopUpsCount();
  }

  setDefaultMonth() {
    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonthNum = now.getMonth() + 1;
    this.selectedMonth = `${this.selectedYear}-${String(this.selectedMonthNum).padStart(2, '0')}`;
  }

  // Year options (5 years back to 2 years ahead)
  get yearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 5; y <= currentYear + 2; y++) {
      years.push(y);
    }
    return years;
  }

  // Month options (all 12 months)
  get monthOptions(): { value: number; label: string }[] {
    return [
      { value: 1, label: 'January' },
      { value: 2, label: 'February' },
      { value: 3, label: 'March' },
      { value: 4, label: 'April' },
      { value: 5, label: 'May' },
      { value: 6, label: 'June' },
      { value: 7, label: 'July' },
      { value: 8, label: 'August' },
      { value: 9, label: 'September' },
      { value: 10, label: 'October' },
      { value: 11, label: 'November' },
      { value: 12, label: 'December' }
    ];
  }

  onYearMonthChange() {
    this.selectedMonth = `${this.selectedYear}-${String(this.selectedMonthNum).padStart(2, '0')}`;
    this.currentPage = 0;
    this.loadContributions();
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
    const status = this.statusFilter === 'ALL' ? undefined : this.statusFilter;
    
    this.api.getContributionsPaginated(this.currentPage, this.pageSize, this.selectedContributionTypeId, this.selectedMonth, status).subscribe({
      next: (response: PageResponse<Contribution>) => {
        this.contributions = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
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

  onFilterChange() {
    this.currentPage = 0;
    this.loadContributions();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadContributions();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadContributions();
    }
  }

  prevPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadContributions();
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Penalty pagination
  goToPenaltyPage(page: number) {
    if (page >= 0 && page < this.penaltyTotalPages) {
      this.penaltyPage = page;
      this.loadPenalties();
    }
  }

  nextPenaltyPage() {
    if (!this.penaltyIsLast) {
      this.penaltyPage++;
      this.loadPenalties();
    }
  }

  prevPenaltyPage() {
    if (!this.penaltyIsFirst) {
      this.penaltyPage--;
      this.loadPenalties();
    }
  }

  get penaltyPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.penaltyPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.penaltyTotalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (m) => this.members = m.filter(member => member.status === 'ACTIVE'),
      error: () => this.members = []
    });
  }

  loadPenalties() {
    this.loadingPenalties.set(true);
    const status = this.penaltyStatusFilter === 'ALL' ? undefined : this.penaltyStatusFilter;
    
    this.api.getPenaltiesPaginated(this.penaltyPage, this.pageSize, status).subscribe({
      next: (response: PageResponse<Penalty>) => {
        this.penalties = response.content;
        this.penaltyTotalElements = response.totalElements;
        this.penaltyTotalPages = response.totalPages;
        this.penaltyIsFirst = response.first;
        this.penaltyIsLast = response.last;
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

  onPenaltyFilterChange() {
    this.penaltyPage = 0;
    this.loadPenalties();
  }

  // ==================== Filtered Data ====================
  // Note: Filtering is now done server-side via pagination API
  get filteredContributions() {
    return this.contributions;
  }

  get filteredPenalties() {
    return this.penalties;
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
    this.currentPage = 0;
    this.loadContributions();
  }

  onMonthChange() {
    this.currentPage = 0;
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

    this.generateMonth = this.selectedMonth; // Initialize with current filter month
    this.showGenerateModal = true;
    this.selectAllMembers = true;
    this.loadAvailableMembers();
  }

  closeGenerateModal() {
    this.showGenerateModal = false;
    this.availableMembers = [];
  }

  onGenerateMonthChange() {
    this.loadAvailableMembers();
  }

  loadAvailableMembers() {
    if (!this.selectedContributionTypeId) return;
    
    this.loadingAvailableMembers.set(true);
    this.api.getAvailableMembersForContribution(this.selectedContributionTypeId, this.generateMonth).subscribe({
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
    
    this.api.generateContributions(this.selectedContributionTypeId, this.generateMonth, memberIds).subscribe({
      next: (res) => {
        this.generating.set(false);
        this.closeGenerateModal();
        this.toast.success('Generated', `${res.created} contribution records created for ${this.generateMonth}`);
        // Update the filter to show the generated month
        this.selectedMonth = this.generateMonth;
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

  // ==================== Manual Top-Up ====================
  loadTopUps() {
    this.loadingTopUps.set(true);
    const status = this.topUpStatusFilter === 'ALL' ? undefined : this.topUpStatusFilter;
    
    this.api.getContributionTopUps(this.topUpPage, this.pageSize, { status }).subscribe({
      next: (response: PageResponse<ContributionTopUp>) => {
        this.topUps = response.content;
        this.topUpTotalElements = response.totalElements;
        this.topUpTotalPages = response.totalPages;
        this.topUpIsFirst = response.first;
        this.topUpIsLast = response.last;
        this.loadingTopUps.set(false);
      },
      error: (err) => {
        this.loadingTopUps.set(false);
        if (err.status !== 403) {
          console.error('Failed to load top-ups:', err);
        }
      }
    });
  }

  loadPendingTopUpsCount() {
    this.api.getPendingTopUpsCount().subscribe({
      next: (res) => this.pendingTopUpsCount = res.count,
      error: () => this.pendingTopUpsCount = 0
    });
  }

  onTopUpFilterChange() {
    this.topUpPage = 0;
    this.loadTopUps();
  }

  goToTopUpPage(page: number) {
    if (page >= 0 && page < this.topUpTotalPages) {
      this.topUpPage = page;
      this.loadTopUps();
    }
  }

  nextTopUpPage() {
    if (!this.topUpIsLast) {
      this.topUpPage++;
      this.loadTopUps();
    }
  }

  prevTopUpPage() {
    if (!this.topUpIsFirst) {
      this.topUpPage--;
      this.loadTopUps();
    }
  }

  get topUpPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.topUpPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.topUpTotalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Create top-up request
  openTopUpForm() {
    this.topUpFormData = {
      contributionTypeId: this.contributionTypes.length > 0 ? this.contributionTypes[0].id : null,
      amount: 0,
      paymentReference: '',
      notes: ''
    };
    this.showTopUpForm = true;
  }

  closeTopUpForm() {
    this.showTopUpForm = false;
  }

  submitTopUp() {
    if (!this.topUpFormData.contributionTypeId || this.topUpFormData.amount <= 0) {
      this.toast.warning('Invalid input', 'Please select a contribution type and enter a valid amount');
      return;
    }

    this.submittingTopUp.set(true);
    this.api.createContributionTopUp({
      contributionTypeId: this.topUpFormData.contributionTypeId,
      amount: this.topUpFormData.amount,
      paymentReference: this.topUpFormData.paymentReference || undefined,
      notes: this.topUpFormData.notes || undefined
    }).subscribe({
      next: () => {
        this.submittingTopUp.set(false);
        this.closeTopUpForm();
        this.toast.success('Top-up requested', 'Your top-up request has been submitted for approval');
        this.loadTopUps();
        this.loadPendingTopUpsCount();
      },
      error: (err) => {
        this.submittingTopUp.set(false);
        this.toast.error('Failed', err.error?.message || 'Could not submit top-up request');
      }
    });
  }

  // Approve/Reject top-up (admin actions)
  async approveTopUp(topUp: ContributionTopUp) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Approve Top-Up?',
      message: `Approve top-up of KES ${topUp.amount.toLocaleString()} for ${topUp.memberName} to ${topUp.contributionTypeName}?`,
      confirmText: 'Approve',
      type: 'info'
    });

    if (confirmed) {
      this.api.approveContributionTopUp(topUp.id).subscribe({
        next: () => {
          this.toast.success('Approved', 'Top-up has been approved and applied to contribution');
          this.loadTopUps();
          this.loadPendingTopUpsCount();
          this.loadContributions();
        },
        error: (err) => {
          this.toast.error('Failed', err.error?.message || 'Could not approve top-up');
        }
      });
    }
  }

  async rejectTopUp(topUp: ContributionTopUp) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Reject Top-Up?',
      message: `Reject top-up request from ${topUp.memberName}?`,
      confirmText: 'Reject',
      type: 'warning'
    });

    if (confirmed) {
      this.api.rejectContributionTopUp(topUp.id, 'Rejected by admin').subscribe({
        next: () => {
          this.toast.success('Rejected', 'Top-up request has been rejected');
          this.loadTopUps();
          this.loadPendingTopUpsCount();
        },
        error: (err) => {
          this.toast.error('Failed', err.error?.message || 'Could not reject top-up');
        }
      });
    }
  }

  getTopUpStatusClass(status: string): string {
    switch (status) {
      case 'APPROVED': return 'badge-success';
      case 'PENDING': return 'badge-warning';
      case 'REJECTED': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ', ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  }
}
