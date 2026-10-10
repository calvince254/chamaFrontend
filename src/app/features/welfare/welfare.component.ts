import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { WelfareEvent, WelfareContribution, Member, PageResponse, ContributionBalance, InitiatePaymentRequest, InitiatePaymentResponse, EnabledPaymentMethods, ContributionType } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import {
  StatusBadgeComponent,
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective,
  PaginationBarComponent
} from '../../shared/components';

@Component({
  selector: 'app-welfare',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IconComponent,
    StatusBadgeComponent, ListRowCardComponent,
    ListRowSecondaryDirective, ListRowFooterDirective, PaginationBarComponent
  ],
  templateUrl: './welfare.component.html',
  styleUrl: './welfare.component.css',
})
export class WelfareComponent implements OnInit {
  events: WelfareEvent[] = [];
  members: Member[] = [];
  contributionTypes: ContributionType[] = [];
  loading = signal(false);
  saving = signal(false);
  showForm = false;
  editing: any = {};

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;
  Math = Math;

  // Filter
  statusFilter = '';

  get hasFilters(): boolean {
    return !!this.statusFilter;
  }

  resetFilters() {
    this.statusFilter = '';
    this.onFilterChange();
  }

  // Payment tracking modal
  showPaymentsModal = false;
  selectedEvent: WelfareEvent | null = null;
  contributions: WelfareContribution[] = [];
  loadingContributions = signal(false);
  updatingPayment = signal(false);

  // Contributions modal pagination (backend)
  contributionPage = 0;
  contributionPageSize = 10;
  contributionTotalElements = 0;
  contributionTotalPages = 0;
  isContributionFirst = true;
  isContributionLast = true;

  // Member welfare payment modal
  showWelfarePaymentModal = false;
  contributionToPay: WelfareContribution | null = null;
  selectedWelfarePaymentMethod: 'MANUAL' | 'STK_PUSH' | 'IN_APP_SMS' = 'MANUAL';
  welfarePaymentReferenceCode = '';
  welfarePaymentPhoneNumber = '';
  submittingWelfarePayment = signal(false);
  welfarePaymentResponse: InitiatePaymentResponse | null = null;
  welfarePaymentMethods: EnabledPaymentMethods | null = null;
  loadingWelfarePaymentMethods = signal(false);
  
  // Funding source payment options
  useFundingSource = false;
  selectedFundingSourceId: number | null = null;
  fundingSourceBalances: { contributionTypeId: number; contributionTypeName: string; balance: number }[] = [];
  loadingFundingBalances = signal(false);
  amountFromFund = 0;

  constructor(private api: ApiService, public session: SessionService, private toast: ToastService) {}

  ngOnInit() {
    // Only load data if user has permission to view welfare events
    if (this.session.can('VIEW_WELFARE_EVENTS') || this.session.can('CREATE_WELFARE_EVENT')) {
      this.loadEvents();
      this.loadMembers();
      this.loadContributionTypes();
    }
  }

  loadContributionTypes() {
    this.api.getContributionTypes().subscribe({
      next: (types) => {
        // Only show active contribution types with WELFARE category
        this.contributionTypes = types.filter(t => t.active && t.category === 'WELFARE');
      },
      error: () => this.contributionTypes = []
    });
  }

