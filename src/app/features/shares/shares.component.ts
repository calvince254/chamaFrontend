import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { 
  ShareCalculation, MemberShare, Liquidity, Payout, PayoutPreview, 
  CreatePayoutRequest, PayoutPreviewRequest, Member, PageResponse 
} from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { ToastService } from '../../shared/toast.service';

@Component({
  selector: 'app-shares',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './shares.component.html',
})
export class SharesComponent implements OnInit {
  // Tab management
  activeTab: 'ownership' | 'payouts' = 'ownership';

  // Member Ownership tab
  calculation: ShareCalculation | null = null;
  loading = signal(false);
  error = signal<string | null>(null);
  showInfoModal = false;

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

  // Members for individual withdrawal
  members: Member[] = [];

  private confirmDialog = inject(ConfirmDialogService);
  private toast = inject(ToastService);

  constructor(private api: ApiService, public session: SessionService) {}

  ngOnInit() {
    this.loadShareCalculation();
  }

  onTabChange(tab: 'ownership' | 'payouts') {
    this.activeTab = tab;
    if (tab === 'payouts') {
      this.loadPayoutsData();
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
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.error.set('You do not have permission to view shares.');
        } else {
          this.error.set('Failed to load share calculation.');
          console.error('Failed to load share calculation:', err);
        }
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

  refresh() {
    if (this.activeTab === 'ownership') {
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
    this.newPayoutAmount = this.liquidity?.liquidCash || null;
    this.newPayoutDescription = '';
    this.newPayoutMemberId = null;
    this.payoutPreview = null;
  }

  closeNewPayoutModal() {
    this.showNewPayoutModal = false;
    this.payoutPreview = null;
  }

  onPayoutTypeChange() {
    this.payoutPreview = null;
    if (this.newPayoutType === 'FULL_DISTRIBUTION') {
      this.newPayoutAmount = this.liquidity?.liquidCash || 0;
    } else if (this.newPayoutType === 'INDIVIDUAL_WITHDRAWAL') {
      this.newPayoutMemberId = null;
    }
  }

  previewPayout() {
    if (!this.newPayoutAmount || this.newPayoutAmount <= 0) {
      this.toast.error('Please enter a valid amount');
      return;
    }

    if (this.newPayoutType === 'INDIVIDUAL_WITHDRAWAL' && !this.newPayoutMemberId) {
      this.toast.error('Please select a member');
      return;
    }

    this.loadingPreview.set(true);
    const request: PayoutPreviewRequest = {
      payoutType: this.newPayoutType,
      amount: this.newPayoutAmount,
      memberId: this.newPayoutMemberId || undefined
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
      memberId: this.newPayoutMemberId || undefined
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
}
