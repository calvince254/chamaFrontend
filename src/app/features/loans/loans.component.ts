import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LoanExtended, LoanProduct, Member, LoanPenalty } from '../../core/models/models';
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
  activeTab: 'my-loans' | 'pending' | 'all' | 'penalties' = 'my-loans';
  statusFilter = 'ALL';
  loading = signal(false);
  loadingPenalties = signal(false);
  saving = signal(false);
  
  // Loan application form
  showForm = false;
  editing: any = {};
  
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
    if (this.session.hasPermission('loans', 'approve')) {
      this.activeTab = 'all';
    } else {
      this.activeTab = 'my-loans';
    }
  }
  
  loadData() {
    this.loading.set(true);
    
    // Load data based on active tab
    if (this.activeTab === 'my-loans') {
      this.api.getMyLoans().subscribe({
        next: (loans) => {
          this.myLoans = loans;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          // Silently handle - interceptor shows toast
        }
      });
    } else if (this.activeTab === 'pending') {
      this.api.getPendingApprovals().subscribe({
        next: (loans) => {
          this.pendingApprovals = loans;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          // Silently handle - interceptor shows toast
        }
      });
    } else if (this.activeTab === 'all') {
      this.api.getLoansExtended().subscribe({
        next: (loans) => {
          this.allLoans = loans;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          // Silently handle - interceptor shows toast
        }
      });
    } else if (this.activeTab === 'penalties') {
      this.loadPenalties();
    }
  }

  loadPenalties() {
    this.loadingPenalties.set(true);
    const isAdmin = this.session.hasPermission('loans', 'approve');
    
    const request = isAdmin ? this.api.getLoanPenalties() : this.api.getMyLoanPenalties();
    request.subscribe({
      next: (penalties) => {
        this.loanPenalties = penalties;
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

  onTabChange(tab: 'my-loans' | 'pending' | 'all' | 'penalties') {
    this.activeTab = tab;
    this.statusFilter = 'ALL';
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

  get filteredLoans(): LoanExtended[] {
    const loans = this.currentLoans;
    if (this.statusFilter === 'ALL') return loans;
    return loans.filter(l => l.status === this.statusFilter);
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
    const isAdmin = this.session.hasPermission('loans', 'approve');
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
    if (this.editing.loanProductId) {
      const product = this.loanProducts.find(p => p.id === +this.editing.loanProductId);
      if (product) {
        this.editing.interestRate = product.interestRate;
        this.editing.termMonths = product.repaymentPeriod;
      }
    }
  }

  get selectedProduct(): LoanProduct | null {
    if (!this.editing.loanProductId) return null;
    return this.loanProducts.find(p => p.id === +this.editing.loanProductId) || null;
  }

  toggleGuarantor(memberId: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (!this.editing.guarantorIds) {
      this.editing.guarantorIds = [];
    }
    if (checked) {
      if (!this.editing.guarantorIds.includes(memberId)) {
        this.editing.guarantorIds.push(memberId);
      }
    } else {
      this.editing.guarantorIds = this.editing.guarantorIds.filter((id: number) => id !== memberId);
    }
  }

  closeForm() {
    this.showForm = false;
    this.editing = {};
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
    
    // Check guarantor requirements
    if (product && product.requiredGuarantors > 0) {
      const guarantorCount = this.editing.guarantorIds?.length || 0;
      if (guarantorCount < product.requiredGuarantors) {
        this.toast.warning('Guarantors required', `This loan product requires at least ${product.requiredGuarantors} guarantor(s). You selected ${guarantorCount}.`);
        return;
      }
    }
    
    // Validate guarantors don't include self
    if (this.editing.guarantorIds?.includes(this.editing.memberId)) {
      this.toast.warning('Invalid guarantor', 'You cannot be your own guarantor.');
      return;
    }

    const isAdmin = this.session.hasPermission('loans', 'approve');
    
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
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedLoan = null;
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
      this.api.approveLoanExtended(this.selectedLoan.id, this.approvalComments).subscribe({
        next: (loan) => {
          this.saving.set(false);
          this.closeApprovalModal();
          const message = loan.status === 'APPROVED' 
            ? 'Loan fully approved and ready for disbursement.'
            : `Loan approved at level ${loan.currentApprovalLevel}. Awaiting further approval.`;
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
    return (loan.status === 'PENDING' || loan.status === 'PENDING_APPROVAL') 
           && this.session.hasPermission('loans', 'approve');
  }

  canDisburse(loan: LoanExtended): boolean {
    return loan.status === 'APPROVED' && this.session.hasPermission('loans', 'approve');
  }

  canRecordPayment(loan: LoanExtended): boolean {
    return (loan.status === 'ACTIVE' || loan.status === 'OVERDUE') 
           && this.session.hasPermission('loans', 'edit');
  }

  isAdmin(): boolean {
    return this.session.hasPermission('loans', 'approve');
  }
}
