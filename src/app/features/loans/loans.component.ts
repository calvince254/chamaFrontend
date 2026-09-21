import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LoanExtended, LoanProduct, Member, LoanPenalty, PageResponse, LoanEligibility, LoanIncomeSummary, LoanIncomeTransaction, LoanPayment, InitiatePaymentRequest, InitiatePaymentResponse, EnabledPaymentMethods, CreditScoreResponse } from '../../core/models/models';
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
  activeTab: 'my-loans' | 'pending' | 'all' | 'awaiting-confirmation' | 'awaiting-disbursement' | 'my-penalties' | 'penalties' | 'income' = 'my-loans';
  statusFilter = 'ALL';
  loading = signal(false);
  loadingPenalties = signal(false);
  saving = signal(false);
  
  // Awaiting confirmation loans (for admin)
  awaitingConfirmationLoans: LoanExtended[] = [];
  
  // Awaiting disbursement loans (APPROVED status)
  awaitingDisbursementLoans: LoanExtended[] = [];

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
  
  // Payment management
  showRecordPaymentModal = false;
  paymentForm = {
    amount: 0,
    paymentMethod: '',
    transactionReference: '',
    notes: ''
  };
  
  // Loan payment history for details modal
  loanPaymentHistory: LoanPayment[] = [];
  loadingLoanPayments = signal(false);
  
  // Loan penalty payment (member)
  showLoanPenaltyPaymentModal = false;
  penaltyToPay: LoanPenalty | null = null;
  selectedLoanPenaltyPaymentMethod: 'MANUAL' | 'STK_PUSH' | 'IN_APP_SMS' = 'MANUAL';
  loanPenaltyPaymentReferenceCode = '';
  loanPenaltyPaymentPhoneNumber = '';
  submittingLoanPenaltyPayment = signal(false);
  loanPenaltyPaymentResponse: InitiatePaymentResponse | null = null;
  loanPenaltyPaymentMethods: EnabledPaymentMethods | null = null;
  loadingLoanPenaltyPaymentMethods = signal(false);
  
  // Loan repayment (member unified payment)
  showLoanRepaymentPaymentModal = false;
  loanForRepayment: LoanExtended | null = null;
  selectedLoanRepaymentMethod: 'MANUAL' | 'STK_PUSH' | 'IN_APP_SMS' = 'MANUAL';
  loanRepaymentReferenceCode = '';
  loanRepaymentPhoneNumber = '';
  loanRepaymentAmount = 0;
  submittingLoanRepayment = signal(false);
  loanRepaymentResponse: InitiatePaymentResponse | null = null;
  loanRepaymentPaymentMethods: EnabledPaymentMethods | null = null;
  loadingLoanRepaymentMethods = signal(false);

  // Credit Score Info (displayed near Apply for Loan button)
  myCreditScore: CreditScoreResponse | null = null;
  loadingCreditScore = signal(false);
  showCreditScoreModal = false; // Modal for credit score info

  constructor(
    private api: ApiService, 
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}
  
  ngOnInit() {
    // Only load data if user has permission to view loans
    if (this.session.can('VIEW_LOANS') || this.session.can('VIEW_ALL_LOANS_ADMIN') || this.session.can('CREATE_LOAN')) {
      this.determineDefaultTab();
      this.loadData();
      this.loadMembers();
      this.loadLoanProducts();
    }
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
      // Use the dedicated endpoint that returns loans needing current user's approval
      // This includes loans where the user is a guarantor or an approver at the current level
      this.api.getPendingApprovals().subscribe({
        next: (loans: LoanExtended[]) => {
          this.pendingApprovals = loans;
          // Update pagination state manually since this endpoint isn't paginated
          this.totalElements = loans.length;
          this.totalPages = 1;
          this.isFirst = true;
          this.isLast = true;
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
    } else if (this.activeTab === 'awaiting-confirmation') {
      this.loading.set(true);
      // Filter all loans to only those with hasPendingClaim = true
      this.api.getLoansPaginated(0, 100, 'ACTIVE').subscribe({
        next: (response: PageResponse<LoanExtended>) => {
          // Filter to only loans with pending claims
          this.awaitingConfirmationLoans = response.content.filter(l => l.hasPendingClaim);
          this.totalElements = this.awaitingConfirmationLoans.length;
          this.totalPages = 1;
          this.isFirst = true;
          this.isLast = true;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
        }
      });
    } else if (this.activeTab === 'awaiting-disbursement') {
      this.loading.set(true);
      // Filter to APPROVED loans awaiting disbursement
      this.api.getLoansPaginated(0, 100, 'APPROVED').subscribe({
        next: (response: PageResponse<LoanExtended>) => {
          this.awaitingDisbursementLoans = response.content;
          this.totalElements = this.awaitingDisbursementLoans.length;
          this.totalPages = 1;
          this.isFirst = true;
          this.isLast = true;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
        }
      });
    } else if (this.activeTab === 'penalties' || this.activeTab === 'my-penalties') {
      this.loadPenalties();
    } else if (this.activeTab === 'income') {
      this.loadLoanIncome();
    }
  }

  loadPenalties() {
    this.loadingPenalties.set(true);
    
    // Use 'my-penalties' tab for current user's penalties, 'penalties' tab for all penalties
    const loadMyPenalties = this.activeTab === 'my-penalties';
    const request = loadMyPenalties ? this.api.getMyLoanPenalties() : this.api.getLoanPenalties();
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

  // ==================== Payment Management ====================
  
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

    // Validate amount doesn't exceed balance
    const balance = this.selectedLoan.balanceOutstanding || 0;
    if (this.paymentForm.amount > balance) {
      this.toast.error('Invalid amount', `Payment amount cannot exceed outstanding balance of KES ${balance.toLocaleString()}`);
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

  loadMyCreditScore() {
    this.loadingCreditScore.set(true);
    this.api.getMyCreditScore().subscribe({
      next: (response) => {
        this.myCreditScore = response;
        this.loadingCreditScore.set(false);
      },
      error: () => {
        this.loadingCreditScore.set(false);
        // Silently handle - user may not have loans yet
      }
    });
  }

  openCreditScoreModal() {
    this.showCreditScoreModal = true;
    // Reload credit score when opening modal
    this.loadMyCreditScore();
  }

  closeCreditScoreModal() {
    this.showCreditScoreModal = false;
  }

  onTabChange(tab: 'my-loans' | 'pending' | 'all' | 'awaiting-confirmation' | 'awaiting-disbursement' | 'my-penalties' | 'penalties' | 'income') {
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
      case 'awaiting-confirmation': return this.awaitingConfirmationLoans;
      case 'awaiting-disbursement': return this.awaitingDisbursementLoans;
      default: return [];
    }
  }
  
  get awaitingConfirmationCount(): number {
    return this.awaitingConfirmationLoans.length;
  }
  
  get awaitingDisbursementCount(): number {
    return this.awaitingDisbursementLoans.length;
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
      // Determine if rejecting as guarantor based on pending approval type
      const asGuarantor = this.selectedLoan.pendingApprovalType === 'GUARANTOR';
      this.api.rejectLoanExtended(this.selectedLoan.id, this.rejectionReason, asGuarantor).subscribe({
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
  
  /**
   * Check if current user owns this loan penalty
   */
  isOwnLoanPenalty(penalty: LoanPenalty): boolean {
    const currentUser = this.session.currentUser();
    return currentUser ? penalty.memberId === currentUser.id : false;
  }

  /**
   * Check if penalty can be paid (not PAID or WAIVED)
   */
  canPayLoanPenalty(penalty: LoanPenalty): boolean {
    return penalty.status !== 'PAID' && penalty.status !== 'WAIVED';
  }

  /**
   * Open loan penalty payment modal (for member paying own penalty)
   */
  openLoanPenaltyPaymentModal(penalty: LoanPenalty) {
    this.penaltyToPay = penalty;
    this.selectedLoanPenaltyPaymentMethod = 'MANUAL';
    this.loanPenaltyPaymentReferenceCode = '';
    this.loanPenaltyPaymentPhoneNumber = '';
    this.loanPenaltyPaymentResponse = null;
    this.showLoanPenaltyPaymentModal = true;
    this.loadLoanPenaltyPaymentMethods();
  }

  closeLoanPenaltyPaymentModal() {
    this.showLoanPenaltyPaymentModal = false;
    this.penaltyToPay = null;
    this.loanPenaltyPaymentResponse = null;
  }

  loadLoanPenaltyPaymentMethods() {
    this.loadingLoanPenaltyPaymentMethods.set(true);
    this.api.getEnabledPaymentMethods().subscribe({
      next: (methods) => {
        this.loanPenaltyPaymentMethods = methods;
        if (methods.manualEnabled) {
          this.selectedLoanPenaltyPaymentMethod = 'MANUAL';
        } else if (methods.inAppSmsEnabled) {
          this.selectedLoanPenaltyPaymentMethod = 'IN_APP_SMS';
        } else if (methods.stkPushEnabled) {
          this.selectedLoanPenaltyPaymentMethod = 'STK_PUSH';
        }
        this.loadingLoanPenaltyPaymentMethods.set(false);
      },
      error: () => {
        this.loadingLoanPenaltyPaymentMethods.set(false);
      }
    });
  }

  canSubmitLoanPenaltyPayment(): boolean {
    if (!this.penaltyToPay) return false;
    if (this.selectedLoanPenaltyPaymentMethod === 'MANUAL' && !this.loanPenaltyPaymentReferenceCode.trim()) return false;
    if (this.selectedLoanPenaltyPaymentMethod === 'STK_PUSH' && !this.loanPenaltyPaymentPhoneNumber.trim()) return false;
    return true;
  }

  submitLoanPenaltyPayment() {
    if (!this.penaltyToPay) return;

    if (this.selectedLoanPenaltyPaymentMethod === 'MANUAL' && !this.loanPenaltyPaymentReferenceCode.trim()) {
      this.toast.warning('Reference required', 'Please enter a payment reference number.');
      return;
    }
    if (this.selectedLoanPenaltyPaymentMethod === 'STK_PUSH' && !this.loanPenaltyPaymentPhoneNumber.trim()) {
      this.toast.warning('Phone required', 'Please enter the phone number for M-PESA.');
      return;
    }

    this.submittingLoanPenaltyPayment.set(true);

    const request: InitiatePaymentRequest = {
      paymentType: 'LOAN_PENALTY',
      referenceId: this.penaltyToPay.id,
      payerMemberId: this.penaltyToPay.memberId,
      paymentMethod: this.selectedLoanPenaltyPaymentMethod,
      referenceCode: this.selectedLoanPenaltyPaymentMethod === 'MANUAL' ? this.loanPenaltyPaymentReferenceCode.trim() : undefined,
      phoneNumber: this.selectedLoanPenaltyPaymentMethod === 'STK_PUSH' ? this.loanPenaltyPaymentPhoneNumber.trim() : undefined
    };

    this.api.initiatePayment(request).subscribe({
      next: (response) => {
        this.submittingLoanPenaltyPayment.set(false);
        this.loanPenaltyPaymentResponse = response;

        if (response.awaitingVerification) {
          this.toast.success('Payment submitted', 'Your payment has been submitted and is awaiting admin verification.');
          this.closeLoanPenaltyPaymentModal();
          this.loadPenalties();
        } else if (response.status === 'STK_INITIATED') {
          this.toast.info('Check your phone', 'An M-PESA prompt has been sent. Complete the payment.');
        } else if (response.status === 'MATCHED') {
          this.toast.success('Payment confirmed!', 'Your loan penalty payment has been confirmed.');
          this.closeLoanPenaltyPaymentModal();
          this.loadPenalties();
        } else {
          this.toast.info('Payment processing', response.statusMessage);
        }
      },
      error: (err) => {
        this.submittingLoanPenaltyPayment.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Failed to process payment.');
      }
    });
  }

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

  /**
   * Confirm a pending payment (admin action)
   */
  confirmPayment(payableId: number) {
    this.api.confirmPayment(payableId).subscribe({
      next: () => {
        this.toast.success('Payment confirmed', '');
        this.loadData();
        this.loadPenalties();
      },
      error: (err) => {
        this.toast.error('Failed to confirm', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Loan Repayment (Member Payment) ====================

  /**
   * Check if current user owns this loan
   */
  isOwnLoan(loan: LoanExtended): boolean {
    const currentUser = this.session.currentUser();
    return currentUser ? loan.memberId === currentUser.id : false;
  }

  /**
   * Check if loan can receive repayment (ACTIVE or OVERDUE)
   */
  canPayLoan(loan: LoanExtended): boolean {
    return (loan.status === 'ACTIVE' || loan.status === 'OVERDUE') && 
           (loan.balanceOutstanding || 0) > 0;
  }

  /**
   * Open loan repayment modal (for member paying own loan)
   */
  openLoanRepaymentPaymentModal(loan: LoanExtended) {
    this.loanForRepayment = loan;
    this.selectedLoanRepaymentMethod = 'MANUAL';
    this.loanRepaymentReferenceCode = '';
    this.loanRepaymentPhoneNumber = '';
    this.loanRepaymentAmount = loan.monthlyPayment || 0;
    this.loanRepaymentResponse = null;
    this.showLoanRepaymentPaymentModal = true;
    this.loadLoanRepaymentMethods();
  }

  closeLoanRepaymentPaymentModal() {
    this.showLoanRepaymentPaymentModal = false;
    this.loanForRepayment = null;
    this.loanRepaymentResponse = null;
  }

  loadLoanRepaymentMethods() {
    this.loadingLoanRepaymentMethods.set(true);
    this.api.getEnabledPaymentMethods().subscribe({
      next: (methods) => {
        this.loanRepaymentPaymentMethods = methods;
        if (methods.manualEnabled) {
          this.selectedLoanRepaymentMethod = 'MANUAL';
        } else if (methods.inAppSmsEnabled) {
          this.selectedLoanRepaymentMethod = 'IN_APP_SMS';
        } else if (methods.stkPushEnabled) {
          this.selectedLoanRepaymentMethod = 'STK_PUSH';
        }
        this.loadingLoanRepaymentMethods.set(false);
      },
      error: () => {
        this.loadingLoanRepaymentMethods.set(false);
      }
    });
  }

  canSubmitLoanRepayment(): boolean {
    if (!this.loanForRepayment || !this.loanRepaymentAmount) return false;
    // Don't allow payment more than outstanding balance
    if (this.loanRepaymentAmount > (this.loanForRepayment.balanceOutstanding || 0)) return false;
    if (this.selectedLoanRepaymentMethod === 'MANUAL' && !this.loanRepaymentReferenceCode.trim()) return false;
    if (this.selectedLoanRepaymentMethod === 'STK_PUSH' && !this.loanRepaymentPhoneNumber.trim()) return false;
    return true;
  }

  submitLoanRepayment() {
    if (!this.loanForRepayment || !this.loanRepaymentAmount) return;

    // Validate amount doesn't exceed balance
    const balance = this.loanForRepayment.balanceOutstanding || 0;
    if (this.loanRepaymentAmount > balance) {
      this.toast.error('Invalid amount', `Payment amount cannot exceed outstanding balance of KES ${balance.toLocaleString()}`);
      return;
    }

    if (this.selectedLoanRepaymentMethod === 'MANUAL' && !this.loanRepaymentReferenceCode.trim()) {
      this.toast.warning('Reference required', 'Please enter a payment reference number.');
      return;
    }
    if (this.selectedLoanRepaymentMethod === 'STK_PUSH' && !this.loanRepaymentPhoneNumber.trim()) {
      this.toast.warning('Phone required', 'Please enter the phone number for M-PESA.');
      return;
    }

    this.submittingLoanRepayment.set(true);

    const request: InitiatePaymentRequest = {
      paymentType: 'LOAN_REPAYMENT',
      referenceId: this.loanForRepayment.id,
      payerMemberId: this.loanForRepayment.memberId,
      amount: this.loanRepaymentAmount,
      paymentMethod: this.selectedLoanRepaymentMethod,
      referenceCode: this.selectedLoanRepaymentMethod === 'MANUAL' ? this.loanRepaymentReferenceCode.trim() : undefined,
      phoneNumber: this.selectedLoanRepaymentMethod === 'STK_PUSH' ? this.loanRepaymentPhoneNumber.trim() : undefined
    };

    this.api.initiatePayment(request).subscribe({
      next: (response) => {
        this.submittingLoanRepayment.set(false);
        this.loanRepaymentResponse = response;

        if (response.awaitingVerification) {
          this.toast.success('Payment submitted', 'Your loan repayment has been submitted and is awaiting admin verification.');
          this.closeLoanRepaymentPaymentModal();
          this.loadData();
        } else if (response.status === 'STK_INITIATED') {
          this.toast.info('Check your phone', 'An M-PESA prompt has been sent. Complete the payment.');
        } else if (response.status === 'MATCHED') {
          this.toast.success('Payment confirmed!', 'Your loan repayment has been confirmed.');
          this.closeLoanRepaymentPaymentModal();
          this.loadData();
        } else {
          this.toast.info('Payment processing', response.statusMessage);
        }
      },
      error: (err) => {
        this.submittingLoanRepayment.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Failed to process payment.');
      }
    });
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

  // Credit Score Helpers
  getCreditScoreBackground(color: string): string {
    const backgrounds: Record<string, string> = {
      'green': '#dcfce7',
      'blue': '#dbeafe',
      'yellow': '#fef3c7',
      'orange': '#fed7aa',
      'red': '#fee2e2',
      'gray': '#f3f4f6'
    };
    return backgrounds[color] || '#f3f4f6';
  }

  getCreditScoreColor(color: string): string {
    const colors: Record<string, string> = {
      'green': '#16a34a',
      'blue': '#2563eb',
      'yellow': '#ca8a04',
      'orange': '#ea580c',
      'red': '#dc2626',
      'gray': '#6b7280'
    };
    return colors[color] || '#6b7280';
  }

  getCreditRatingLabel(rating: string): string {
    const labels: Record<string, string> = {
      'EXCELLENT': 'Excellent',
      'GOOD': 'Good',
      'FAIR': 'Fair',
      'POOR': 'Poor',
      'VERY_POOR': 'Very Poor',
      'NO_HISTORY': 'No History'
    };
    return labels[rating] || rating;
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
    // Only show approve/reject buttons in the Pending Approvals tab
    // This prevents admin from seeing approve buttons in the "All Loans" view
    if (this.activeTab !== 'pending') {
      return false;
    }
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
