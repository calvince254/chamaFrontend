import { Component, OnInit, signal, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { 
  ShareCalculation, MemberShare, Liquidity, Payout, PayoutPreview, 
  CreatePayoutRequest, PayoutPreviewRequest, Member, PageResponse, GuarantorLiability 
} from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { ToastService } from '../../shared/toast.service';
import {
  StatStripComponent,
  StatChipComponent,
  StatusBadgeComponent,
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective,
  PaginationBarComponent,
  LabelValueComponent
} from '../../shared/components';

@Component({
  selector: 'app-shares',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, IconComponent,
    StatStripComponent, StatChipComponent, StatusBadgeComponent, ListRowCardComponent,
    ListRowSecondaryDirective, ListRowFooterDirective, PaginationBarComponent,
    LabelValueComponent
  ],
  templateUrl: './shares.component.html',
  styleUrl: './shares.component.css',
})
export class SharesComponent implements OnInit {
  // Tab management
  activeTab: 'ownership' | 'payouts' = 'ownership';

  // Member Ownership tab
  calculation: ShareCalculation | null = null;
  loading = signal(false);
  error = signal<string | null>(null);
  showInfoModal = false;

  // Member Ownership pagination
  paginatedMemberShares: MemberShare[] = [];
  sharePage = 0;
  sharePageSize = 10;
  shareTotalElements = 0;
  shareTotalPages = 0;
  shareIsFirst = true;
  shareIsLast = true;

  // Payouts tab
  liquidity: Liquidity | null = null;
  payouts: Payout[] = [];
  loadingPayouts = signal(false);
  loadingLiquidity = signal(false);

  // Payout pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;
  statusFilter = 'ALL';
  Math = Math;

  // Payout modals
  showNewPayoutModal = false;
  showPayoutDetailModal = false;
  selectedPayout: Payout | null = null;

  // New payout form
  newPayoutType: 'FULL_DISTRIBUTION' | 'PARTIAL_DIVIDEND' | 'INDIVIDUAL_WITHDRAWAL' = 'PARTIAL_DIVIDEND';
  newPayoutAmount: number | null = null;
  newPayoutDescription = '';
  newPayoutMemberId: number | null = null;
  payoutPreview: PayoutPreview | null = null;
  loadingPreview = signal(false);
  creatingPayout = signal(false);
  
  // Distribution options for partial/full
  useOwnershipDistribution = true; // Default to ownership-based
  distributionPercentage = 100; // Percentage of each member's value to distribute

  // Members for individual withdrawal
  members: Member[] = [];
  
  // Guarantor liabilities for selected member
  guarantorLiabilities: GuarantorLiability[] = [];
  totalGuarantorLiability = 0;

  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  constructor(private api: ApiService, public session: SessionService) {}

  ngOnInit() {
    // Only make API calls in browser (not during SSR)
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // Always attempt to load if user is logged in - let backend handle permissions
    if (this.session.isLoggedIn()) {
      this.loadShareCalculation();
    }
  }

  onTabChange(tab: 'ownership' | 'payouts') {
    this.activeTab = tab;
    if (tab === 'payouts') {
      this.loadPayoutsData();
      // Also load share calculation for member share info in individual withdrawals
      if (!this.calculation) {
        this.loadShareCalculation();
      }
    }
  }

  // ==================== MEMBER OWNERSHIP TAB ====================

