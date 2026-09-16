import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LoanExtended, LoanProduct, Member, LoanPenalty, PageResponse, LoanEligibility, LoanIncomeSummary, LoanIncomeTransaction, LoanPayment } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './loans.component.html',
})
export class LoansComponent implements OnInit {
  // Data
  allLoans: LoanExtended[] = [];
  myLoans: LoanExtended[] = [];
  pendingApprovals: LoanExtended[] = [];
  loanProducts: LoanProduct[] = [];
  members: Member[] = [];
  loanPenalties: LoanPenalty[] = [];
  
  // UI state
  activeTab: 'my-loans' | 'pending' | 'all' | 'penalties' | 'income' | 'pending-payments' = 'my-loans';
  statusFilter = 'ALL';
  loading = signal(false);
  loadingPenalties = signal(false);
  saving = signal(false);

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;
  Math = Math;
  
  // Loan application form
  showForm = false;
  editing: any = {};
  eligibility: LoanEligibility | null = null;
  checkingEligibility = false;
  guarantorSearch = '';  // For filtering guarantor list
  
  // Loan detail view
  showDetailModal = false;
  selectedLoan: LoanExtended | null = null;
  
  // Approval modal
  showApprovalModal = false;
  approvalComments = '';
  approvalAction: 'approve' | 'reject' = 'approve';
  rejectionReason = '';
  
  // Repayment modal
  showRepaymentModal = false;
  repaymentAmount = 0;
  
  // Disbursement modal
  showDisbursementModal = false;
  
  // Loan income
  loanIncomeSummary: LoanIncomeSummary | null = null;
  loanIncomeTransactions: LoanIncomeTransaction[] = [];
  loadingIncome = signal(false);
  incomeCurrentPage = 0;
  incomePageSize = 20;
  incomeTotalElements = 0;
  incomeTotalPages = 0;
  
  // Payment verification
  pendingPayments: LoanPayment[] = [];
  loadingPayments = signal(false);
  showRecordPaymentModal = false;
  showRejectPaymentModal = false;
  selectedPayment: LoanPayment | null = null;
  paymentForm = {
    amount: 0,
    paymentMethod: '',
    transactionReference: '',
    notes: ''
  };
  
  // Loan payment history for details modal
  loanPaymentHistory: LoanPayment[] = [];
  loadingLoanPayments = signal(false);

  constructor(
    private api: ApiService, 
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}
  
  ngOnInit() {
    this.determineDefaultTab();
    this.loadData();
    this.loadMembers();
    this.loadLoanProducts();
  }

  determineDefaultTab() {
    // If user is admin, default to all loans
    if (this.session.can('VIEW_ALL_LOANS_ADMIN')) {
      this.activeTab = 'all';
    } else {
      this.activeTab = 'my-loans';
    }
  }
  
  loadData() {
    const status = this.statusFilter === 'ALL' ? undefined : this.statusFilter;
    
    // Load data based on active tab using paginated APIs
    if (this.activeTab === 'my-loans') {
      this.loading.set(true);
      this.api.getMyLoansPaginated(this.currentPage, this.pageSize, status).subscribe({
        next: (response: PageResponse<LoanExtended>) => {
          this.myLoans = response.content;
          this.updatePaginationState(response);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
        }
      });
    } else if (this.activeTab === 'pending') {
      this.loading.set(true);
      this.api.getLoansPaginated(this.currentPage, this.pageSize, 'PENDING_APPROVAL').subscribe({
        next: (response: PageResponse<LoanExtended>) => {
          this.pendingApprovals = response.content;
          this.updatePaginationState(response);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
        }
      });
    } else if (this.activeTab === 'all') {
      this.loading.set(true);
      this.api.getLoansPaginated(this.currentPage, this.pageSize, status).subscribe({
        next: (response: PageResponse<LoanExtended>) => {
          this.allLoans = response.content;
          this.updatePaginationState(response);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
        }
      });
    } else if (this.activeTab === 'penalties') {
      this.loadPenalties();
    } else if (this.activeTab === 'income') {
      this.loadLoanIncome();
    } else if (this.activeTab === 'pending-payments') {
      this.loadPendingPayments();
    }
  }

