import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Investment, InvestmentApproval, Member } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './investments.component.html',
})
export class InvestmentsComponent implements OnInit {
  investments: Investment[] = [];
  members: Member[] = [];
  pendingApprovals: InvestmentApproval[] = [];
  loading = true;
  saving = false;

  // Modal states
  showCreateModal = false;
  showPendingApprovalsModal = false;

  pendingApprovalCount = 0;

  // Form data
  createForm = {
    name: '',
    category: 'MONEY_MARKET',
    amountInvested: 0,
    description: '',
    requiresApproval: false,
    approverIds: [] as number[]
  };

  categories = [
    { value: 'MONEY_MARKET', label: 'Money Market' },
    { value: 'REAL_ESTATE', label: 'Real Estate' },
    { value: 'STOCKS', label: 'Stocks' },
    { value: 'BONDS', label: 'Bonds' },
    { value: 'FIXED_DEPOSIT', label: 'Fixed Deposit' },
    { value: 'SACCO_SHARES', label: 'SACCO Shares' },
    { value: 'LAND', label: 'Land' },
    { value: 'BUSINESS', label: 'Business' },
    { value: 'AGRICULTURE', label: 'Agriculture' },
    { value: 'OTHER', label: 'Other' }
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    public session: SessionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadInvestments();
    this.loadMembers();
    this.loadPendingApprovalCount();
  }

  // Data loading
  loadInvestments() {
    this.loading = true;
    this.api.getInvestments().subscribe({
      next: (data) => {
        this.investments = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.investments = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (data) => this.members = data.filter(m => m.status === 'ACTIVE'),
      error: () => this.members = []
    });
  }

  loadPendingApprovalCount() {
    this.api.countMyPendingApprovals().subscribe({
      next: (data) => this.pendingApprovalCount = data.count,
      error: () => this.pendingApprovalCount = 0
    });
  }

  loadPendingApprovals() {
    this.api.getMyPendingApprovals().subscribe({
      next: (data) => this.pendingApprovals = data,
      error: () => this.pendingApprovals = []
    });
  }

  // Computed - Include ALL approved investments in analysis (active, sold, written-off)
  get approvedInvestments() {
    return this.investments.filter(i => i.approvalStatus === 'APPROVED');
  }

  // Active investments only (for "current value" context)
  get activeInvestments() {
    return this.investments.filter(i => i.status === 'ACTIVE' && i.approvalStatus === 'APPROVED');
  }

  // Total amount ever invested (all approved)
  get totalInvested() {
    return this.approvedInvestments.reduce((s, i) => s + i.amountInvested, 0);
  }

  // Current value of active investments only
  get totalCurrentActive() {
    return this.activeInvestments.reduce((s, i) => s + i.currentValue, 0);
  }

  // Realized gains from sold investments
  get realizedGains() {
    return this.approvedInvestments
      .filter(i => i.status === 'SOLD')
      .reduce((s, i) => s + (i.finalGain || (i.soldAmount ? i.soldAmount - i.amountInvested : 0)), 0);
  }

  // Losses from written-off investments (negative number)
  get writtenOffLosses() {
    return this.approvedInvestments
      .filter(i => i.status === 'WRITTEN_OFF')
      .reduce((s, i) => s - i.amountInvested, 0); // Negative because it's a loss
  }

  // Unrealized gains from active investments
  get unrealizedGains() {
    return this.activeInvestments.reduce((s, i) => s + (i.currentValue - i.amountInvested), 0);
  }

  // Total net gain = unrealized + realized + write-off losses
  get totalNetGain() {
    return this.unrealizedGains + this.realizedGains + this.writtenOffLosses;
  }

  // Overall return percentage based on total invested
  get returnPercentage() {
    return this.totalInvested === 0 ? 0 : (this.totalNetGain / this.totalInvested) * 100;
  }

  getCategoryLabel(cat: string): string {
    return this.categories.find(c => c.value === cat)?.label || cat;
  }

  // Navigate to detail page
  viewInvestment(inv: Investment) {
    this.router.navigate(['/app/investments', inv.id]);
  }

  // Create Modal
  openCreateModal() {
    this.createForm = {
      name: '',
      category: 'MONEY_MARKET',
      amountInvested: 0,
      description: '',
      requiresApproval: false,
      approverIds: []
    };
    this.showCreateModal = true;
    this.cdr.detectChanges();
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.cdr.detectChanges();
  }

  toggleApprover(memberId: number) {
    const idx = this.createForm.approverIds.indexOf(memberId);
    if (idx > -1) {
      this.createForm.approverIds.splice(idx, 1);
    } else {
      this.createForm.approverIds.push(memberId);
    }
  }

  isApproverSelected(memberId: number): boolean {
    return this.createForm.approverIds.includes(memberId);
  }

  submitCreate() {
    this.saving = true;
    const payload = {
      ...this.createForm,
      requiresApproval: this.createForm.requiresApproval && this.createForm.approverIds.length > 0
    };
    this.api.createInvestment(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showCreateModal = false;
        this.loadInvestments();
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        alert('Failed to create investment');
      }
    });
  }

  // Pending Approvals Modal
  openPendingApprovalsModal() {
    this.loadPendingApprovals();
    this.showPendingApprovalsModal = true;
    this.cdr.detectChanges();
  }

  closePendingApprovalsModal() {
    this.showPendingApprovalsModal = false;
    this.cdr.detectChanges();
  }

  submitVote(approval: InvestmentApproval, approve: boolean) {
    const comment = prompt(approve ? 'Comment (optional):' : 'Rejection reason:');
    if (!approve && !comment) return;
    this.api.submitInvestmentVote(approval.investmentId, approve, comment || undefined).subscribe({
      next: () => {
        this.loadPendingApprovals();
        this.loadPendingApprovalCount();
        this.loadInvestments();
      },
      error: () => alert('Failed to submit vote')
    });
  }

  // Helpers
  getStatusClass(status: string): string {
    return status === 'ACTIVE' ? 'badge-success' : status === 'SOLD' ? 'badge-neutral' : 'badge-danger';
  }

  getApprovalClass(status: string): string {
    return status === 'APPROVED' ? 'badge-success' : status === 'PENDING' ? 'badge-warning' : 'badge-danger';
  }
}