  loadShareCalculation() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getShareCalculation().subscribe({
      next: (calc) => {
        this.calculation = calc;
        this.loading.set(false);
        // Load paginated member shares
        this.loadMemberSharesPaginated();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.error.set('You do not have permission to view shares.');
        } else {
          this.error.set('Failed to load share calculation.');
          console.error('Failed to load share calculation:', err);
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadMemberSharesPaginated() {
    this.api.getMemberSharesPaginated(this.sharePage, this.sharePageSize).subscribe({
      next: (response) => {
        this.paginatedMemberShares = response.content;
        this.shareTotalElements = response.totalElements;
        this.shareTotalPages = response.totalPages;
        this.shareIsFirst = response.first;
        this.shareIsLast = response.last;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load paginated member shares:', err);
        this.cdr.detectChanges();
      }
    });
  }

  get memberShares(): MemberShare[] {
    return this.calculation?.memberShares || [];
  }

  get isConfigured(): boolean {
    return this.calculation?.isConfigured ?? false;
  }

  get totalPoolValue(): number {
    return this.calculation?.totalPoolValue ?? 0;
  }

  get totalShareContributions(): number {
    return this.calculation?.totalShareContributions ?? 0;
  }

  // Member Ownership pagination methods
  shareGoToPage(page: number) {
    if (page >= 0 && page < this.shareTotalPages) {
      this.sharePage = page;
      this.loadMemberSharesPaginated();
    }
  }

  sharePreviousPage() {
    if (!this.shareIsFirst) {
      this.sharePage--;
      this.loadMemberSharesPaginated();
    }
  }

  shareNextPage() {
    if (!this.shareIsLast) {
      this.sharePage++;
      this.loadMemberSharesPaginated();
    }
  }

  refresh() {
    if (this.activeTab === 'ownership') {
      this.sharePage = 0; // Reset to first page on refresh
      this.loadShareCalculation();
    } else {
      this.loadPayoutsData();
    }
  }

  // ==================== PAYOUTS TAB ====================

  loadPayoutsData() {
    this.loadLiquidity();
    this.loadPayouts();
    this.loadMembers();
  }

  loadLiquidity() {
    this.loadingLiquidity.set(true);
    this.api.getLiquidity().subscribe({
      next: (liq) => {
        this.liquidity = liq;
        this.loadingLiquidity.set(false);
      },
      error: (err) => {
        this.loadingLiquidity.set(false);
        console.error('Failed to load liquidity:', err);
      }
    });
  }

  loadPayouts() {
    this.loadingPayouts.set(true);
    const status = this.statusFilter === 'ALL' ? undefined : this.statusFilter;
    this.api.getPayoutsPaginated(this.currentPage, this.pageSize, status).subscribe({
      next: (response: PageResponse<Payout>) => {
        this.payouts = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loadingPayouts.set(false);
      },
      error: (err) => {
        this.loadingPayouts.set(false);
        console.error('Failed to load payouts:', err);
      }
    });
  }

  onFilterChange() {
    this.currentPage = 0;
    this.loadPayouts();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadPayouts();
    }
  }

  previousPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadPayouts();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadPayouts();
    }
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (members: Member[]) => this.members = members.filter(m => m.status === 'ACTIVE'),
      error: () => this.members = []
    });
  }

  // ==================== NEW PAYOUT MODAL ====================

  openNewPayoutModal() {
    this.showNewPayoutModal = true;
    this.newPayoutType = 'PARTIAL_DIVIDEND';
    this.newPayoutAmount = null;
    this.newPayoutDescription = '';
    this.newPayoutMemberId = null;
    this.payoutPreview = null;
    this.useOwnershipDistribution = true;
    this.distributionPercentage = 100;
    this.updateCalculatedAmount();
  }

  closeNewPayoutModal() {
    this.showNewPayoutModal = false;
    this.payoutPreview = null;
  }

  onPayoutTypeChange() {
    this.payoutPreview = null;
    if (this.newPayoutType === 'INDIVIDUAL_WITHDRAWAL') {
      this.newPayoutMemberId = null;
      this.newPayoutAmount = 0;
      this.useOwnershipDistribution = false;
    } else {
      this.useOwnershipDistribution = true;
      this.distributionPercentage = this.newPayoutType === 'FULL_DISTRIBUTION' ? 100 : 100;
      this.updateCalculatedAmount();
    }
  }

  onDistributionOptionChange() {
    this.payoutPreview = null;
    this.updateCalculatedAmount();
  }

  onDistributionPercentageChange() {
    this.payoutPreview = null;
    if (this.distributionPercentage < 0) this.distributionPercentage = 0;
    if (this.distributionPercentage > 100) this.distributionPercentage = 100;
    this.updateCalculatedAmount();
  }

  updateCalculatedAmount() {
    if (this.useOwnershipDistribution && this.calculation && this.liquidity) {
      // Calculate total distribution based on percentage of each member's value
      const totalMemberValues = this.calculation.memberShares.reduce((sum, ms) => sum + (ms.memberValue || 0), 0);
      const calculatedAmount = (totalMemberValues * this.distributionPercentage) / 100;
      // Cap at liquid cash available
      this.newPayoutAmount = Math.min(calculatedAmount, this.liquidity.liquidCash);
    }
  }

  getEstimatedDistributionTotal(): number {
    if (!this.calculation) return 0;
    const totalMemberValues = this.calculation.memberShares.reduce((sum, ms) => sum + (ms.memberValue || 0), 0);
    return (totalMemberValues * this.distributionPercentage) / 100;
  }

  onMemberSelectionChange() {
    // Reset guarantor liabilities
    this.guarantorLiabilities = [];
    this.totalGuarantorLiability = 0;
    this.payoutPreview = null;
    
    // When member is selected for individual withdrawal, load their guarantor liabilities
    if (this.newPayoutMemberId) {
      // Load guarantor liabilities
      this.api.getGuarantorLiabilities(this.newPayoutMemberId).subscribe({
        next: (liabilities) => {
          this.guarantorLiabilities = liabilities;
          this.totalGuarantorLiability = liabilities.reduce((sum, l) => sum + l.memberLiability, 0);
          
          // Set default amount after liabilities are loaded
          if (this.calculation) {
            const memberShare = this.calculation.memberShares.find((ms: MemberShare) => ms.memberId === this.newPayoutMemberId);
            if (memberShare) {
              this.newPayoutAmount = this.getMaxWithdrawable(memberShare);
            }
          }
        },
        error: () => {
          this.guarantorLiabilities = [];
          this.totalGuarantorLiability = 0;
          
          // Still set default amount
          if (this.calculation) {
            const memberShare = this.calculation.memberShares.find((ms: MemberShare) => ms.memberId === this.newPayoutMemberId);
            if (memberShare) {
              this.newPayoutAmount = this.getMaxWithdrawable(memberShare);
            }
          }
        }
      });
    }
  }

  getMaxWithdrawable(memberShare: MemberShare): number {
    // Max withdrawable is the minimum of:
    // 1. Member's estimated value
    // 2. Available liquid cash
    // 3. Member's value minus their guarantor liabilities (must retain enough to cover guarantees)
    const memberValue = memberShare.memberValue || 0;
    const liquidCash = this.liquidity?.liquidCash || 0;
    const maxAfterGuarantorLiability = Math.max(0, memberValue - this.totalGuarantorLiability);
    
    return Math.min(memberValue, liquidCash, maxAfterGuarantorLiability);
  }

  previewPayout() {
    // For ownership-based distribution, amount is calculated automatically
    if (!this.useOwnershipDistribution || this.newPayoutType === 'INDIVIDUAL_WITHDRAWAL') {
      if (!this.newPayoutAmount || this.newPayoutAmount <= 0) {
        this.toast.error('Please enter a valid amount');
        return;
      }
    }

    if (this.newPayoutType === 'INDIVIDUAL_WITHDRAWAL') {
      if (!this.newPayoutMemberId) {
        this.toast.error('Please select a member');
        return;
      }
      
      // Validate against member's estimated value
      if (this.calculation) {
        const memberShare = this.calculation.memberShares.find((ms: MemberShare) => ms.memberId === this.newPayoutMemberId);
        if (memberShare) {
          if (this.newPayoutAmount && this.newPayoutAmount > memberShare.memberValue) {
            this.toast.error(`Amount exceeds member's estimated value (KES ${memberShare.memberValue.toLocaleString()})`);
            return;
          }
          
          // Validate against guarantor liabilities
          if (this.totalGuarantorLiability > 0 && this.newPayoutAmount) {
            const remainingAfterWithdrawal = memberShare.memberValue - this.newPayoutAmount;
            if (remainingAfterWithdrawal < this.totalGuarantorLiability) {
              const maxWithdrawable = Math.max(0, memberShare.memberValue - this.totalGuarantorLiability);
              this.toast.error(
                `Member is a guarantor for loans with total liability of KES ${this.totalGuarantorLiability.toLocaleString()}. ` +
                `Maximum withdrawable is KES ${maxWithdrawable.toLocaleString()}.`
              );
              return;
            }
          }
        }
      }
    }

    // For non-ownership mode, validate against liquid cash
    if (!this.useOwnershipDistribution && this.newPayoutType !== 'INDIVIDUAL_WITHDRAWAL') {
      if (this.liquidity && this.newPayoutAmount && this.newPayoutAmount > this.liquidity.liquidCash) {
        this.toast.error(`Amount exceeds available liquid cash (KES ${this.liquidity.liquidCash.toLocaleString()})`);
        return;
      }
    }

    this.loadingPreview.set(true);
    const request: PayoutPreviewRequest = {
      payoutType: this.newPayoutType,
      amount: this.newPayoutAmount || undefined,
      memberId: this.newPayoutMemberId || undefined,
      useOwnershipDistribution: this.useOwnershipDistribution,
      distributionPercentage: this.useOwnershipDistribution ? this.distributionPercentage : undefined
    };

    this.api.previewPayout(request).subscribe({
      next: (preview) => {
        this.payoutPreview = preview;
        this.loadingPreview.set(false);
      },
      error: (err) => {
        this.loadingPreview.set(false);
        this.toast.error('Failed to preview payout: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  async createPayout() {
    if (!this.payoutPreview || !this.payoutPreview.canProceed) {
      this.toast.error('Cannot create payout. Please review the preview.');
      return;
    }

    this.creatingPayout.set(true);
    const request: CreatePayoutRequest = {
      payoutType: this.newPayoutType,
      amount: this.newPayoutAmount!,
      description: this.newPayoutDescription || undefined,
      memberId: this.newPayoutMemberId || undefined,
      useOwnershipDistribution: this.useOwnershipDistribution,
      distributionPercentage: this.useOwnershipDistribution ? this.distributionPercentage : undefined
    };

    this.api.createPayout(request).subscribe({
      next: async (payout) => {
        this.creatingPayout.set(false);
        this.closeNewPayoutModal();
        this.loadPayoutsData();
        this.toast.success('Payout created successfully');
        
        // Ask if they want to submit for approval
        const submitNow = await this.confirmDialog.confirm({
          title: 'Submit for Approval',
          message: 'Payout created successfully. Do you want to submit it for approval now?',
          confirmText: 'Submit',
          cancelText: 'Later',
          confirmClass: 'primary'
        });
        
        if (submitNow) {
          this.submitForApproval(payout.id);
        }
      },
      error: (err) => {
        this.creatingPayout.set(false);
        this.toast.error('Failed to create payout: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  // ==================== PAYOUT ACTIONS ====================

  submitForApproval(payoutId: number) {
    this.api.submitPayoutForApproval(payoutId).subscribe({
      next: () => {
        this.loadPayouts();
        this.toast.success('Payout submitted for approval');
      },
      error: (err) => this.toast.error('Failed to submit: ' + (err.error?.message || 'Unknown error'))
    });
  }

  async approvePayout(payoutId: number) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Approve Payout',
      message: 'Are you sure you want to approve this payout? Once approved, members can be marked as paid.',
      confirmText: 'Approve',
      cancelText: 'Cancel',
      confirmClass: 'primary'
    });
    
    if (!confirmed) return;
    
    this.api.approvePayout(payoutId).subscribe({
      next: () => {
        this.loadPayouts();
        this.toast.success('Payout approved');
        if (this.selectedPayout?.id === payoutId) {
          this.loadPayoutDetail(payoutId);
        }
      },
      error: (err) => this.toast.error('Failed to approve: ' + (err.error?.message || 'Unknown error'))
    });
  }

  async cancelPayout(payoutId: number) {
    const reason = await this.confirmDialog.prompt({
      title: 'Cancel Payout',
      message: 'Please provide a reason for cancelling this payout.',
      confirmText: 'Cancel Payout',
      cancelText: 'Go Back',
      confirmClass: 'danger',
      inputLabel: 'Cancellation Reason',
      inputPlaceholder: 'Enter reason...'
    });
    
    if (reason === null) return;
    
    this.api.cancelPayout(payoutId, reason).subscribe({
      next: () => {
        this.loadPayouts();
        this.toast.success('Payout cancelled');
        if (this.selectedPayout?.id === payoutId) {
          this.closePayoutDetailModal();
        }
      },
      error: (err) => this.toast.error('Failed to cancel: ' + (err.error?.message || 'Unknown error'))
    });
  }

  async markAllPaid(payoutId: number) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Mark All as Paid',
      message: 'This will mark all members as paid and complete the payout. This action creates transaction records for each payment. Continue?',
      confirmText: 'Mark All Paid',
      cancelText: 'Cancel',
      confirmClass: 'primary'
    });
    
    if (!confirmed) return;
    
    this.api.markAllPaid(payoutId).subscribe({
      next: () => {
        this.loadPayouts();
        this.loadLiquidity();
        this.toast.success('All members marked as paid');
        if (this.selectedPayout?.id === payoutId) {
          this.loadPayoutDetail(payoutId);
        }
      },
      error: (err) => this.toast.error('Failed: ' + (err.error?.message || 'Unknown error'))
    });
  }

  async markMemberPaid(payoutId: number, memberId: number) {
    const ref = await this.confirmDialog.prompt({
      title: 'Mark as Paid',
      message: 'Enter a payment reference (optional) such as transaction ID or receipt number.',
      confirmText: 'Mark Paid',
      cancelText: 'Cancel',
      confirmClass: 'primary',
      inputLabel: 'Payment Reference',
      inputPlaceholder: 'e.g., TXN-12345 (optional)'
    });
    
    if (ref === null) return;
    
    this.api.markMemberPaid(payoutId, memberId, ref || undefined).subscribe({
      next: () => {
        this.loadPayoutDetail(payoutId);
        this.loadPayouts();
        this.loadLiquidity();
        this.toast.success('Member marked as paid');
      },
      error: (err) => this.toast.error('Failed: ' + (err.error?.message || 'Unknown error'))
    });
  }

  // ==================== PAYOUT DETAIL MODAL ====================

  openPayoutDetail(payout: Payout) {
    this.selectedPayout = payout;
    this.showPayoutDetailModal = true;
    this.loadPayoutDetail(payout.id);
  }

  loadPayoutDetail(payoutId: number) {
    this.api.getPayout(payoutId).subscribe({
      next: (p) => this.selectedPayout = p,
      error: () => {}
    });
  }

  closePayoutDetailModal() {
    this.showPayoutDetailModal = false;
    this.selectedPayout = null;
  }

  // ==================== HELPERS ====================

  getPayoutTypeLabel(type: string): string {
    switch (type) {
      case 'FULL_DISTRIBUTION': return 'Full Distribution';
      case 'PARTIAL_DIVIDEND': return 'Partial Dividend';
      case 'INDIVIDUAL_WITHDRAWAL': return 'Individual Withdrawal';
      default: return type;
    }
  }

  getPayoutStatusBadgeClass(status: string): string {
    switch (status) {
      case 'DRAFT': return 'badge-neutral';
      case 'PENDING': return 'badge-warning';
      case 'APPROVED': return 'badge-info';
      case 'COMPLETED': return 'badge-success';
      case 'CANCELLED': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  getMemberStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'badge-warning';
      case 'PAID': return 'badge-success';
      case 'CANCELLED': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  // ==================== MOBILE HELPERS ====================

  handleMobileShareAction(share: MemberShare): void {
    // Could navigate to member detail or show info modal
  }

  handleMobilePayoutAction(payout: Payout): void {
    this.openPayoutDetail(payout);
  }

  getMobilePayoutActionLabel(payout: Payout): string {
    return 'View';
  }

  isMobilePayoutActionDisabled(payout: Payout): boolean {
    return false;
  }

  getPayoutStatusForBadge(status: string): string {
    switch (status) {
      case 'DRAFT': return 'draft';
      case 'PENDING': return 'pending';
      case 'APPROVED': return 'approved';
      case 'COMPLETED': return 'paid';
      case 'CANCELLED': return 'cancelled';
      default: return status.toLowerCase();
    }
  }
}
