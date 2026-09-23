import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Contribution, Member, ContributionType, Penalty, PageResponse, ContributionTopUp, InitiatePaymentRequest, InitiatePaymentResponse, EnabledPaymentMethods } from '../../core/models/models';
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
  styleUrl: './contributions.component.css',
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
  
  // Payment form (admin record payment)
  showPaymentForm = false;
  payingContribution: Contribution | null = null;
  paymentAmount: number = 0;
  
  // Member contribution payment (with payment method selection)
  showMemberContributionPaymentModal = false;
  contributionToPayMember: Contribution | null = null;
  selectedContributionPaymentMethod: 'MANUAL' | 'STK_PUSH' | 'IN_APP_SMS' = 'MANUAL';
  contributionPaymentReferenceCode = '';
  contributionPaymentPhoneNumber = '';
  contributionPaymentAmount = 0;
  submittingContributionPayment = signal(false);
  contributionPaymentResponse: InitiatePaymentResponse | null = null;
  contributionPaymentMethods: EnabledPaymentMethods | null = null;
  loadingContributionPaymentMethods = signal(false);
  
  // Penalty payment
  showPenaltyPaymentForm = false;
  payingPenalty: Penalty | null = null;
  penaltyPaymentAmount: number = 0;
  
  // Member penalty payment (with payment method selection)
  showMemberPenaltyPaymentModal = false;
  penaltyToPayMember: Penalty | null = null;
  selectedPenaltyPaymentMethod: 'MANUAL' | 'STK_PUSH' | 'IN_APP_SMS' = 'MANUAL';
  penaltyPaymentReferenceCode = '';
  penaltyPaymentPhoneNumber = '';
  submittingPenaltyPayment = signal(false);
  penaltyPaymentResponse: InitiatePaymentResponse | null = null;
  penaltyPaymentMethods: EnabledPaymentMethods | null = null;
  loadingPenaltyPaymentMethods = signal(false);

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
    notes: '',
    targetMonth: '',
    description: ''
  };
  submittingTopUp = signal(false);

  // Track available members count for current filter month (to control Generate button visibility)
  availableMembersForFilterMonth = signal(0);
  loadingAvailableMembersCount = signal(false);

  constructor(
    private api: ApiService,
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    // Only load data if user has permission to view contributions
    if (this.session.can('VIEW_CONTRIBUTIONS') || this.session.can('CREATE_CONTRIBUTION')) {
      this.setDefaultMonth();
      this.loadContributionTypes();
      this.loadMembers();
      this.loadPenalties();
      this.loadTopUps();
      this.loadPendingTopUpsCount();
    }
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
        console.log('=== Contributions API Response ===');
        console.log('Total:', response.totalElements);
        response.content.forEach(c => {
          console.log(`  ${c.memberName}: hasPendingClaim=${c.hasPendingClaim}, payableId=${c.payableId}, status=${c.status}`);
        });
        this.contributions = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loading.set(false);
        // Also check available members count for this month
        this.loadAvailableMembersCount();
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          console.error('Failed to load contributions:', err);
        }
      }
    });
  }

  /**
   * Load the count of members who don't have contributions for the current filter month.
   * This determines whether the "Generate" button should be visible.
   */
  loadAvailableMembersCount() {
    if (!this.selectedContributionTypeId) {
      this.availableMembersForFilterMonth.set(0);
      return;
    }
    
    this.loadingAvailableMembersCount.set(true);
    this.api.getAvailableMembersForContribution(this.selectedContributionTypeId, this.selectedMonth).subscribe({
      next: (members) => {
        this.availableMembersForFilterMonth.set(members.length);
        this.loadingAvailableMembersCount.set(false);
      },
      error: () => {
        this.availableMembersForFilterMonth.set(0);
        this.loadingAvailableMembersCount.set(false);
      }
    });
  }

  /**
   * Check if the Generate button should be visible:
   * - User has permission
   * - A contribution type is selected
   * - There are members without contributions for the selected month
   */
  canShowGenerateButton(): boolean {
    return this.session.can('GENERATE_CONTRIBUTIONS') 
        && this.selectedContributionTypeId !== null 
        && this.availableMembersForFilterMonth() > 0;
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
    
    // Only load CONTRIBUTION_LATE_PAYMENT penalties in the Contributions page
    this.api.getPenaltiesPaginated(this.penaltyPage, this.pageSize, status, undefined, 'CONTRIBUTION_LATE_PAYMENT').subscribe({
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
        if (res.created === 0) {
          this.toast.info('Already generated', `Contributions for ${this.generateMonth} already exist for all selected members. No new records created.`);
        } else {
          this.toast.success('Generated', `${res.created} contribution records created for ${this.generateMonth}`);
        }
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
  
  /**
   * Check if current user owns this contribution
   */
  isOwnContribution(c: Contribution): boolean {
    const currentUser = this.session.currentUser();
    return currentUser && c.memberId ? c.memberId === currentUser.id : false;
  }

  /**
   * Check if contribution can be paid (not PAID)
   */
  canPayContribution(c: Contribution): boolean {
    return c.status !== 'PAID';
  }

  /**
   * Open member contribution payment modal
   */
  openMemberContributionPaymentModal(c: Contribution) {
    this.contributionToPayMember = c;
    this.selectedContributionPaymentMethod = 'MANUAL';
    this.contributionPaymentReferenceCode = '';
    this.contributionPaymentPhoneNumber = '';
    this.contributionPaymentAmount = c.amountDue - c.amountPaid;
    this.contributionPaymentResponse = null;
    this.showMemberContributionPaymentModal = true;
    this.loadContributionPaymentMethods();
  }

  closeMemberContributionPaymentModal() {
    this.showMemberContributionPaymentModal = false;
    this.contributionToPayMember = null;
    this.contributionPaymentResponse = null;
  }

  loadContributionPaymentMethods() {
    this.loadingContributionPaymentMethods.set(true);
    this.api.getEnabledPaymentMethods().subscribe({
      next: (methods) => {
        this.contributionPaymentMethods = methods;
        if (methods.manualEnabled) {
          this.selectedContributionPaymentMethod = 'MANUAL';
        } else if (methods.inAppSmsEnabled) {
          this.selectedContributionPaymentMethod = 'IN_APP_SMS';
        } else if (methods.stkPushEnabled) {
          this.selectedContributionPaymentMethod = 'STK_PUSH';
        }
        this.loadingContributionPaymentMethods.set(false);
      },
      error: () => {
        this.loadingContributionPaymentMethods.set(false);
      }
    });
  }

  canSubmitContributionPayment(): boolean {
    if (!this.contributionToPayMember) return false;
    if (this.contributionPaymentAmount <= 0) return false;
    if (this.selectedContributionPaymentMethod === 'MANUAL' && !this.contributionPaymentReferenceCode.trim()) return false;
    if (this.selectedContributionPaymentMethod === 'STK_PUSH' && !this.contributionPaymentPhoneNumber.trim()) return false;
    return true;
  }

  submitMemberContributionPayment() {
    if (!this.contributionToPayMember) return;

    if (this.selectedContributionPaymentMethod === 'MANUAL' && !this.contributionPaymentReferenceCode.trim()) {
      this.toast.warning('Reference required', 'Please enter a payment reference number.');
      return;
    }
    if (this.selectedContributionPaymentMethod === 'STK_PUSH' && !this.contributionPaymentPhoneNumber.trim()) {
      this.toast.warning('Phone required', 'Please enter the phone number for M-PESA.');
      return;
    }

    this.submittingContributionPayment.set(true);

    const request: InitiatePaymentRequest = {
      paymentType: 'CONTRIBUTION',
      referenceId: this.contributionToPayMember.id,
      payerMemberId: this.contributionToPayMember.memberId!,
      amount: this.contributionPaymentAmount,
      paymentMethod: this.selectedContributionPaymentMethod,
      referenceCode: this.selectedContributionPaymentMethod === 'MANUAL' ? this.contributionPaymentReferenceCode.trim() : undefined,
      phoneNumber: this.selectedContributionPaymentMethod === 'STK_PUSH' ? this.contributionPaymentPhoneNumber.trim() : undefined
    };

    this.api.initiatePayment(request).subscribe({
      next: (response) => {
        console.log('=== initiatePayment response ===', response);
        console.log('awaitingVerification:', response.awaitingVerification);
        console.log('status:', response.status);
        this.submittingContributionPayment.set(false);
        this.contributionPaymentResponse = response;

        if (response.awaitingVerification) {
          this.toast.success('Payment submitted', 'Your payment has been submitted and is awaiting admin verification.');
          this.closeMemberContributionPaymentModal();
          this.loadContributions();
        } else if (response.status === 'STK_INITIATED') {
          this.toast.info('Check your phone', 'An M-PESA prompt has been sent. Complete the payment.');
        } else if (response.status === 'MATCHED') {
          this.toast.success('Payment confirmed!', 'Your contribution payment has been confirmed.');
          this.closeMemberContributionPaymentModal();
          this.loadContributions();
        } else {
          this.toast.info('Payment processing', response.statusMessage);
        }
      },
      error: (err) => {
        this.submittingContributionPayment.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Failed to process payment.');
      }
    });
  }

  // Admin direct payment recording
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
  
  /**
   * Check if current user owns this penalty
   */
  isOwnPenalty(penalty: Penalty): boolean {
    const currentUser = this.session.currentUser();
    return currentUser ? penalty.memberId === currentUser.id : false;
  }

  /**
   * Check if penalty can be paid (not PAID or WAIVED)
   */
  canPayPenalty(penalty: Penalty): boolean {
    return penalty.status !== 'PAID' && penalty.status !== 'WAIVED';
  }

  /**
   * Open member payment modal (for paying own penalty)
   */
  openMemberPenaltyPaymentModal(p: Penalty) {
    this.penaltyToPayMember = p;
    this.selectedPenaltyPaymentMethod = 'MANUAL';
    this.penaltyPaymentReferenceCode = '';
    this.penaltyPaymentPhoneNumber = '';
    this.penaltyPaymentResponse = null;
    this.showMemberPenaltyPaymentModal = true;
    this.loadPenaltyPaymentMethods();
  }

  closeMemberPenaltyPaymentModal() {
    this.showMemberPenaltyPaymentModal = false;
    this.penaltyToPayMember = null;
    this.penaltyPaymentResponse = null;
  }

  loadPenaltyPaymentMethods() {
    this.loadingPenaltyPaymentMethods.set(true);
    this.api.getEnabledPaymentMethods().subscribe({
      next: (methods) => {
        this.penaltyPaymentMethods = methods;
        // Set default method based on what's enabled
        if (methods.manualEnabled) {
          this.selectedPenaltyPaymentMethod = 'MANUAL';
        } else if (methods.inAppSmsEnabled) {
          this.selectedPenaltyPaymentMethod = 'IN_APP_SMS';
        } else if (methods.stkPushEnabled) {
          this.selectedPenaltyPaymentMethod = 'STK_PUSH';
        }
        this.loadingPenaltyPaymentMethods.set(false);
      },
      error: () => {
        this.loadingPenaltyPaymentMethods.set(false);
      }
    });
  }

  canSubmitPenaltyPayment(): boolean {
    if (!this.penaltyToPayMember) return false;
    if (this.selectedPenaltyPaymentMethod === 'MANUAL' && !this.penaltyPaymentReferenceCode.trim()) return false;
    if (this.selectedPenaltyPaymentMethod === 'STK_PUSH' && !this.penaltyPaymentPhoneNumber.trim()) return false;
    return true;
  }

  submitMemberPenaltyPayment() {
    if (!this.penaltyToPayMember) return;

    if (this.selectedPenaltyPaymentMethod === 'MANUAL' && !this.penaltyPaymentReferenceCode.trim()) {
      this.toast.warning('Reference required', 'Please enter a payment reference number.');
      return;
    }
    if (this.selectedPenaltyPaymentMethod === 'STK_PUSH' && !this.penaltyPaymentPhoneNumber.trim()) {
      this.toast.warning('Phone required', 'Please enter the phone number for M-PESA.');
      return;
    }

    this.submittingPenaltyPayment.set(true);

    const request: InitiatePaymentRequest = {
      paymentType: 'PENALTY',
      referenceId: this.penaltyToPayMember.id,
      payerMemberId: this.penaltyToPayMember.memberId,
      paymentMethod: this.selectedPenaltyPaymentMethod,
      referenceCode: this.selectedPenaltyPaymentMethod === 'MANUAL' ? this.penaltyPaymentReferenceCode.trim() : undefined,
      phoneNumber: this.selectedPenaltyPaymentMethod === 'STK_PUSH' ? this.penaltyPaymentPhoneNumber.trim() : undefined
    };

    this.api.initiatePayment(request).subscribe({
      next: (response) => {
        this.submittingPenaltyPayment.set(false);
        this.penaltyPaymentResponse = response;

        if (response.awaitingVerification) {
          this.toast.success('Payment submitted', 'Your payment has been submitted and is awaiting admin verification.');
          this.closeMemberPenaltyPaymentModal();
          this.loadPenalties();
        } else if (response.status === 'STK_INITIATED') {
          this.toast.info('Check your phone', 'An M-PESA prompt has been sent. Complete the payment.');
        } else if (response.status === 'MATCHED') {
          this.toast.success('Payment confirmed!', 'Your penalty payment has been confirmed.');
          this.closeMemberPenaltyPaymentModal();
          this.loadPenalties();
        } else {
          this.toast.info('Payment processing', response.statusMessage);
        }
      },
      error: (err) => {
        this.submittingPenaltyPayment.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Failed to process payment.');
      }
    });
  }

  // Admin direct payment recording
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

  /**
   * Confirm a pending payment (admin action)
   */
  confirmPayment(payableId: number) {
    this.api.confirmPayment(payableId).subscribe({
      next: () => {
        this.toast.success('Payment confirmed', '');
        this.loadContributions();
        this.loadPenalties();
      },
      error: (err) => {
        this.toast.error('Failed to confirm', err.error?.message || 'Please try again.');
      }
    });
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
      case 'MEETING_LATE_ARRIVAL': return 'Late Arrival';
      case 'CONTRIBUTION_LATE_PAYMENT': return 'Late Payment';
      case 'LATE_PAYMENT': return 'Late Payment'; // Legacy support
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
      notes: '',
      targetMonth: this.selectedMonth, // Default to currently selected month
      description: ''
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

    if (!this.topUpFormData.targetMonth) {
      this.toast.warning('Month required', 'Please select the month for this top-up');
      return;
    }

    this.submittingTopUp.set(true);
    this.api.createContributionTopUp({
      contributionTypeId: this.topUpFormData.contributionTypeId,
      amount: this.topUpFormData.amount,
      paymentReference: this.topUpFormData.paymentReference || undefined,
      notes: this.topUpFormData.notes || undefined,
      targetMonth: this.topUpFormData.targetMonth,
      description: this.topUpFormData.description || undefined
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
