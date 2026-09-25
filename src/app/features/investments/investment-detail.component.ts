import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Investment, InvestmentValueHistory, InvestmentApproval, Liquidity } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-investment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './investment-detail.component.html',
  styleUrl: './investment-detail.component.css',
})
export class InvestmentDetailComponent implements OnInit, OnDestroy {
  private resizeObserver: ResizeObserver | null = null;
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
  showTopupModal = false;

  // Form data
  updateValueForm = { newValue: 0, notes: '' };
  sellForm: {
    saleAmount: number;
    saleDate: string;
    unitsToSell: number;
    sellAll: boolean;
    notes: string;
  } = { saleAmount: 0, saleDate: '', unitsToSell: 0, sellAll: true, notes: '' };
  writeOffReason = '';
  topupForm = { amount: 0, topupDate: '', notes: '' };

  // Liquidity info (for topup validation)
  liquidity: Liquidity | null = null;
  loadingLiquidity = false;

  // Sale calculations
  expectedGain = 0;
  expectedPrincipalPortion = 0;

  // Sale history
  saleHistory: any[] = [];
  loadingSales = false;

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

  // Liquid investments use "Withdraw" terminology, asset-based use "Sell"
  private liquidCategories = ['MONEY_MARKET', 'FIXED_DEPOSIT', 'SACCO_SHARES'];
  
  // Asset investments where percentage/portion makes more sense than amount
  private assetCategories = ['LAND', 'REAL_ESTATE', 'BUSINESS', 'AGRICULTURE'];

  get isLiquidInvestment(): boolean {
    return this.investment ? this.liquidCategories.includes(this.investment.category) : false;
  }

  get isAssetInvestment(): boolean {
    return this.investment ? this.assetCategories.includes(this.investment.category) : false;
  }

  get actionTerm(): string {
    return this.isLiquidInvestment ? 'Withdraw' : 'Sell';
  }

  get actionTermLower(): string {
    return this.isLiquidInvestment ? 'withdraw' : 'sell';
  }

  get actionTermPast(): string {
    return this.isLiquidInvestment ? 'Withdrawn' : 'Sold';
  }

  get amountTerm(): string {
    return this.isLiquidInvestment ? 'Withdrawal' : 'Sale';
  }

  // For assets - show percentage input mode
  sellPercentage = 50; // Default to 50%
  sellByPercentage = true; // For assets, default to percentage mode