  loadEvents() {
    this.loading.set(true);
    const status = this.statusFilter || undefined;
    this.api.getWelfareEventsPaginated(this.currentPage, this.pageSize, status).subscribe({
      next: (response: PageResponse<WelfareEvent>) => {
        this.events = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          console.error('Failed to load welfare events:', err);
        }
      }
    });
  }

  onFilterChange() {
    this.currentPage = 0;
    this.loadEvents();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadEvents();
    }
  }

  previousPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadEvents();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadEvents();
    }
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (m) => this.members = m,
      error: () => this.members = []
    });
  }

  progress(e: WelfareEvent) { 
    return e.totalExpected > 0 ? Math.round((e.totalCollected / e.totalExpected) * 100) : 0; 
  }

  paymentProgress(e: WelfareEvent) {
    return e.totalInvolved && e.totalInvolved > 0 ? Math.round(((e.paidCount || 0) / e.totalInvolved) * 100) : 0;
  }

  openNew() {
    this.editing = { 
      eventType: 'BEREAVEMENT',
      status: 'OPEN',
      dateReported: new Date().toISOString().split('T')[0],
      allMembersInvolved: true,
      involvedMemberIds: [],
      fundingContributionTypeIds: []
    };
    this.showForm = true;
  }

  // Funding source selection methods
  isFundingSourceSelected(typeId: number): boolean {
    return this.editing.fundingContributionTypeIds?.includes(typeId) || false;
  }

  toggleFundingSource(typeId: number) {
    if (!this.editing.fundingContributionTypeIds) {
      this.editing.fundingContributionTypeIds = [];
    }
    const idx = this.editing.fundingContributionTypeIds.indexOf(typeId);
    if (idx === -1) {
      this.editing.fundingContributionTypeIds.push(typeId);
    } else {
      this.editing.fundingContributionTypeIds.splice(idx, 1);
    }
  }

  toggleAllMembers() {
    if (this.editing.allMembersInvolved) {
      this.editing.involvedMemberIds = [];
    }
  }

  toggleMemberSelection(memberId: number) {
    if (!this.editing.involvedMemberIds) {
      this.editing.involvedMemberIds = [];
    }
    const idx = this.editing.involvedMemberIds.indexOf(memberId);
    if (idx === -1) {
      this.editing.involvedMemberIds.push(memberId);
    } else {
      this.editing.involvedMemberIds.splice(idx, 1);
    }
  }

  isMemberSelected(memberId: number): boolean {
    return this.editing.involvedMemberIds?.includes(memberId) || false;
  }

  save() {
    // Validate required fields
    if (!this.editing.memberId) {
      alert('Please select a beneficiary member');
      return;
    }
    if (!this.editing.eventType) {
      alert('Please select an event type');
      return;
    }
    if (!this.editing.amountPerMember || this.editing.amountPerMember <= 0) {
      alert('Please enter a valid amount per member');
      return;
    }

    // Validate member selection
    if (!this.editing.allMembersInvolved && (!this.editing.involvedMemberIds || this.editing.involvedMemberIds.length === 0)) {
      alert('Please select at least one member to contribute');
      return;
    }

    this.saving.set(true);
    this.api.createWelfareEvent(this.editing).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.loadEvents();
      },
      error: (err) => {
        this.saving.set(false);
        alert('Failed to create welfare event: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  close() {
    this.showForm = false;
  }

  // ==================== PAYMENT TRACKING ====================

  openPaymentsModal(event: WelfareEvent) {
    this.selectedEvent = event;
    this.showPaymentsModal = true;
    this.contributionPage = 0; // Reset pagination
    this.loadContributions(event.id);
  }

  closePaymentsModal() {
    this.showPaymentsModal = false;
    this.selectedEvent = null;
    this.contributions = [];
  }

  loadContributions(eventId: number) {
    this.loadingContributions.set(true);
    this.api.getWelfareContributionsPaginated(eventId, this.contributionPage, this.contributionPageSize).subscribe({
      next: (response) => {
        this.contributions = response.content;
        this.contributionTotalElements = response.totalElements;
        this.contributionTotalPages = response.totalPages;
        this.isContributionFirst = response.first;
        this.isContributionLast = response.last;
        this.loadingContributions.set(false);
      },
      error: (err) => {
        this.loadingContributions.set(false);
        console.error('Failed to load contributions:', err);
      }
    });
  }

  togglePayment(contribution: WelfareContribution) {
    if (!this.selectedEvent) return;
    
    this.updatingPayment.set(true);
    this.api.updateWelfareContributionPayment(this.selectedEvent.id, contribution.memberId, !contribution.paid).subscribe({
      next: (updated) => {
        // Update in list
        const idx = this.contributions.findIndex(c => c.id === updated.id);
        if (idx !== -1) {
          this.contributions[idx] = updated;
        }
        this.updatingPayment.set(false);
        // Refresh events list to update totals
        this.loadEvents();
      },
      error: (err) => {
        this.updatingPayment.set(false);
        alert('Failed to update payment: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  markAllPaid() {
    if (!this.selectedEvent) return;
    if (!confirm('Mark all members as paid for this welfare event?')) return;

    this.updatingPayment.set(true);
    this.api.markAllWelfareContributionsPaid(this.selectedEvent.id).subscribe({
      next: () => {
        this.updatingPayment.set(false);
        this.loadContributions(this.selectedEvent!.id);
        this.loadEvents();
      },
      error: (err) => {
        this.updatingPayment.set(false);
        alert('Failed to mark all as paid: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  get paidContributions(): WelfareContribution[] {
    return this.contributions.filter(c => c.paid);
  }

  get unpaidContributions(): WelfareContribution[] {
    return this.contributions.filter(c => !c.paid);
  }

  // Contribution pagination methods (backend pagination)
  contributionPreviousPage() {
    if (!this.isContributionFirst) {
      this.contributionPage--;
      if (this.selectedEvent) {
        this.loadContributions(this.selectedEvent.id);
      }
    }
  }

  contributionNextPage() {
    if (!this.isContributionLast) {
      this.contributionPage++;
      if (this.selectedEvent) {
        this.loadContributions(this.selectedEvent.id);
      }
    }
  }

  goToContributionPage(page: number) {
    if (page >= 0 && page < this.contributionTotalPages) {
      this.contributionPage = page;
      if (this.selectedEvent) {
        this.loadContributions(this.selectedEvent.id);
      }
    }
  }

  // ==================== MEMBER WELFARE PAYMENT (UNIFIED) ====================

  /**
   * Check if current user owns this contribution
   */
  isOwnContribution(contribution: WelfareContribution): boolean {
    const currentUser = this.session.currentUser();
    return currentUser ? contribution.memberId === currentUser.id : false;
  }

  /**
   * Check if contribution can be paid (not fully paid)
   */
  canPayContribution(contribution: WelfareContribution): boolean {
    return !contribution.paid && contribution.amountExpected > (contribution.amountPaid || 0);
  }

  /**
   * Open welfare payment modal (for member paying own contribution)
   */
  openWelfarePaymentModal(contribution: WelfareContribution) {
    this.contributionToPay = contribution;
    this.selectedWelfarePaymentMethod = 'MANUAL';
    this.welfarePaymentReferenceCode = '';
    this.welfarePaymentPhoneNumber = '';
    this.welfarePaymentResponse = null;
    // Reset funding source state
    this.useFundingSource = false;
    this.selectedFundingSourceId = null;
    this.fundingSourceBalances = [];
    this.amountFromFund = 0;
    
    this.showWelfarePaymentModal = true;
    this.loadWelfarePaymentMethods();
    this.loadFundingSourceBalances(contribution.memberId);
  }

  /**
   * Load member's balances in the welfare's funding source contribution types
   */
  loadFundingSourceBalances(memberId: number) {
    // Only load if the welfare event has funding sources
    if (!this.selectedEvent?.fundingSources || this.selectedEvent.fundingSources.length === 0) {
      this.fundingSourceBalances = [];
      return;
    }
    
    this.loadingFundingBalances.set(true);
    this.api.getMemberContributionBalances(memberId).subscribe({
      next: (balances) => {
        // Filter to only show balances for the welfare's funding sources
        const fundingTypeIds = this.selectedEvent!.fundingSources!.map(fs => fs.contributionTypeId);
        this.fundingSourceBalances = balances.filter(b => fundingTypeIds.includes(b.contributionTypeId));
        this.loadingFundingBalances.set(false);
      },
      error: () => {
        this.fundingSourceBalances = [];
        this.loadingFundingBalances.set(false);
      }
    });
  }

  /**
   * Get the selected funding source balance
   */
  getSelectedFundingBalance(): number {
    if (!this.selectedFundingSourceId) return 0;
    const source = this.fundingSourceBalances.find(b => b.contributionTypeId === this.selectedFundingSourceId);
    return source?.balance || 0;
  }

  /**
   * Get remaining amount to pay via cash/other method
   */
  getRemainingCashAmount(): number {
    if (!this.contributionToPay) return 0;
    const totalDue = this.contributionToPay.amountExpected - (this.contributionToPay.amountPaid || 0);
    if (!this.useFundingSource || !this.amountFromFund) return totalDue;
    return Math.max(0, totalDue - this.amountFromFund);
  }

  /**
   * When funding source is selected, auto-fill amount
   */
  onFundingSourceSelected() {
    if (this.selectedFundingSourceId && this.contributionToPay) {
      const balance = this.getSelectedFundingBalance();
      const totalDue = this.contributionToPay.amountExpected - (this.contributionToPay.amountPaid || 0);
      // Default to the minimum of balance and amount due
      this.amountFromFund = Math.min(balance, totalDue);
    } else {
      this.amountFromFund = 0;
    }
  }

  /**
   * Toggle using funding source
   */
  toggleUseFundingSource() {
    if (!this.useFundingSource) {
      this.selectedFundingSourceId = null;
      this.amountFromFund = 0;
    } else if (this.fundingSourceBalances.length === 1) {
      // Auto-select if only one funding source
      this.selectedFundingSourceId = this.fundingSourceBalances[0].contributionTypeId;
      this.onFundingSourceSelected();
    }
  }

  closeWelfarePaymentModal() {
    this.showWelfarePaymentModal = false;
    this.contributionToPay = null;
    this.welfarePaymentResponse = null;
    // Reset funding source state
    this.useFundingSource = false;
    this.selectedFundingSourceId = null;
    this.fundingSourceBalances = [];
    this.amountFromFund = 0;
  }

  loadWelfarePaymentMethods() {
    this.loadingWelfarePaymentMethods.set(true);
    this.api.getEnabledPaymentMethods().subscribe({
      next: (methods) => {
        this.welfarePaymentMethods = methods;
        if (methods.manualEnabled) {
          this.selectedWelfarePaymentMethod = 'MANUAL';
        } else if (methods.inAppSmsEnabled) {
          this.selectedWelfarePaymentMethod = 'IN_APP_SMS';
        } else if (methods.stkPushEnabled) {
          this.selectedWelfarePaymentMethod = 'STK_PUSH';
        }
        this.loadingWelfarePaymentMethods.set(false);
      },
      error: () => {
        this.loadingWelfarePaymentMethods.set(false);
      }
    });
  }

  canSubmitWelfarePayment(): boolean {
    if (!this.contributionToPay) return false;
    
    const totalDue = this.contributionToPay.amountExpected - (this.contributionToPay.amountPaid || 0);
    
    // If using funding source
    if (this.useFundingSource && this.selectedFundingSourceId && this.amountFromFund > 0) {
      // Check if amount from fund is valid
      const balance = this.getSelectedFundingBalance();
      if (this.amountFromFund > balance) return false;
      if (this.amountFromFund > totalDue) return false;
      
      // If fully paying from fund, no need for payment method
      if (this.amountFromFund >= totalDue) return true;
    }
    
    // If there's remaining cash amount, need payment method details
    const cashAmount = this.getRemainingCashAmount();
    if (cashAmount > 0) {
      if (this.selectedWelfarePaymentMethod === 'MANUAL' && !this.welfarePaymentReferenceCode.trim()) return false;
      if (this.selectedWelfarePaymentMethod === 'STK_PUSH' && !this.welfarePaymentPhoneNumber.trim()) return false;
    }
    
    return true;
  }

  submitWelfarePayment() {
    if (!this.contributionToPay || !this.selectedEvent) return;

    const totalDue = this.contributionToPay.amountExpected - (this.contributionToPay.amountPaid || 0);
    const cashAmount = this.getRemainingCashAmount();

    // Validate cash payment requirements
    if (cashAmount > 0) {
      if (this.selectedWelfarePaymentMethod === 'MANUAL' && !this.welfarePaymentReferenceCode.trim()) {
        this.toast.warning('Reference required', 'Please enter a payment reference number.');
        return;
      }
      if (this.selectedWelfarePaymentMethod === 'STK_PUSH' && !this.welfarePaymentPhoneNumber.trim()) {
        this.toast.warning('Phone required', 'Please enter the phone number for M-PESA.');
        return;
      }
    }

    this.submittingWelfarePayment.set(true);

    // If paying from fund
    if (this.useFundingSource && this.selectedFundingSourceId && this.amountFromFund > 0) {
      // First, pay from contribution fund
      this.api.payWelfareFromContributionFund(
        this.selectedEvent.id,
        this.contributionToPay.memberId,
        this.selectedFundingSourceId,
        this.amountFromFund
      ).subscribe({
        next: (updated) => {
          // Update in list
          const idx = this.contributions.findIndex(c => c.id === updated.id);
          if (idx !== -1) {
            this.contributions[idx] = updated;
          }

          // If there's remaining cash amount, proceed with cash payment
          if (cashAmount > 0) {
            this.submitCashPaymentPortion(cashAmount);
          } else {
            // Full payment from fund completed
            this.submittingWelfarePayment.set(false);
            this.toast.success('Payment complete', 'Welfare contribution paid from your contribution fund.');
            this.closeWelfarePaymentModal();
            this.loadContributions(this.selectedEvent!.id);
            this.loadEvents();
          }
        },
        error: (err) => {
          this.submittingWelfarePayment.set(false);
          this.toast.error('Payment failed', err.error?.message || 'Failed to process payment from fund.');
        }
      });
    } else {
      // Cash only payment
      this.submitCashPaymentPortion(totalDue);
    }
  }

  /**
   * Submit the cash portion of the payment
   */
  private submitCashPaymentPortion(amount: number) {
    if (!this.contributionToPay) return;

    const request: InitiatePaymentRequest = {
      paymentType: 'WELFARE_DUE',
      referenceId: this.contributionToPay.id,
      payerMemberId: this.contributionToPay.memberId,
      amount: amount,
      paymentMethod: this.selectedWelfarePaymentMethod,
      referenceCode: this.selectedWelfarePaymentMethod === 'MANUAL' ? this.welfarePaymentReferenceCode.trim() : undefined,
      phoneNumber: this.selectedWelfarePaymentMethod === 'STK_PUSH' ? this.welfarePaymentPhoneNumber.trim() : undefined
    };

    this.api.initiatePayment(request).subscribe({
      next: (response) => {
        this.submittingWelfarePayment.set(false);
        this.welfarePaymentResponse = response;

        if (response.awaitingVerification) {
          const fundMsg = this.useFundingSource && this.amountFromFund > 0 
            ? `KES ${this.amountFromFund.toLocaleString()} paid from fund. ` : '';
          this.toast.success('Payment submitted', fundMsg + 'Your cash payment is awaiting admin verification.');
          this.closeWelfarePaymentModal();
          if (this.selectedEvent) {
            this.loadContributions(this.selectedEvent.id);
          }
        } else if (response.status === 'STK_INITIATED') {
          this.toast.info('Check your phone', 'An M-PESA prompt has been sent. Complete the payment.');
        } else if (response.status === 'MATCHED') {
          this.toast.success('Payment confirmed!', 'Your welfare contribution payment has been confirmed.');
          this.closeWelfarePaymentModal();
          if (this.selectedEvent) {
            this.loadContributions(this.selectedEvent.id);
          }
          this.loadEvents();
        } else {
          this.toast.info('Payment processing', response.statusMessage);
        }
      },
      error: (err) => {
        this.submittingWelfarePayment.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Failed to process payment.');
      }
    });
  }

  // ==================== PAY FROM CONTRIBUTION FUND ====================
  showFundPaymentModal = false;
  selectedContribution: WelfareContribution | null = null;
  contributionBalances: ContributionBalance[] = [];
  loadingBalances = signal(false);
  selectedContributionTypeId: number | null = null;
  processingFundPayment = signal(false);
  paymentMethod: 'CASH' | 'CONTRIBUTION_FUND' = 'CASH';
  adminAmountFromFund = 0;

  // Disburse and Cancel state
  processingDisburse = signal(false);
  showCancelConfirm = false;
  cancelReason = '';

  openPaymentMethodModal(contribution: WelfareContribution) {
    this.selectedContribution = contribution;
    this.selectedContributionTypeId = null;
    this.paymentMethod = 'CASH';
    this.contributionBalances = [];
    this.adminAmountFromFund = 0;
    this.showFundPaymentModal = true;
  }

  /**
   * Get remaining amount to pay in cash for admin modal
   */
  getAdminRemainingCashAmount(): number {
    if (!this.selectedContribution) return 0;
    const totalDue = this.selectedContribution.amountExpected - (this.selectedContribution.amountPaid || 0);
    if (this.paymentMethod !== 'CONTRIBUTION_FUND' || !this.adminAmountFromFund) return totalDue;
    return Math.max(0, totalDue - this.adminAmountFromFund);
  }

  /**
   * Get max amount that can be used from contribution fund
   */
  getMaxAdminFundAmount(): number {
    if (!this.selectedContribution) return 0;
    const totalDue = this.selectedContribution.amountExpected - (this.selectedContribution.amountPaid || 0);
    const balance = this.getSelectedBalance()?.balance || 0;
    return Math.min(balance, totalDue);
  }

  /**
   * Clamp the admin fund amount to valid range
   */
  clampAdminFundAmount(): void {
    const max = this.getMaxAdminFundAmount();
    if (this.adminAmountFromFund > max) {
      this.adminAmountFromFund = max;
    }
    if (this.adminAmountFromFund < 0) {
      this.adminAmountFromFund = 0;
    }
  }

  /**
   * Check if admin can submit payment
   */
  canSubmitAdminPayment(): boolean {
    if (!this.selectedContribution) return false;
    
    const totalDue = this.selectedContribution.amountExpected - (this.selectedContribution.amountPaid || 0);
    
    // If using contribution fund
    if (this.paymentMethod === 'CONTRIBUTION_FUND') {
      if (!this.selectedContributionTypeId) return false;
      if (this.adminAmountFromFund <= 0) return false;
      
      // Check if amount from fund is valid
      const balance = this.getSelectedBalance();
      if (!balance || this.adminAmountFromFund > balance.balance) return false;
      if (this.adminAmountFromFund > totalDue) return false;
    }
    
    return true;
  }

  /**
   * Submit admin payment (hybrid: fund + cash)
   */
  submitAdminPayment() {
    if (!this.selectedEvent || !this.selectedContribution) return;

    const totalDue = this.selectedContribution.amountExpected - (this.selectedContribution.amountPaid || 0);
    const cashAmount = this.getAdminRemainingCashAmount();

    this.processingFundPayment.set(true);

    // If paying from fund
    if (this.paymentMethod === 'CONTRIBUTION_FUND' && this.selectedContributionTypeId && this.adminAmountFromFund > 0) {
      // First, pay from contribution fund
      this.api.payWelfareFromContributionFund(
        this.selectedEvent.id,
        this.selectedContribution.memberId,
        this.selectedContributionTypeId,
        this.adminAmountFromFund
      ).subscribe({
        next: (updated) => {
          // Update in list
          const idx = this.contributions.findIndex(c => c.id === updated.id);
          if (idx !== -1) {
            this.contributions[idx] = updated;
          }

          // If there's remaining cash amount, mark as paid
          if (cashAmount > 0) {
            this.markRemainingAsPaid();
          } else {
            // Full payment from fund completed
            this.processingFundPayment.set(false);
            this.toast.success('Payment complete', 'Welfare contribution paid from member\'s contribution fund.');
            this.closeFundPaymentModal();
            this.loadContributions(this.selectedEvent!.id);
            this.loadEvents();
          }
        },
        error: (err) => {
          this.processingFundPayment.set(false);
          this.toast.error('Payment failed', err.error?.message || 'Failed to process payment from fund.');
        }
      });
    } else {
      // Cash only payment - mark as fully paid
      this.confirmCashPayment();
    }
  }

  /**
   * Mark remaining amount as paid (cash portion after fund deduction)
   */
  private markRemainingAsPaid() {
    if (!this.selectedEvent || !this.selectedContribution) return;

    this.api.updateWelfareContributionPayment(this.selectedEvent.id, this.selectedContribution.memberId, true).subscribe({
      next: (updated) => {
        this.processingFundPayment.set(false);
        
        const idx = this.contributions.findIndex(c => c.id === updated.id);
        if (idx !== -1) {
          this.contributions[idx] = updated;
        }
        
        this.toast.success('Payment complete', `KES ${this.adminAmountFromFund.toLocaleString()} from fund + KES ${this.getAdminRemainingCashAmount().toLocaleString()} cash`);
        this.closeFundPaymentModal();
        this.loadContributions(this.selectedEvent!.id);
        this.loadEvents();
      },
      error: (err) => {
        this.processingFundPayment.set(false);
        this.toast.error('Failed', err.error?.message || 'Could not mark cash payment');
      }
    });
  }

  /**
   * Confirm a pending payment (admin action)
   */
  confirmPayment(payableId: number) {
    this.api.confirmPayment(payableId).subscribe({
      next: () => {
        this.toast.success('Payment confirmed', '');
        this.loadContributions(this.selectedEvent!.id);
      },
      error: (err) => {
        this.toast.error('Failed to confirm', err.error?.message || 'Please try again.');
      }
    });
  }

  openFundPaymentModal(contribution: WelfareContribution) {
    this.openPaymentMethodModal(contribution);
  }

  closeFundPaymentModal() {
    this.showFundPaymentModal = false;
    this.selectedContribution = null;
    this.contributionBalances = [];
    this.selectedContributionTypeId = null;
    this.paymentMethod = 'CASH';
    this.adminAmountFromFund = 0;
  }

  loadContributionBalances(memberId: number) {
    // Only load if the welfare event has funding sources
    if (!this.selectedEvent?.fundingSources || this.selectedEvent.fundingSources.length === 0) {
      this.contributionBalances = [];
      return;
    }
    
    this.loadingBalances.set(true);
    this.api.getMemberContributionBalances(memberId).subscribe({
      next: (balances) => {
        // Filter to only show balances for the welfare's funding sources
        const fundingTypeIds = this.selectedEvent!.fundingSources!.map(fs => fs.contributionTypeId);
        this.contributionBalances = balances.filter(b => fundingTypeIds.includes(b.contributionTypeId));
        this.loadingBalances.set(false);
        // Auto-select first option with sufficient balance
        if (this.selectedContribution) {
          const sufficient = this.contributionBalances.find(b => b.balance >= this.selectedContribution!.amountExpected);
          if (sufficient) {
            this.selectedContributionTypeId = sufficient.contributionTypeId;
          }
        }
      },
      error: (err) => {
        this.loadingBalances.set(false);
        console.error('Failed to load contribution balances:', err);
      }
    });
  }

  getSelectedBalance(): ContributionBalance | undefined {
    return this.contributionBalances.find(b => b.contributionTypeId === this.selectedContributionTypeId);
  }

  hasSufficientBalance(): boolean {
    if (!this.selectedContribution || !this.selectedContributionTypeId) return false;
    const balance = this.getSelectedBalance();
    return balance ? balance.balance >= this.selectedContribution.amountExpected : false;
  }

  submitFundPayment() {
    if (this.paymentMethod === 'CASH') {
      this.confirmCashPayment();
    } else {
      this.confirmFundPayment();
    }
  }

  confirmCashPayment() {
    if (!this.selectedEvent || !this.selectedContribution) return;

    this.processingFundPayment.set(true);
    this.api.updateWelfareContributionPayment(this.selectedEvent.id, this.selectedContribution.memberId, true).subscribe({
      next: (updated) => {
        this.processingFundPayment.set(false);
        this.closeFundPaymentModal();
        
        // Update in list
        const idx = this.contributions.findIndex(c => c.id === updated.id);
        if (idx !== -1) {
          this.contributions[idx] = updated;
        }
        
        this.toast.success('Payment recorded', 'Welfare payment marked as paid');
        this.loadEvents();
      },
      error: (err) => {
        this.processingFundPayment.set(false);
        this.toast.error('Failed', err.error?.message || 'Could not record payment');
      }
    });
  }

  confirmFundPayment() {
    if (!this.selectedEvent || !this.selectedContribution || !this.selectedContributionTypeId) return;
    if (!this.hasSufficientBalance()) {
      this.toast.warning('Insufficient balance', 'The selected contribution pool does not have enough funds');
      return;
    }

    this.processingFundPayment.set(true);
    this.api.payWelfareFromContributionFund(
      this.selectedEvent.id,
      this.selectedContribution.memberId,
      this.selectedContributionTypeId
    ).subscribe({
      next: (updated) => {
        this.processingFundPayment.set(false);
        this.closeFundPaymentModal();
        
        // Update the contribution in the list
        const idx = this.contributions.findIndex(c => c.id === updated.id);
        if (idx !== -1) {
          this.contributions[idx] = updated;
        }
        
        this.toast.success('Payment recorded', 'Welfare payment made from contribution savings');
        this.loadEvents(); // Refresh totals
      },
      error: (err) => {
        this.processingFundPayment.set(false);
        this.toast.error('Failed', err.error?.message || 'Could not process payment from contribution fund');
      }
    });
  }

  // ==================== DISBURSE & CANCEL ====================

  /**
   * Disburse collected welfare funds to the beneficiary
   */
  disburseWelfare() {
    if (!this.selectedEvent) return;
    
    this.processingDisburse.set(true);
    this.api.disburseWelfare(this.selectedEvent.id).subscribe({
      next: (updated) => {
        this.processingDisburse.set(false);
        
        // Update the event in the list
        const idx = this.events.findIndex(e => e.id === updated.id);
        if (idx !== -1) {
          this.events[idx] = updated;
        }
        this.selectedEvent = updated;
        
        this.toast.success('Disbursement complete', 
          `KES ${updated.totalCollected?.toLocaleString() || 0} disbursed to ${updated.memberName}`);
        this.loadEvents();
      },
      error: (err) => {
        this.processingDisburse.set(false);
        this.toast.error('Disbursement failed', err.error?.message || 'Could not disburse welfare funds');
      }
    });
  }

  /**
   * Cancel the welfare event and reverse all transactions
   */
  cancelWelfare() {
    if (!this.selectedEvent) return;
    
    this.processingDisburse.set(true);
    this.api.cancelWelfare(this.selectedEvent.id, this.cancelReason || undefined).subscribe({
      next: (updated) => {
        this.processingDisburse.set(false);
        this.showCancelConfirm = false;
        this.cancelReason = '';
        
        // Update the event in the list
        const idx = this.events.findIndex(e => e.id === updated.id);
        if (idx !== -1) {
          this.events[idx] = updated;
        }
        this.selectedEvent = updated;
        
        // Reload contributions to show reset state
        this.loadContributions(updated.id);
        
        this.toast.success('Event cancelled', 
          'Welfare event has been cancelled and all transactions reversed');
        this.loadEvents();
      },
      error: (err) => {
        this.processingDisburse.set(false);
        this.toast.error('Cancellation failed', err.error?.message || 'Could not cancel welfare event');
      }
    });
  }

  // ==================== MOBILE HELPERS ====================

  handleMobileEventAction(event: WelfareEvent): void {
    this.openPaymentsModal(event);
  }

  getMobileEventActionLabel(event: WelfareEvent): string {
    return 'Payments';
  }

  isMobileEventActionDisabled(event: WelfareEvent): boolean {
    return false;
  }

  getEventStatusForBadge(event: WelfareEvent): string {
    return event.status === 'CLOSED' ? 'paid' : 'pending';
  }
}
