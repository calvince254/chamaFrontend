import { Component, OnInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Investment, InvestmentValueHistory } from '../../core/models/models';
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

  // Modal states
  showUpdateValueModal = false;
  showSellModal = false;
  showWriteOffModal = false;
  showDeleteModal = false;

  // Form data
  updateValueForm = { newValue: 0, notes: '' };
  sellForm = { soldAmount: 0, soldDate: '', notes: '' };
  writeOffReason = '';

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
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/app/investments']);
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

  // Chart
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

    const padding = 50;
    const width = rect.width - padding * 2;
    const height = rect.height - padding * 2;

    ctx.clearRect(0, 0, rect.width, rect.height);

    const values = this.valueHistory.map(h => h.recordedValue);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;
    const range = maxVal - minVal || 1;

    // Background grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height * i / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(rect.width - padding, y);
      ctx.stroke();
      
      // Y-axis labels
      const val = maxVal - (range * i / 5);
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(val).toLocaleString(), padding - 8, y + 4);
    }

    // X-axis labels
    const step = Math.max(1, Math.floor(this.valueHistory.length / 6));
    this.valueHistory.forEach((h, i) => {
      if (i % step === 0 || i === this.valueHistory.length - 1) {
        const x = padding + (width * i / (this.valueHistory.length - 1));
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        const date = new Date(h.valueDate);
        ctx.fillText(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), x, rect.height - padding + 20);
      }
    });

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, rect.height - padding);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    ctx.beginPath();
    ctx.moveTo(padding, rect.height - padding);
    this.valueHistory.forEach((h, i) => {
      const x = padding + (width * i / (this.valueHistory.length - 1));
      const y = padding + height - ((h.recordedValue - minVal) / range) * height;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding + width, rect.height - padding);
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
      const x = padding + (width * i / (this.valueHistory.length - 1));
      const y = padding + height - ((h.recordedValue - minVal) / range) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    this.valueHistory.forEach((h, i) => {
      const x = padding + (width * i / (this.valueHistory.length - 1));
      const y = padding + height - ((h.recordedValue - minVal) / range) * height;
      
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
