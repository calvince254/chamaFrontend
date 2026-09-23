import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { WelfareEvent, WelfareContribution, Member, PageResponse, ContributionBalance, InitiatePaymentRequest, InitiatePaymentResponse, EnabledPaymentMethods } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';

@Component({
  selector: 'app-welfare',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './welfare.component.html',
  styleUrl: './welfare.component.css',
})
export class WelfareComponent implements OnInit {
  events: WelfareEvent[] = [];
  members: Member[] = [];
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

  constructor(private api: ApiService, public session: SessionService, private toast: ToastService) {}

  ngOnInit() {
    // Only load data if user has permission to view welfare events
    if (this.session.can('VIEW_WELFARE_EVENTS') || this.session.can('CREATE_WELFARE_EVENT')) {
      this.loadEvents();
      this.loadMembers();
    }
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
      involvedMemberIds: []
    };
    this.showForm = true;
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
    this.showWelfarePaymentModal = true;
    this.loadWelfarePaymentMethods();
  }

  closeWelfarePaymentModal() {
    this.showWelfarePaymentModal = false;
    this.contributionToPay = null;
    this.welfarePaymentResponse = null;
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
    if (this.selectedWelfarePaymentMethod === 'MANUAL' && !this.welfarePaymentReferenceCode.trim()) return false;
    if (this.selectedWelfarePaymentMethod === 'STK_PUSH' && !this.welfarePaymentPhoneNumber.trim()) return false;
    return true;
  }

  submitWelfarePayment() {
    if (!this.contributionToPay) return;

    if (this.selectedWelfarePaymentMethod === 'MANUAL' && !this.welfarePaymentReferenceCode.trim()) {
      this.toast.warning('Reference required', 'Please enter a payment reference number.');
      return;
    }
    if (this.selectedWelfarePaymentMethod === 'STK_PUSH' && !this.welfarePaymentPhoneNumber.trim()) {
      this.toast.warning('Phone required', 'Please enter the phone number for M-PESA.');
      return;
    }

    this.submittingWelfarePayment.set(true);

    const balance = this.contributionToPay.amountExpected - (this.contributionToPay.amountPaid || 0);

    const request: InitiatePaymentRequest = {
      paymentType: 'WELFARE_DUE',
      referenceId: this.contributionToPay.id,
      payerMemberId: this.contributionToPay.memberId,
      amount: balance,
      paymentMethod: this.selectedWelfarePaymentMethod,
      referenceCode: this.selectedWelfarePaymentMethod === 'MANUAL' ? this.welfarePaymentReferenceCode.trim() : undefined,
      phoneNumber: this.selectedWelfarePaymentMethod === 'STK_PUSH' ? this.welfarePaymentPhoneNumber.trim() : undefined
    };

    this.api.initiatePayment(request).subscribe({
      next: (response) => {
        this.submittingWelfarePayment.set(false);
        this.welfarePaymentResponse = response;

        if (response.awaitingVerification) {
          this.toast.success('Payment submitted', 'Your welfare contribution has been submitted and is awaiting admin verification.');
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

  openPaymentMethodModal(contribution: WelfareContribution) {
    this.selectedContribution = contribution;
    this.selectedContributionTypeId = null;
    this.paymentMethod = 'CASH';
    this.contributionBalances = [];
    this.showFundPaymentModal = true;
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
  }

  loadContributionBalances(memberId: number) {
    this.loadingBalances.set(true);
    this.api.getMemberContributionBalances(memberId).subscribe({
      next: (balances) => {
        this.contributionBalances = balances;
        this.loadingBalances.set(false);
        // Auto-select first option with sufficient balance
        if (this.selectedContribution) {
          const sufficient = balances.find(b => b.balance >= this.selectedContribution!.amountExpected);
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
}
