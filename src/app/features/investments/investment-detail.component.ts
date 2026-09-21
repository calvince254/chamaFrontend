import { Component, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Investment, InvestmentValueHistory, InvestmentApproval } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-investment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './investment-detail.component.html',
})
export class InvestmentDetailComponent implements OnInit {
  investment: Investment | null = null;
  valueHistory: InvestmentValueHistory[] = [];
  loading = true;
  loadingHistory = false;
  saving = false;

  // Approval state
  myApproval: InvestmentApproval | null = null;
  approvalList: InvestmentApproval[] = [];
  loadingApprovals = false;
  showApprovalModal = false;
  approvalAction: 'approve' | 'reject' = 'approve';
  approvalComment = '';

  // Modal states
  showUpdateValueModal = false;
  showSellModal = false;
  showWriteOffModal = false;
  showDeleteModal = false;
  showTopupModal = false;

  // Form data
  updateValueForm = { newValue: 0, notes: '' };
  sellForm = { soldAmount: 0, soldDate: '', notes: '' };
  writeOffReason = '';
  topupForm = { amount: 0, topupDate: '', notes: '' };

  // Topup history
  topupHistory: any[] = [];
  loadingTopups = false;

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

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public session: SessionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) {
        this.loadInvestment(id);
      }
    });
  }

  loadInvestment(id: number) {
    this.loading = true;
    this.api.getInvestment(id).subscribe({
      next: (data) => {
        this.investment = data;
        this.loading = false;
        this.cdr.detectChanges();
        this.loadValueHistory(id);
        this.loadTopupHistory(id);
        if (data.approvalStatus === 'PENDING') {
          this.loadApprovalInfo(id);
        }
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/app/investments']);
      }
    });
  }

  loadApprovalInfo(investmentId: number) {
    this.loadingApprovals = true;
    // Load all approvals for this investment
    this.api.getInvestmentApprovals(investmentId).subscribe({
      next: (data) => {
        this.approvalList = data;
        // Check if current user is an approver with pending decision
        const currentMemberId = this.session.getMemberId();
        this.myApproval = data.find(a => a.approverId === currentMemberId && a.decision === 'PENDING') || null;
        this.loadingApprovals = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.approvalList = [];
        this.myApproval = null;
        this.loadingApprovals = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadValueHistory(investmentId: number) {
    this.loadingHistory = true;
    this.api.getInvestmentValueHistory(investmentId).subscribe({
      next: (data) => {
        this.valueHistory = data;
        this.loadingHistory = false;
        this.cdr.detectChanges();
        setTimeout(() => this.drawChart(), 100);
      },
      error: () => {
        this.valueHistory = [];
        this.loadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadTopupHistory(investmentId: number) {
    this.loadingTopups = true;
    this.api.getInvestmentTopupHistory(investmentId).subscribe({
      next: (data) => {
        this.topupHistory = data;
        this.loadingTopups = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.topupHistory = [];
        this.loadingTopups = false;
        this.cdr.detectChanges();
      }
    });
  }

  getCategoryLabel(cat: string): string {
    return this.categories.find(c => c.value === cat)?.label || cat;
  }

  goBack() {
    this.router.navigate(['/app/investments']);
  }

  // Update Value Modal
  openUpdateValueModal() {
    if (!this.investment) return;
    this.updateValueForm = {
      newValue: this.investment.currentValue,
      notes: ''
    };
    this.showUpdateValueModal = true;
    this.cdr.detectChanges();
  }

  closeUpdateValueModal() {
    this.showUpdateValueModal = false;
    this.cdr.detectChanges();
  }

  submitUpdateValue() {
    if (!this.investment) return;
    this.saving = true;
    const id = this.investment.id;
    this.api.updateInvestmentValue(id, this.updateValueForm.newValue, this.updateValueForm.notes).subscribe({
      next: (updated) => {
        this.saving = false;
        this.showUpdateValueModal = false;
        this.investment = updated;
        this.loadValueHistory(id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        alert('Failed to update value');
      }
    });
  }

  // Sell Modal
  openSellModal() {
    if (!this.investment) return;
    this.sellForm = {
      soldAmount: this.investment.currentValue,
      soldDate: new Date().toISOString().split('T')[0],
      notes: ''
    };
    this.showSellModal = true;
    this.cdr.detectChanges();
  }

  closeSellModal() {
    this.showSellModal = false;
    this.cdr.detectChanges();
  }

  submitSell() {
    if (!this.investment) return;
    this.saving = true;
    this.api.sellInvestment(this.investment.id, this.sellForm.soldAmount, this.sellForm.soldDate, this.sellForm.notes).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/app/investments']);
      },
      error: () => {
        this.saving = false;
        alert('Failed to sell investment');
      }
    });
  }

  // Write Off Modal
  openWriteOffModal() {
    if (!this.investment) return;
    this.writeOffReason = '';
    this.showWriteOffModal = true;
    this.cdr.detectChanges();
  }

  closeWriteOffModal() {
    this.showWriteOffModal = false;
    this.cdr.detectChanges();
  }

  submitWriteOff() {
    if (!this.investment || !this.writeOffReason.trim()) return;
    this.saving = true;
    this.api.writeOffInvestment(this.investment.id, this.writeOffReason).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/app/investments']);
      },
      error: () => {
        this.saving = false;
        alert('Failed to write off investment');
      }
    });
  }

  // Delete Modal
  openDeleteModal() {
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.cdr.detectChanges();
  }

  confirmDelete() {
    if (!this.investment) return;
    this.saving = true;
    this.api.deleteInvestment(this.investment.id).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/app/investments']);
      },
      error: () => {
        this.saving = false;
        alert('Failed to delete investment');
      }
    });
  }

  // Topup (Add Principal) Modal
  openTopupModal() {
    if (!this.investment) return;
    this.topupForm = {
      amount: 0,
      topupDate: new Date().toISOString().split('T')[0],
      notes: ''
    };
    this.showTopupModal = true;
    this.cdr.detectChanges();
  }

  closeTopupModal() {
    this.showTopupModal = false;
    this.cdr.detectChanges();
  }

  submitTopup() {
    if (!this.investment || this.topupForm.amount <= 0) return;
    this.saving = true;
    const id = this.investment.id;
    this.api.topupInvestment(id, this.topupForm.amount, this.topupForm.topupDate, this.topupForm.notes).subscribe({
      next: (updated) => {
        this.saving = false;
        this.showTopupModal = false;
        this.investment = updated;
        this.loadValueHistory(id);
        this.loadTopupHistory(id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        alert('Failed to add principal');
      }
    });
  }

  // Approval Modal
  openApprovalModal(action: 'approve' | 'reject') {
    this.approvalAction = action;
    this.approvalComment = '';
    this.showApprovalModal = true;
    this.cdr.detectChanges();
  }

  closeApprovalModal() {
    this.showApprovalModal = false;
    this.cdr.detectChanges();
  }

  submitApproval() {
    if (!this.investment) return;
    if (this.approvalAction === 'reject' && !this.approvalComment.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    this.saving = true;
    const approve = this.approvalAction === 'approve';
    this.api.submitInvestmentVote(this.investment.id, approve, this.approvalComment || undefined).subscribe({
      next: () => {
        this.saving = false;
        this.showApprovalModal = false;
        // Reload the investment to get updated status
        this.loadInvestment(this.investment!.id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        alert('Failed to submit vote');
      }
    });
  }

  // Chart
  // Format large numbers for Y-axis labels
  formatYAxisLabel(value: number): string {
    const absValue = Math.abs(value);
    if (absValue >= 1000000000) {
      return (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    } else if (absValue >= 1000000) {
      return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (absValue >= 1000) {
      return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return value.toLocaleString();
  }

  drawChart() {
    if (!this.chartCanvas?.nativeElement || this.valueHistory.length < 2) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for high DPI
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Increased left padding for large number labels
    const leftPadding = 70;
    const rightPadding = 30;
    const topPadding = 30;
    const bottomPadding = 40;
    const width = rect.width - leftPadding - rightPadding;
    const height = rect.height - topPadding - bottomPadding;

    ctx.clearRect(0, 0, rect.width, rect.height);

    const values = this.valueHistory.map(h => h.recordedValue);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;

    // Background grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = topPadding + (height * i / 5);
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(rect.width - rightPadding, y);
      ctx.stroke();
      
      // Y-axis labels with formatted numbers
      const val = maxVal - (range * i / 5);
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.formatYAxisLabel(Math.round(val)), leftPadding - 8, y + 4);
    }

    // X-axis labels
    const step = Math.max(1, Math.floor(this.valueHistory.length / 6));
    this.valueHistory.forEach((h, i) => {
      if (i % step === 0 || i === this.valueHistory.length - 1) {
        const x = leftPadding + (width * i / (this.valueHistory.length - 1));
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        const date = new Date(h.valueDate);
        ctx.fillText(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), x, rect.height - bottomPadding + 20);
      }
    });

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, topPadding, 0, rect.height - bottomPadding);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    ctx.beginPath();
    ctx.moveTo(leftPadding, rect.height - bottomPadding);
    this.valueHistory.forEach((h, i) => {
      const x = leftPadding + (width * i / (this.valueHistory.length - 1));
      const y = topPadding + height - ((h.recordedValue - minVal) / range) * height;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(leftPadding + width, rect.height - bottomPadding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    this.valueHistory.forEach((h, i) => {
      const x = leftPadding + (width * i / (this.valueHistory.length - 1));
      const y = topPadding + height - ((h.recordedValue - minVal) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    this.valueHistory.forEach((h, i) => {
      const x = leftPadding + (width * i / (this.valueHistory.length - 1));
      const y = topPadding + height - ((h.recordedValue - minVal) / range) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  getStatusClass(status: string): string {
    return status === 'ACTIVE' ? 'badge-success' : status === 'SOLD' ? 'badge-neutral' : 'badge-danger';
  }

  getApprovalClass(status: string): string {
    return status === 'APPROVED' ? 'badge-success' : status === 'PENDING' ? 'badge-warning' : 'badge-danger';
  }
}
