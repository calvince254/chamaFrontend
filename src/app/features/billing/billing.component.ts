import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { PageResponse } from '../../core/models/models';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import {
  StatStripComponent,
  StatChipComponent,
  StatusBadgeComponent,
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective,
  LabelValueComponent,
  PaginationBarComponent
} from '../../shared/components';

interface Invoice {
  id: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  contributionFees: number;
  fineFees: number;
  loanFees: number;
  penaltyFees: number;
  fixedFee: number;
  subtotal: number;
  adjustments: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: string;
  paidDate: string | null;
  paymentReference: string | null;
  paymentConfirmedDate: string | null;
  claimedAmount: number | null;
  isAdhoc: boolean;
  notes: string | null;
}

interface License {
  id: number;
  status: string;
  contributionFeePercent: number;
  fineFeePercent: number;
  loanFeePercent: number;
  penaltyFeePercent: number;
  monthlyFixedFee: number;
  gracePeriodDays: number;
  billingDayOfMonth: number;
  uninvoicedAmount: number;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, DatePipe, DecimalPipe, NgClass, StatStripComponent, StatChipComponent, StatusBadgeComponent, ListRowCardComponent, ListRowSecondaryDirective, ListRowFooterDirective, LabelValueComponent, PaginationBarComponent],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.css',
})
export class BillingComponent implements OnInit {
  invoices: Invoice[] = [];
  license: License | null = null;
  loading = true;
  loadingLicense = true;
  
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
  
  // Selected invoice for details view
  selectedInvoice: Invoice | null = null;
  
  // Payment confirmation modal
  showPaymentModal = false;
  paymentInvoice: Invoice | null = null;
  paymentForm = {
    amount: 0,
    paymentReference: ''
  };
  confirmingPayment = signal(false);

  constructor(
    private api: ApiService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loadInvoices();
    this.loadLicense();
  }

  loadInvoices() {
    this.loading = true;
    const status = this.statusFilter || undefined;
    this.api.getMyInvoicesPaginated(this.currentPage, this.pageSize, status).subscribe({
      next: (response: PageResponse<Invoice>) => {
        this.invoices = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load invoices:', err);
        this.loading = false;
        // Don't show error for 404 - means no license/invoices yet
        if (err.status !== 404) {
          this.toast.error('Failed to load invoices', err.error?.message || 'An error occurred');
        }
      }
    });
  }

  onFilterChange() {
    this.currentPage = 0;
    this.loadInvoices();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadInvoices();
    }
  }

  previousPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadInvoices();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadInvoices();
    }
  }

  loadLicense() {
    this.loadingLicense = true;
    this.api.getMyLicense().subscribe({
      next: (license) => {
        this.license = license;
        this.loadingLicense = false;
      },
      error: () => {
        this.license = null;
        this.loadingLicense = false;
      }
    });
  }

  viewInvoice(invoice: Invoice) {
    this.selectedInvoice = invoice;
  }

  closeInvoiceDetails() {
    this.selectedInvoice = null;
  }

  downloadInvoice(invoice: Invoice) {
    this.toast.info('Downloading...', 'Preparing your invoice PDF');
    
    this.api.downloadMyInvoicePdf(invoice.id).subscribe({
      next: (blob) => {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${invoice.invoiceNumber}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.toast.success('Downloaded', 'Invoice PDF has been downloaded');
      },
      error: (err) => {
        console.error('Failed to download invoice:', err);
        this.toast.error('Download failed', 'Unable to download invoice PDF');
      }
    });
  }

  // ==================== PAYMENT CONFIRMATION ====================

  openPaymentModal(invoice: Invoice) {
    this.paymentInvoice = invoice;
    this.paymentForm = {
      amount: invoice.balance,
      paymentReference: ''
    };
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.paymentInvoice = null;
  }

  confirmPayment() {
    if (!this.paymentInvoice) return;
    if (!this.paymentForm.paymentReference.trim()) {
      this.toast.error('Required', 'Please enter a payment reference (e.g., M-PESA code)');
      return;
    }
    if (this.paymentForm.amount <= 0) {
      this.toast.error('Invalid amount', 'Please enter a valid payment amount');
      return;
    }

    this.confirmingPayment.set(true);
    
    this.api.confirmInvoicePayment(
      this.paymentInvoice.id,
      this.paymentForm.amount,
      this.paymentForm.paymentReference
    ).subscribe({
      next: (updated) => {
        this.confirmingPayment.set(false);
        this.closePaymentModal();
        
        // Update invoice in list
        const idx = this.invoices.findIndex(i => i.id === updated.id);
        if (idx >= 0) this.invoices[idx] = updated;
        
        // Update selected invoice if viewing
        if (this.selectedInvoice?.id === updated.id) {
          this.selectedInvoice = updated;
        }
        
        this.toast.success('Payment confirmed', 'Your payment has been submitted for verification. We will confirm once received.');
      },
      error: (err) => {
        this.confirmingPayment.set(false);
        this.toast.error('Failed to confirm payment', err.error?.message || 'An error occurred');
      }
    });
  }

  canConfirmPayment(invoice: Invoice): boolean {
    return ['SENT', 'OVERDUE', 'PARTIAL'].includes(invoice.status);
  }

  // ==================== COMPUTED PROPERTIES ====================

  get totalOutstanding(): number {
    return this.invoices
      .filter(i => ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status))
      .reduce((sum, inv) => sum + inv.balance, 0);
  }

  get hasOutstanding(): boolean {
    return this.totalOutstanding > 0;
  }

  get overdueInvoices(): Invoice[] {
    return this.invoices.filter(i => i.status === 'OVERDUE');
  }

  get pendingConfirmation(): Invoice[] {
    return this.invoices.filter(i => i.status === 'PENDING_CONFIRMATION');
  }

  get licenseStatus(): string {
    return this.license?.status || 'UNKNOWN';
  }

  get isLicenseSuspended(): boolean {
    return this.license?.status === 'SUSPENDED';
  }

  // ==================== HELPERS ====================

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'SENT': return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'PARTIAL': return 'bg-orange-100 text-orange-800';
      case 'PENDING_CONFIRMATION': return 'bg-blue-100 text-blue-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING_CONFIRMATION': return 'Pending Verification';
      default: return status;
    }
  }

  getLicenseStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'TRIAL': return 'bg-blue-100 text-blue-800';
      case 'SUSPENDED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }

  formatPeriod(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startMonth} - ${endMonth}`;
  }

  // ==================== MOBILE HELPERS ====================

  handleMobileInvoiceAction(invoice: Invoice) {
    this.viewInvoice(invoice);
  }

  getMobileInvoiceActionLabel(invoice: Invoice): string {
    return 'View';
  }

  formatMobileCurrency(amount: number): string {
    return 'KES ' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