  loadPenalties() {
    this.loadingPenalties.set(true);
    const isAdmin = this.session.can('VIEW_ALL_LOANS_ADMIN');
    
    // Use non-paginated API for loan penalties (different from contribution penalties)
    const request = isAdmin ? this.api.getLoanPenalties() : this.api.getMyLoanPenalties();
    request.subscribe({
      next: (penalties) => {
        this.loanPenalties = penalties;
        // Reset pagination state for penalties since not paginated
        this.totalElements = penalties.length;
        this.totalPages = 1;
        this.isFirst = true;
        this.isLast = true;
        this.loadingPenalties.set(false);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadingPenalties.set(false);
        this.loading.set(false);
        if (err.status !== 403) {
          console.error('Failed to load penalties:', err);
        }
      }
    });
  }

  loadLoanIncome() {
    this.loadingIncome.set(true);
    
    // Load summary
    this.api.getLoanIncomeSummary().subscribe({
      next: (summary) => {
        this.loanIncomeSummary = summary;
      },
      error: (err) => {
        console.error('Failed to load income summary:', err);
      }
    });
    
    // Load transactions
    this.api.getLoanIncomeTransactions(this.incomeCurrentPage, this.incomePageSize).subscribe({
      next: (response) => {
        this.loanIncomeTransactions = response.content;
        this.incomeTotalElements = response.totalElements;
        this.incomeTotalPages = response.totalPages;
        this.loadingIncome.set(false);
      },
      error: (err) => {
        this.loadingIncome.set(false);
        console.error('Failed to load income transactions:', err);
      }
    });
  }
  
  incomeNextPage() {
    if (this.incomeCurrentPage < this.incomeTotalPages - 1) {
      this.incomeCurrentPage++;
      this.loadLoanIncome();
    }
  }
  
  incomePreviousPage() {
    if (this.incomeCurrentPage > 0) {
      this.incomeCurrentPage--;
      this.loadLoanIncome();
    }
  }

  // ==================== Payment Verification ====================
  
  loadPendingPayments() {
    this.loadingPayments.set(true);
    this.api.getPendingLoanPayments().subscribe({
      next: (payments) => {
        this.pendingPayments = payments;
        // Reset pagination state
        this.totalElements = payments.length;
        this.totalPages = 1;
        this.isFirst = true;
        this.isLast = true;
        this.loadingPayments.set(false);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadingPayments.set(false);
        this.loading.set(false);
        console.error('Failed to load pending payments:', err);
      }
    });
  }

  openRecordPaymentModal(loan: LoanExtended) {
    this.selectedLoan = loan;
    this.paymentForm = {
      amount: 0,
      paymentMethod: '',
      transactionReference: '',
      notes: ''
    };
    this.showRecordPaymentModal = true;
  }

  closeRecordPaymentModal() {
    this.showRecordPaymentModal = false;
    this.selectedLoan = null;
    this.paymentForm = {
      amount: 0,
      paymentMethod: '',
      transactionReference: '',
      notes: ''
    };
  }

  submitPayment() {
    if (!this.selectedLoan || !this.paymentForm.amount) {
      this.toast.error('Invalid payment', 'Please enter a valid payment amount.');
      return;
    }

    this.api.recordLoanPayment(this.selectedLoan.id, {
      amount: this.paymentForm.amount,
      paymentMethod: this.paymentForm.paymentMethod || undefined,
      transactionReference: this.paymentForm.transactionReference || undefined,
      notes: this.paymentForm.notes || undefined
    }).subscribe({
      next: () => {
        this.toast.success('Payment submitted', 'Your payment has been submitted for verification.');
        this.closeRecordPaymentModal();
        this.loadData();
      },
      error: (err) => {
        this.toast.error('Payment failed', err.error?.message || 'Failed to submit payment.');
      }
    });
  }

  verifyPayment(payment: LoanPayment) {
    this.confirmDialog.confirm({
      title: 'Verify Payment',
      message: `Are you sure you want to verify the payment of KES ${payment.amount.toLocaleString()} from ${payment.memberName}? This will apply the payment to their loan balance.`,
      confirmText: 'Verify',
      cancelText: 'Cancel',
      type: 'info'
    }).then(confirmed => {
      if (confirmed) {
        this.api.verifyLoanPayment(payment.id).subscribe({
          next: () => {
            this.toast.success('Payment verified', 'The payment has been verified and applied to the loan balance.');
            this.loadPendingPayments();
          },
          error: (err) => {
            this.toast.error('Verification failed', err.error?.message || 'Failed to verify payment.');
          }
        });
      }
    });
  }