  @ViewChild('mobileChartCanvas') mobileChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('desktopChartCanvas') desktopChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('mobileChartContainer') mobileChartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('desktopChartContainer') desktopChartContainer!: ElementRef<HTMLDivElement>;

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
        this.loadSaleHistory(id);
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
        this.valueHistory = data || [];
        this.loadingHistory = false;
        this.cdr.detectChanges();
        // Try drawing chart multiple times to ensure canvas is ready
        this.drawChartWithRetry(3);
      },
      error: () => {
        this.valueHistory = [];
        this.loadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  private drawChartWithRetry(retries: number) {
    setTimeout(() => {
      this.cdr.detectChanges();
      const drawn = this.drawChart();
      if (!drawn && retries > 0) {
        this.drawChartWithRetry(retries - 1);
      } else if (!drawn) {
        // Still not drawn after retries - set up ResizeObserver as fallback
        this.setupResizeObserver();
      }
    }, 200);
  }

  private setupResizeObserver() {
    // Clean up any existing observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          this.drawChart();
          // Only need to draw once when size is available
          this.resizeObserver?.disconnect();
          break;
        }
      }
    });

    // Observe both containers
    const mobileContainer = this.mobileChartContainer?.nativeElement;
    const desktopContainer = this.desktopChartContainer?.nativeElement;
    
    if (mobileContainer) {
      this.resizeObserver.observe(mobileContainer);
    }
    if (desktopContainer) {
      this.resizeObserver.observe(desktopContainer);
    }
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
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
      saleAmount: this.investment.currentValue,
      saleDate: new Date().toISOString().split('T')[0],
      unitsToSell: 0, // Not used in amount-based approach
      sellAll: true,
      notes: ''
    };
    // For asset investments, default to percentage mode
    this.sellByPercentage = this.isAssetInvestment;
    this.sellPercentage = 100;
    this.calculateExpectedGain();
    this.showSellModal = true;
    this.cdr.detectChanges();
  }

  closeSellModal() {
    this.showSellModal = false;
    this.cdr.detectChanges();
  }

  onSellTypeChange() {
    if (this.sellForm.sellAll && this.investment) {
      this.sellForm.saleAmount = this.investment.currentValue;
      this.sellPercentage = 100;
    }
    this.calculateExpectedGain();
  }

  onPercentageChange() {
    if (!this.investment) return;
    // Update sale amount based on percentage
    this.sellForm.saleAmount = (this.sellPercentage / 100) * this.investment.currentValue;
    this.calculateExpectedGain();
  }

  onSaleAmountChange() {
    if (!this.investment || this.investment.currentValue === 0) return;
    // Update percentage based on sale amount
    this.sellPercentage = (this.sellForm.saleAmount / this.investment.currentValue) * 100;
    this.calculateExpectedGain();
  }

  calculateExpectedGain() {
    if (!this.investment) return;
    
    const currentValue = this.investment.currentValue || 0;
    const amountInvested = this.investment.remainingPrincipal || this.investment.amountInvested || 0;
    const saleAmount = this.sellForm.saleAmount || 0;
    
    // For full sale, use remaining principal
    // For partial, calculate proportional principal
    if (this.sellForm.sellAll || currentValue === 0) {
      this.expectedPrincipalPortion = amountInvested;
    } else {
      // Principal portion is proportional to sale amount vs current value
      this.expectedPrincipalPortion = (amountInvested * saleAmount) / currentValue;
    }
    
    // Calculate expected gain/loss
    this.expectedGain = saleAmount - this.expectedPrincipalPortion;
  }

  isValidSale(): boolean {
    if (!this.investment) return false;
    if (this.sellForm.saleAmount <= 0) return false;
    if (!this.sellForm.saleDate) return false;
    
    // For partial withdrawal, amount can't exceed current value
    if (!this.sellForm.sellAll && this.sellForm.saleAmount > this.investment.currentValue) {
      return false;
    }
    return true;
  }

  submitSell() {
    if (!this.investment || !this.isValidSale()) return;
    this.saving = true;
    
    // Calculate units to sell based on withdrawal amount (for backend compatibility)
    const currentValue = this.investment.currentValue || 0;
    const remainingUnits = this.investment.remainingUnits || this.investment.totalUnits || 1;
    
    let unitsToSell: number | undefined;
    if (!this.sellForm.sellAll && currentValue > 0) {
      // Calculate proportional units based on withdrawal amount
      unitsToSell = (this.sellForm.saleAmount / currentValue) * remainingUnits;
    }
    
    // Call updated API with partial sale support
    this.api.sellInvestmentPartial(
      this.investment.id,
      this.sellForm.saleAmount,
      this.sellForm.saleDate,
      this.sellForm.sellAll,
      unitsToSell,
      this.sellForm.notes
    ).subscribe({
      next: (updated) => {
        this.saving = false;
        this.showSellModal = false;
        if (updated.status === 'SOLD') {
          // Fully sold - go back to list
          this.router.navigate(['/app/investments']);
        } else {
          // Partial sale - refresh the page
          this.investment = updated;
          this.loadValueHistory(this.investment.id);
          this.loadSaleHistory(this.investment.id);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.saving = false;
        alert(err.error?.message || `Failed to ${this.actionTermLower} investment`);
      }
    });
  }

  // Load sale history
  loadSaleHistory(investmentId: number) {
    this.loadingSales = true;
    this.api.getInvestmentSaleHistory(investmentId).subscribe({
      next: (data) => {
        this.saleHistory = data;
        this.loadingSales = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingSales = false;
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

  // Topup (Add Principal) Modal
  openTopupModal() {
    if (!this.investment) return;
    this.topupForm = {
      amount: 0,
      topupDate: new Date().toISOString().split('T')[0],
      notes: ''
    };
    this.loadLiquidity();
    this.showTopupModal = true;
    this.cdr.detectChanges();
  }

  loadLiquidity() {
    this.loadingLiquidity = true;
    this.api.getLiquidity().subscribe({
      next: (data) => {
        this.liquidity = data;
        this.loadingLiquidity = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.liquidity = null;
        this.loadingLiquidity = false;
        this.cdr.detectChanges();
      }
    });
  }

  get isTopupOverLiquidCash(): boolean {
    if (!this.liquidity) return false;
    return this.topupForm.amount > this.liquidity.liquidCash;
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

  // Format numbers compactly for mobile display
  formatCompact(value: number | null | undefined): string {
    if (value == null) return '0';
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (absValue >= 1000000000) {
      return sign + (absValue / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    } else if (absValue >= 1000000) {
      return sign + (absValue / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    } else if (absValue >= 100000) {
      return sign + (absValue / 1000).toFixed(0) + 'K';
    }
    return value.toLocaleString();
  }

  // Check if number is large enough to need compact display
  isLargeNumber(value: number | null | undefined): boolean {
    if (value == null) return false;
    return Math.abs(value) >= 100000;
  }

  drawChart(): boolean {
    if (this.valueHistory.length < 2) return false;
    
    // Try to find a visible container and its canvas
    let canvas: HTMLCanvasElement | null = null;
    let containerWidth = 0;
    let containerHeight = 200; // Default height
    
    // Check mobile container first
    const mobileContainer = this.mobileChartContainer?.nativeElement;
    if (mobileContainer) {
      const rect = mobileContainer.getBoundingClientRect();
      if (rect.width > 50) { // Has meaningful width
        canvas = this.mobileChartCanvas?.nativeElement;
        // Account for padding (12px on each side)
        containerWidth = rect.width - 24;
        containerHeight = 200;
      }
    }
    
    // If mobile not visible, try desktop
    if (!canvas || containerWidth === 0) {
      const desktopContainer = this.desktopChartContainer?.nativeElement;
      if (desktopContainer) {
        const rect = desktopContainer.getBoundingClientRect();
        if (rect.width > 50) {
          canvas = this.desktopChartCanvas?.nativeElement;
          containerWidth = rect.width;
          containerHeight = 320;
        }
      }
    }
    
    if (!canvas || containerWidth === 0) return false;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Set canvas actual pixel dimensions based on container
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    
    // Set CSS display size
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    
    ctx.scale(dpr, dpr);

    // Use the calculated dimensions
    const width = containerWidth;
    const height = containerHeight;

    // Increased left padding for large number labels
    const leftPadding = 70;
    const rightPadding = 30;
    const topPadding = 30;
    const bottomPadding = 40;
    const chartWidth = width - leftPadding - rightPadding;
    const chartHeight = height - topPadding - bottomPadding;

    ctx.clearRect(0, 0, width, height);

    const values = this.valueHistory.map(h => h.recordedValue);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;

    // Background grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = topPadding + (chartHeight * i / 5);
      ctx.beginPath();
      ctx.moveTo(leftPadding, y);
      ctx.lineTo(width - rightPadding, y);
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
        const x = leftPadding + (chartWidth * i / (this.valueHistory.length - 1));
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        const date = new Date(h.valueDate);
        ctx.fillText(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), x, height - bottomPadding + 20);
      }
    });

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, topPadding, 0, height - bottomPadding);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    ctx.beginPath();
    ctx.moveTo(leftPadding, height - bottomPadding);
    this.valueHistory.forEach((h, i) => {
      const x = leftPadding + (chartWidth * i / (this.valueHistory.length - 1));
      const y = topPadding + chartHeight - ((h.recordedValue - minVal) / range) * chartHeight;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(leftPadding + chartWidth, height - bottomPadding);
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
      const x = leftPadding + (chartWidth * i / (this.valueHistory.length - 1));
      const y = topPadding + chartHeight - ((h.recordedValue - minVal) / range) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    this.valueHistory.forEach((h, i) => {
      const x = leftPadding + (chartWidth * i / (this.valueHistory.length - 1));
      const y = topPadding + chartHeight - ((h.recordedValue - minVal) / range) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    return true;
  }

  getStatusClass(status: string): string {
    return status === 'ACTIVE' ? 'badge-success' : status === 'SOLD' ? 'badge-neutral' : 'badge-danger';
  }

  getApprovalClass(status: string): string {
    return status === 'APPROVED' ? 'badge-success' : status === 'PENDING' ? 'badge-warning' : 'badge-danger';
  }
}