  openRejectPaymentModal(payment: LoanPayment) {
    this.selectedPayment = payment;
    this.rejectionReason = '';
    this.showRejectPaymentModal = true;
  }

  closeRejectPaymentModal() {
    this.showRejectPaymentModal = false;
    this.selectedPayment = null;
    this.rejectionReason = '';
  }

  confirmRejectPayment() {
    if (!this.selectedPayment) return;

    if (!this.rejectionReason.trim()) {
      this.toast.error('Reason required', 'Please provide a reason for rejection.');
      return;
    }

    this.api.rejectLoanPayment(this.selectedPayment.id, this.rejectionReason).subscribe({
      next: () => {
        this.toast.success('Payment rejected', 'The payment has been rejected.');
        this.closeRejectPaymentModal();
        this.loadPendingPayments();
      },
      error: (err) => {
        this.toast.error('Rejection failed', err.error?.message || 'Failed to reject payment.');
      }
    });
  }

  updatePaginationState(response: PageResponse<any>) {
    this.totalElements = response.totalElements;
    this.totalPages = response.totalPages;
    this.isFirst = response.first;
    this.isLast = response.last;
  }

  onFilterChange() {
    this.currentPage = 0;
    this.loadData();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadData();
    }
  }

  previousPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadData();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadData();
    }
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (m) => this.members = m.filter(member => member.status === 'ACTIVE'),
      error: () => this.members = []
    });
  }

  loadLoanProducts() {
    this.api.getActiveLoanProducts().subscribe({
      next: (products) => this.loanProducts = products,
      error: () => {
        // Silently handle - interceptor shows toast
      }
    });
  }

  onTabChange(tab: 'my-loans' | 'pending' | 'all' | 'penalties' | 'income' | 'pending-payments') {
    this.activeTab = tab;
    this.statusFilter = 'ALL';
    this.currentPage = 0;
    this.loadData();
  }
  
  get currentLoans(): LoanExtended[] {
    switch (this.activeTab) {
      case 'my-loans': return this.myLoans;
      case 'pending': return this.pendingApprovals;
      case 'all': return this.allLoans;
      default: return [];
    }
  }

  // Stats
  get totalOutstanding(): number { 
    return this.allLoans.reduce((s, l) => s + (l.balanceOutstanding || 0), 0); 
  }
  get activeCount(): number { 
    return this.allLoans.filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE').length; 
  }
  get pendingCount(): number { 
    return this.allLoans.filter(l => l.status === 'PENDING' || l.status === 'PENDING_APPROVAL').length; 
  }
  get myPendingApprovalCount(): number {
    return this.pendingApprovals.length;
  }

  // ==================== Loan Application ====================
  openNewApplication() {
    const isAdmin = this.session.can('VIEW_ALL_LOANS_ADMIN');
    const currentUserId = this.session.currentUser()?.id;
    
    this.editing = {
      memberId: isAdmin ? null : currentUserId,
      loanProductId: null,
      principal: 0,
      interestRate: 10,
      termMonths: 12,
      purpose: '',
      guarantorIds: []
    };
    this.showForm = true;
  }

  onProductChange() {
    // Reset eligibility when product changes
    this.eligibility = null;
    
    if (this.editing.loanProductId) {
      const product = this.loanProducts.find(p => p.id === +this.editing.loanProductId);
      if (product) {
        this.editing.interestRate = product.interestRate;
        this.editing.termMonths = product.repaymentPeriod;
        // Check eligibility with new product
        this.checkEligibility();
      }
    }
  }

  get selectedProduct(): LoanProduct | null {
    if (!this.editing.loanProductId) return null;
    return this.loanProducts.find(p => p.id === +this.editing.loanProductId) || null;
  }

  // Filtered guarantor members (excluding applicant, with search)
  get filteredGuarantorMembers(): Member[] {
    const memberId = this.editing.memberId;
    let filtered = this.members.filter(m => m.id !== memberId);
    
    if (this.guarantorSearch && this.guarantorSearch.trim()) {
      const search = this.guarantorSearch.toLowerCase().trim();
      filtered = filtered.filter(m => m.name.toLowerCase().includes(search));
    }
    
    return filtered;
  }

  // Check if a guarantor checkbox should be disabled (max reached and not selected)
  isGuarantorDisabled(memberId: number): boolean {
    const product = this.selectedProduct;
    if (!product || product.requiredGuarantors <= 0) return false;
    
    const selected = this.editing.guarantorIds || [];
    const isSelected = selected.includes(memberId);
    
    // Disable if we've reached the exact count and this one is not selected
    return selected.length >= product.requiredGuarantors && !isSelected;
  }

  toggleGuarantor(memberId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (!this.editing.guarantorIds) {
      this.editing.guarantorIds = [];
    }
    
    const product = this.selectedProduct;
    const maxGuarantors = product?.requiredGuarantors || 0;
    
    if (checked) {
      // Enforce exact count - prevent selecting more than required
      if (maxGuarantors > 0 && this.editing.guarantorIds.length >= maxGuarantors) {
        // Revert the checkbox
        (event.target as HTMLInputElement).checked = false;
        this.toast.warning('Maximum reached', `This loan requires exactly ${maxGuarantors} guarantor(s). Deselect one to select another.`);
        return;
      }
      if (!this.editing.guarantorIds.includes(memberId)) {
        this.editing.guarantorIds.push(memberId);
      }
    } else {
      this.editing.guarantorIds = this.editing.guarantorIds.filter((id: number) => id !== memberId);
    }
    // Re-check eligibility when guarantors change
    this.checkEligibility();
  }

  closeForm() {
    this.showForm = false;
    this.editing = {};
    this.eligibility = null;
    this.guarantorSearch = '';
  }

  // Check loan eligibility based on contributions
  private eligibilityTimeout: any;
  
  checkEligibility() {
    const memberId = this.editing.memberId;
    const guarantorIds = this.editing.guarantorIds || [];
    const loanAmount = this.editing.principal || 0;

    // Only check eligibility when a loan product is selected
    if (!memberId || loanAmount <= 0 || !this.selectedProduct) {
      this.eligibility = null;
      return;
    }

    // Debounce the API call
    if (this.eligibilityTimeout) {
      clearTimeout(this.eligibilityTimeout);
    }
    
    this.eligibilityTimeout = setTimeout(() => {
      this.checkingEligibility = true;
      this.api.checkLoanEligibility(memberId, guarantorIds, loanAmount).subscribe({
        next: (result) => {
          this.eligibility = result;
          this.checkingEligibility = false;
        },
        error: (err) => {
          this.checkingEligibility = false;
          console.error('Error checking eligibility:', err);
        }
      });
    }, 500);
  }

  submitApplication() {
    if (!this.editing.memberId) {
      this.toast.warning('Missing field', 'Please select the loan applicant');
      return;
    }
    if (!this.editing.principal || this.editing.principal <= 0) {
      this.toast.warning('Missing field', 'Please enter a valid loan amount');
      return;
    }
    if (!this.editing.purpose) {
      this.toast.warning('Missing field', 'Please enter the loan purpose');
      return;
    }
    
    const product = this.selectedProduct;
    
    // Validate min/max amounts if product is selected
    if (product) {
      if (product.minAmount && this.editing.principal < product.minAmount) {
        this.toast.warning('Amount too low', `Minimum loan amount for ${product.name} is KES ${product.minAmount.toLocaleString()}`);
        return;
      }
      if (product.maxAmount && this.editing.principal > product.maxAmount) {
        this.toast.warning('Amount too high', `Maximum loan amount for ${product.name} is KES ${product.maxAmount.toLocaleString()}`);
        return;
      }
    }
    
    // Check guarantor requirements - EXACT count required
    if (product && product.requiredGuarantors > 0) {
      const guarantorCount = this.editing.guarantorIds?.length || 0;
      if (guarantorCount !== product.requiredGuarantors) {
        this.toast.warning('Guarantors required', `This loan product requires exactly ${product.requiredGuarantors} guarantor(s). You selected ${guarantorCount}.`);
        return;
      }
    }
    
    // Validate guarantors don't include self
    if (this.editing.guarantorIds?.includes(this.editing.memberId)) {
      this.toast.warning('Invalid guarantor', 'You cannot be your own guarantor.');
      return;
    }

    const isAdmin = this.session.can('VIEW_ALL_LOANS_ADMIN');
    
    this.saving.set(true);
    this.api.applyForLoanExtended(this.editing, isAdmin).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.toast.success('Application submitted', 'The loan application has been submitted for approval.');
        this.loadData();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Application failed', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Loan Details ====================
  viewLoanDetails(loan: LoanExtended) {
    this.selectedLoan = loan;
    this.showDetailModal = true;
    this.loanPaymentHistory = [];
    
    // Load payment history for active/cleared/overdue loans
    if (loan.status === 'ACTIVE' || loan.status === 'CLEARED' || loan.status === 'OVERDUE') {
      this.loadLoanPaymentHistory(loan.id);
    }
  }

  loadLoanPaymentHistory(loanId: number) {
    this.loadingLoanPayments.set(true);
    this.api.getLoanPayments(loanId).subscribe({
      next: (payments) => {
        this.loanPaymentHistory = payments;
        this.loadingLoanPayments.set(false);
      },
      error: (err) => {
        console.error('Failed to load payment history:', err);
        this.loadingLoanPayments.set(false);
      }
    });
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedLoan = null;
    this.loanPaymentHistory = [];
  }

  // ==================== Approval Workflow ====================
  openApprovalModal(loan: LoanExtended, action: 'approve' | 'reject') {
    this.selectedLoan = loan;
    this.approvalAction = action;
    this.approvalComments = '';
    this.rejectionReason = '';
    this.showApprovalModal = true;
  }

  closeApprovalModal() {
    this.showApprovalModal = false;
    this.selectedLoan = null;
    this.approvalComments = '';
    this.rejectionReason = '';
  }

  submitApproval() {
    if (!this.selectedLoan) return;
    
    if (this.approvalAction === 'reject' && !this.rejectionReason.trim()) {
      this.toast.warning('Reason required', 'Please provide a reason for rejection');
      return;
    }

    this.saving.set(true);
    
    if (this.approvalAction === 'approve') {
      // Call different endpoint based on approval type
      const approvalCall = this.selectedLoan.pendingApprovalType === 'GUARANTOR'
        ? this.api.approveAsGuarantor(this.selectedLoan.id, this.approvalComments)
        : this.api.approveLoanExtended(this.selectedLoan.id, this.approvalComments);
      
      approvalCall.subscribe({
        next: (loan) => {
          this.saving.set(false);
          this.closeApprovalModal();
          
          let message: string;
          if (loan.status === 'APPROVED') {
            message = 'Loan fully approved and ready for disbursement.';
          } else if (loan.status === 'PENDING_GUARANTORS') {
            message = `Approved as guarantor. ${loan.guarantorsApprovedCount}/${loan.requiredGuarantors} guarantors have approved.`;
          } else if (loan.status === 'PENDING' || loan.status === 'PENDING_APPROVAL') {
            message = `Loan approved at level ${loan.currentApprovalLevel}. Awaiting further approval.`;
          } else {
            message = 'Loan approved successfully.';
          }
          
          this.toast.success('Loan approved', message);
          this.loadData();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error('Approval failed', err.error?.message || 'Please try again.');
        }
      });
    } else {
      this.api.rejectLoanExtended(this.selectedLoan.id, this.rejectionReason).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeApprovalModal();
          this.toast.success('Loan rejected', 'The loan application has been rejected.');
          this.loadData();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error('Rejection failed', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  // ==================== Disbursement ====================
  openDisbursementModal(loan: LoanExtended) {
    this.selectedLoan = loan;
    this.showDisbursementModal = true;
  }

  closeDisbursementModal() {
    this.showDisbursementModal = false;
    this.selectedLoan = null;
  }

  async confirmDisbursement() {
    if (!this.selectedLoan) return;

    const confirmed = await this.confirmDialog.confirm({
      title: 'Disburse Loan?',
      message: `Disburse KES ${this.selectedLoan.principal?.toLocaleString()} to ${this.selectedLoan.memberName}? This will record the loan as active and create a disbursement transaction.`,
      confirmText: 'Disburse',
      type: 'warning'
    });

    if (confirmed) {
      this.saving.set(true);
      this.api.disburseLoanExtended(this.selectedLoan.id).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeDisbursementModal();
          this.toast.success('Loan disbursed', 'The loan has been disbursed and is now active.');
          this.loadData();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error('Disbursement failed', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  // ==================== Repayment ====================
  openRepaymentModal(loan: LoanExtended) {
    this.selectedLoan = loan;
    this.repaymentAmount = loan.monthlyPayment || 0;
    this.showRepaymentModal = true;
  }

  closeRepaymentModal() {
    this.showRepaymentModal = false;
    this.selectedLoan = null;
    this.repaymentAmount = 0;
  }

  submitRepayment() {
    if (!this.selectedLoan) return;
    
    if (!this.repaymentAmount || this.repaymentAmount <= 0) {
      this.toast.warning('Invalid amount', 'Please enter a valid repayment amount');
      return;
    }

    this.saving.set(true);
    this.api.recordLoanRepaymentExtended(this.selectedLoan.id, this.repaymentAmount).subscribe({
      next: (loan) => {
        this.saving.set(false);
        this.closeRepaymentModal();
        const message = loan.status === 'CLEARED' 
          ? 'Loan has been fully cleared!'
          : `Payment of KES ${this.repaymentAmount.toLocaleString()} recorded.`;
        this.toast.success('Payment recorded', message);
        this.loadData();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Penalties ====================
  async waivePenalty(penalty: LoanPenalty) {
    const reason = await this.confirmDialog.prompt({
      title: 'Waive Penalty',
      message: `Waive penalty of KES ${penalty.amount?.toLocaleString()}?`,
      inputLabel: 'Reason for waiving',
      inputPlaceholder: 'Enter reason...',
      confirmText: 'Waive',
      confirmClass: 'warning'
    });
    
    if (reason) {
      this.api.waiveLoanPenalty(penalty.id, reason).subscribe({
        next: () => {
          this.toast.success('Penalty waived', 'The penalty has been waived.');
          this.loadPenalties();
        },
        error: (err) => {
          this.toast.error('Failed to waive', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  // ==================== Helpers ====================
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'DRAFT':
      case 'PENDING':
      case 'PENDING_GUARANTORS':
      case 'PENDING_APPROVAL':
        return 'badge-neutral';
      case 'APPROVED':
        return 'badge-info';
      case 'ACTIVE':
        return 'badge-info';
      case 'OVERDUE':
        return 'badge-warning';
      case 'DEFAULTED':
      case 'REJECTED':
        return 'badge-danger';
      case 'CLEARED':
        return 'badge-success';
      default:
        return 'badge-neutral';
    }
  }

  getPenaltyStatusClass(status: string): string {
    switch (status) {
      case 'UNPAID': return 'badge-danger';
      case 'PARTIAL': return 'badge-warning';
      case 'PAID': return 'badge-success';
      case 'WAIVED': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  }

  canApprove(loan: LoanExtended): boolean {
    return (loan.status === 'PENDING' || loan.status === 'PENDING_GUARANTORS' || loan.status === 'PENDING_APPROVAL') 
           && this.session.can('APPROVE_LOAN');
  }

  canDisburse(loan: LoanExtended): boolean {
    return loan.status === 'APPROVED' && this.session.can('DISBURSE_LOAN');
  }

  canRecordPayment(loan: LoanExtended): boolean {
    return (loan.status === 'ACTIVE' || loan.status === 'OVERDUE') 
           && this.session.can('RECORD_LOAN_REPAYMENT');
  }

  isAdmin(): boolean {
    return this.session.can('VIEW_ALL_LOANS_ADMIN');
  }

  // Get selected guarantor names for the approval flow preview
  getSelectedGuarantorNames(): string[] {
    if (!this.editing.guarantorIds || this.editing.guarantorIds.length === 0) {
      return [];
    }
    return this.editing.guarantorIds
      .map((id: number) => this.members.find(m => m.id === id)?.name || 'Unknown')
      .filter((name: string) => name !== 'Unknown');
  }
}
