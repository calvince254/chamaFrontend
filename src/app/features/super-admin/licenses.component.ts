import { Component, OnInit, signal, Pipe, PipeTransform } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

// Ordinal pipe for day of month display
@Pipe({ name: 'ordinal', standalone: true })
export class OrdinalPipe implements PipeTransform {
  transform(value: number): string {
    if (!value) return '';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = value % 100;
    return value + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  }
}

interface License {
  id: number;
  tenantId: number;
  tenantName: string;
  contributionFeePercent: number;
  fineFeePercent: number;
  loanFeePercent: number;
  penaltyFeePercent: number;
  monthlyFixedFee: number;
  gracePeriodDays: number;
  billingDayOfMonth: number;
  status: string;
  uninvoicedAmount: number;
}

interface Invoice {
  id: number;
  tenantId: number;
  tenantName: string;
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
}

interface LicenseTransaction {
  id: number;
  tenantId: number;
  tenantName: string;
  transactionType: string;
  originalAmount: number;
  feePercent: number;
  feeAmount: number;
  transactionDate: string;
  description: string;
  invoiced: boolean;
}

interface Tenant {
  id: number;
  name: string;
  code: string;
}

@Component({
  selector: 'app-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, DatePipe, DecimalPipe, NgClass, OrdinalPipe],
  templateUrl: './licenses.component.html',
})
export class LicensesComponent implements OnInit {
  // Data
  licenses: License[] = [];
  outstandingInvoices: Invoice[] = [];
  paidInvoices: Invoice[] = [];
  availableTenants: Tenant[] = [];
  
  // Loading states
  loading = true;
  loadingInvoices = false;
  loadingPaidInvoices = false;
  loadingTenants = false;
  refreshing = signal(false);
  
  // Active tab
  activeTab: 'licenses' | 'invoices' | 'billable' | 'paid' | 'transactions' = 'licenses';
  
  // Billable transactions
  billableTransactions: LicenseTransaction[] = [];
  filteredBillableTransactions: LicenseTransaction[] = [];
  loadingBillable = false;
  selectedBillingMonth = '';
  selectedBillingTenant = 'all';
  billingMonths: { value: string; label: string }[] = [];
  billableSummary = { contributions: 0, fines: 0, loans: 0, penalties: 0, total: 0 };
  
  // License form
  showLicenseForm = false;
  editingLicense: License | null = null;
  licenseDraft = this.getEmptyLicenseDraft();
  savingLicense = signal(false);
  
  // Billing days for dropdown
  billingDays = Array.from({ length: 28 }, (_, i) => i + 1);
  
  // Selected tenant for details
  selectedTenantId: number | null = null;
  selectedTenantName = '';
  tenantInvoices: Invoice[] = [];
  tenantTransactions: LicenseTransaction[] = [];
  loadingTenantDetails = false;
  
  // Invoice form
  showInvoiceForm = false;
  invoiceDraft = {
    tenantId: 0,
    periodStart: '',
    periodEnd: '',
    isAdhoc: false,
    description: '',
    amount: 0
  };
  generatingInvoice = signal(false);
  
  // Payment form
  showPaymentForm = false;
  selectedInvoice: Invoice | null = null;
  paymentDraft = { amount: 0, paymentReference: '' };
  recordingPayment = signal(false);
  
  // Search
  searchQuery = '';
  
  constructor(
    private api: ApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.initBillingMonths();
    this.loadLicenses();
    this.loadOutstandingInvoices();
    this.loadPaidInvoices(); // Load paid invoices on init for revenue calculation
  }

  initBillingMonths() {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      months.push({ value, label });
    }
    this.billingMonths = months;
    this.selectedBillingMonth = months[0].value; // Default to current month
  }

  refreshAllData() {
    this.refreshing.set(true);
    this.paidInvoices = []; // Clear to force reload
    
    // Reload all data
    this.loadLicenses();
    this.loadOutstandingInvoices();
    this.loadPaidInvoices();
    
    // Set timeout to stop refreshing indicator
    setTimeout(() => {
      this.refreshing.set(false);
      this.toast.success('Data refreshed', 'All statistics updated');
    }, 1000);
  }

  getEmptyLicenseDraft() {
    return {
      tenantId: 0,
      contributionFeePercent: 0,
      fineFeePercent: 0,
      loanFeePercent: 0,
      penaltyFeePercent: 0,
      monthlyFixedFee: 0,
      gracePeriodDays: 7,
      billingDayOfMonth: 1,
      status: 'ACTIVE'
    };
  }

  loadLicenses() {
    this.loading = true;
    this.api.getLicenses().subscribe({
      next: (licenses) => {
        this.licenses = licenses;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load licenses:', err);
        this.toast.error('Failed to load licenses', err.error?.message || 'An error occurred');
        this.loading = false;
      }
    });
  }

  loadOutstandingInvoices() {
    this.loadingInvoices = true;
    this.api.getOutstandingInvoices().subscribe({
      next: (invoices) => {
        this.outstandingInvoices = invoices;
        this.loadingInvoices = false;
      },
      error: (err) => {
        console.error('Failed to load invoices:', err);
        this.loadingInvoices = false;
      }
    });
  }

  loadPaidInvoices() {
    this.loadingPaidInvoices = true;
    this.api.getPaidInvoices().subscribe({
      next: (invoices) => {
        this.paidInvoices = invoices;
        this.loadingPaidInvoices = false;
      },
      error: (err) => {
        console.error('Failed to load paid invoices:', err);
        this.loadingPaidInvoices = false;
      }
    });
  }

  loadBillableTransactions() {
    this.loadingBillable = true;
    const [year, month] = this.selectedBillingMonth.split('-').map(Number);
    
    this.api.getBillableTransactions(year, month).subscribe({
      next: (transactions) => {
        this.billableTransactions = transactions;
        this.filterBillableTransactions();
        this.loadingBillable = false;
      },
      error: (err) => {
        console.error('Failed to load billable transactions:', err);
        this.billableTransactions = [];
        this.filteredBillableTransactions = [];
        this.calculateBillableSummary();
        this.loadingBillable = false;
      }
    });
  }

  filterBillableTransactions() {
    if (this.selectedBillingTenant === 'all') {
      this.filteredBillableTransactions = [...this.billableTransactions];
    } else {
      const tenantId = Number(this.selectedBillingTenant);
      this.filteredBillableTransactions = this.billableTransactions.filter(tx => tx.tenantId === tenantId);
    }
    this.calculateBillableSummary();
  }

  calculateBillableSummary() {
    this.billableSummary = {
      contributions: 0,
      fines: 0,
      loans: 0,
      penalties: 0,
      total: 0
    };

    for (const tx of this.filteredBillableTransactions) {
      switch (tx.transactionType) {
        case 'CONTRIBUTION':
          this.billableSummary.contributions += tx.feeAmount;
          break;
        case 'FINE':
          this.billableSummary.fines += tx.feeAmount;
          break;
        case 'LOAN_DISBURSEMENT':
        case 'LOAN_INTEREST':
          this.billableSummary.loans += tx.feeAmount;
          break;
        case 'PENALTY':
          this.billableSummary.penalties += tx.feeAmount;
          break;
      }
      this.billableSummary.total += tx.feeAmount;
    }
  }

  get totalBillableAmount(): number {
    return this.billableTransactions.reduce((sum, tx) => sum + tx.feeAmount, 0);
  }

  // ==================== LICENSE MANAGEMENT ====================
  
  openLicenseForm(license?: License) {
    if (license) {
      this.editingLicense = license;
      this.licenseDraft = { ...license };
    } else {
      this.editingLicense = null;
      this.licenseDraft = this.getEmptyLicenseDraft();
      this.loadAvailableTenants();
    }
    this.showLicenseForm = true;
  }

  loadAvailableTenants() {
    this.loadingTenants = true;
    this.api.getTenants().subscribe({
      next: (tenants) => {
        // Filter out tenants that already have licenses
        const licensedTenantIds = new Set(this.licenses.map(l => l.tenantId));
        this.availableTenants = tenants.filter((t: Tenant) => !licensedTenantIds.has(t.id));
        this.loadingTenants = false;
      },
      error: () => {
        this.availableTenants = [];
        this.loadingTenants = false;
      }
    });
  }

  saveLicense() {
    this.savingLicense.set(true);
    
    if (this.editingLicense) {
      // Update existing license
      this.api.updateLicense(this.editingLicense.id, this.licenseDraft).subscribe({
        next: (updated) => {
          const idx = this.licenses.findIndex(l => l.id === updated.id);
          if (idx >= 0) this.licenses[idx] = updated;
          this.savingLicense.set(false);
          this.showLicenseForm = false;
          this.toast.success('License updated', `License for ${updated.tenantName} has been updated.`);
        },
        error: (err) => {
          this.savingLicense.set(false);
          this.toast.error('Failed to update license', err.error?.message || 'An error occurred');
        }
      });
    } else {
      // Create new license
      this.api.createLicense(this.licenseDraft.tenantId, this.licenseDraft).subscribe({
        next: (created) => {
          this.licenses = [...this.licenses, created];
          this.savingLicense.set(false);
          this.showLicenseForm = false;
          this.toast.success('License created', `License for ${created.tenantName} has been created.`);
        },
        error: (err) => {
          this.savingLicense.set(false);
          this.toast.error('Failed to create license', err.error?.message || 'An error occurred');
        }
      });
    }
  }

  async toggleLicenseStatus(license: License) {
    const action = license.status === 'ACTIVE' ? 'suspend' : 'activate';
    const confirmed = await this.confirmDialog.confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} License`,
      message: `Are you sure you want to ${action} the license for "${license.tenantName}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      cancelText: 'Cancel',
      type: action === 'suspend' ? 'warning' : 'info'
    });
    
    if (!confirmed) return;

    const method = action === 'suspend' 
      ? this.api.suspendLicense(license.id)
      : this.api.activateLicense(license.id);

    method.subscribe({
      next: (updated) => {
        const idx = this.licenses.findIndex(l => l.id === license.id);
        if (idx >= 0) this.licenses[idx] = updated;
        this.toast.success(`License ${action}d`, `License for ${license.tenantName} has been ${action}d.`);
      },
      error: (err) => {
        this.toast.error(`Failed to ${action} license`, err.error?.message || 'An error occurred');
      }
    });
  }

  // ==================== TENANT DETAILS ====================
  
  viewTenantDetails(license: License) {
    this.selectedTenantId = license.tenantId;
    this.selectedTenantName = license.tenantName;
    this.loadTenantDetails(license.tenantId);
  }

  loadTenantDetails(tenantId: number) {
    this.loadingTenantDetails = true;
    
    // Load invoices
    this.api.getInvoicesByTenant(tenantId).subscribe({
      next: (invoices) => {
        this.tenantInvoices = invoices;
      },
      error: () => this.tenantInvoices = []
    });
    
    // Load transactions
    this.api.getLicenseTransactions(tenantId).subscribe({
      next: (transactions) => {
        this.tenantTransactions = transactions;
        this.loadingTenantDetails = false;
      },
      error: () => {
        this.tenantTransactions = [];
        this.loadingTenantDetails = false;
      }
    });
  }

  closeTenantDetails() {
    this.selectedTenantId = null;
    this.selectedTenantName = '';
    this.tenantInvoices = [];
    this.tenantTransactions = [];
  }

  // ==================== INVOICE MANAGEMENT ====================
  
  openInvoiceForm(tenantId?: number) {
    // Close tenant details modal if open
    if (this.selectedTenantId) {
      this.closeTenantDetails();
    }
    
    this.invoiceDraft = {
      tenantId: tenantId || 0,
      periodStart: this.getDefaultPeriodStart(),
      periodEnd: this.getDefaultPeriodEnd(),
      isAdhoc: false,
      description: '',
      amount: 0
    };
    this.showInvoiceForm = true;
  }

  getDefaultPeriodStart(): string {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return firstDay.toISOString().split('T')[0];
  }

  getDefaultPeriodEnd(): string {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return lastDay.toISOString().split('T')[0];
  }

  generateInvoice() {
    this.generatingInvoice.set(true);
    
    // Store the tenant ID before closing the form
    const invoiceTenantId = this.invoiceDraft.tenantId;
    
    this.api.generateInvoice(this.invoiceDraft).subscribe({
      next: (invoice) => {
        this.generatingInvoice.set(false);
        this.showInvoiceForm = false;
        this.toast.success('Invoice generated', `Invoice ${invoice.invoiceNumber} has been generated.`);
        
        // Refresh data
        this.loadOutstandingInvoices();
        this.loadLicenses(); // Refresh licenses to update uninvoiced amounts
        
        // Re-open tenant details to show the new invoice
        const license = this.licenses.find(l => l.tenantId === invoiceTenantId);
        if (license) {
          this.viewTenantDetails(license);
        }
      },
      error: (err) => {
        this.generatingInvoice.set(false);
        this.toast.error('Failed to generate invoice', err.error?.message || 'An error occurred');
      }
    });
  }

  async sendInvoice(invoice: Invoice) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Send Invoice',
      message: `Send invoice ${invoice.invoiceNumber} to ${invoice.tenantName}?`,
      confirmText: 'Send',
      cancelText: 'Cancel',
      type: 'info'
    });
    
    if (!confirmed) return;

    this.api.sendInvoice(invoice.id).subscribe({
      next: (updated) => {
        this.updateInvoiceInLists(updated);
        this.toast.success('Invoice sent', `Invoice ${invoice.invoiceNumber} has been sent.`);
      },
      error: (err) => {
        this.toast.error('Failed to send invoice', err.error?.message || 'An error occurred');
      }
    });
  }

  openPaymentForm(invoice: Invoice) {
    this.selectedInvoice = invoice;
    this.paymentDraft = { amount: invoice.balance, paymentReference: '' };
    this.showPaymentForm = true;
  }

  recordPayment() {
    if (!this.selectedInvoice) return;
    
    this.recordingPayment.set(true);
    
    this.api.recordInvoicePayment(
      this.selectedInvoice.id, 
      this.paymentDraft.amount, 
      this.paymentDraft.paymentReference
    ).subscribe({
      next: (updated) => {
        this.recordingPayment.set(false);
        this.showPaymentForm = false;
        this.updateInvoiceInLists(updated);
        this.toast.success('Payment recorded', `Payment of ${this.paymentDraft.amount} has been recorded.`);
      },
      error: (err) => {
        this.recordingPayment.set(false);
        this.toast.error('Failed to record payment', err.error?.message || 'An error occurred');
      }
    });
  }

  async markPaid(invoice: Invoice) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Mark as Paid',
      message: `Mark invoice ${invoice.invoiceNumber} as fully paid?`,
      confirmText: 'Mark Paid',
      cancelText: 'Cancel',
      type: 'info'
    });
    
    if (!confirmed) return;

    this.api.markInvoicePaid(invoice.id).subscribe({
      next: (updated) => {
        this.updateInvoiceInLists(updated);
        this.toast.success('Invoice paid', `Invoice ${invoice.invoiceNumber} has been marked as paid.`);
      },
      error: (err) => {
        this.toast.error('Failed to mark paid', err.error?.message || 'An error occurred');
      }
    });
  }

  async cancelInvoice(invoice: Invoice) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Cancel Invoice',
      message: `Cancel invoice ${invoice.invoiceNumber}? This will release all associated transactions.`,
      confirmText: 'Cancel Invoice',
      cancelText: 'Keep',
      type: 'danger'
    });
    
    if (!confirmed) return;

    this.api.cancelInvoice(invoice.id, 'Cancelled by admin').subscribe({
      next: (updated) => {
        this.updateInvoiceInLists(updated);
        this.toast.success('Invoice cancelled', `Invoice ${invoice.invoiceNumber} has been cancelled.`);
      },
      error: (err) => {
        this.toast.error('Failed to cancel invoice', err.error?.message || 'An error occurred');
      }
    });
  }

  downloadInvoicePdf(invoice: Invoice) {
    this.toast.info('Downloading...', 'Preparing invoice PDF');
    
    this.api.downloadInvoicePdf(invoice.id).subscribe({
      next: (blob) => {
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

  async confirmReceipt(invoice: Invoice) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Confirm Payment Receipt',
      message: `Confirm that you received payment of KES ${invoice.claimedAmount?.toLocaleString() || invoice.balance.toLocaleString()} for invoice ${invoice.invoiceNumber} from ${invoice.tenantName}?\n\nPayment Reference: ${invoice.paymentReference || 'Not provided'}`,
      confirmText: 'Confirm Receipt',
      cancelText: 'Cancel',
      type: 'info'
    });
    
    if (!confirmed) return;

    this.api.confirmInvoiceReceipt(invoice.id, invoice.claimedAmount || invoice.balance).subscribe({
      next: (updated) => {
        this.updateInvoiceInLists(updated);
        this.toast.success('Payment confirmed', `Payment for ${invoice.invoiceNumber} has been confirmed.`);
      },
      error: (err) => {
        this.toast.error('Failed to confirm payment', err.error?.message || 'An error occurred');
      }
    });
  }

  async rejectPayment(invoice: Invoice) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Reject Payment Confirmation',
      message: `Reject the payment confirmation for invoice ${invoice.invoiceNumber}? The invoice will be returned to its previous status.`,
      confirmText: 'Reject',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (!confirmed) return;

    this.api.rejectPaymentConfirmation(invoice.id, 'Payment not received or verified').subscribe({
      next: (updated) => {
        this.updateInvoiceInLists(updated);
        this.toast.success('Payment rejected', `Payment confirmation for ${invoice.invoiceNumber} has been rejected.`);
      },
      error: (err) => {
        this.toast.error('Failed to reject payment', err.error?.message || 'An error occurred');
      }
    });
  }

  get pendingConfirmationInvoices(): Invoice[] {
    return this.outstandingInvoices.filter(i => i.status === 'PENDING_CONFIRMATION');
  }

  private updateInvoiceInLists(updated: Invoice) {
    // Update in outstanding invoices
    const outIdx = this.outstandingInvoices.findIndex(i => i.id === updated.id);
    if (outIdx >= 0) {
      if (updated.status === 'PAID' || updated.status === 'CANCELLED') {
        this.outstandingInvoices.splice(outIdx, 1);
        // Add to paid invoices if paid
        if (updated.status === 'PAID') {
          this.paidInvoices = [updated, ...this.paidInvoices];
        }
      } else {
        this.outstandingInvoices[outIdx] = updated;
      }
    }
    
    // Update in tenant invoices
    const tenIdx = this.tenantInvoices.findIndex(i => i.id === updated.id);
    if (tenIdx >= 0) {
      this.tenantInvoices[tenIdx] = updated;
    }
    
    // Update in paid invoices
    const paidIdx = this.paidInvoices.findIndex(i => i.id === updated.id);
    if (paidIdx >= 0) {
      this.paidInvoices[paidIdx] = updated;
    }
  }

  // ==================== HELPERS ====================
  
  get filteredLicenses(): License[] {
    if (!this.searchQuery.trim()) return this.licenses;
    const query = this.searchQuery.toLowerCase();
    return this.licenses.filter(l => 
      l.tenantName.toLowerCase().includes(query)
    );
  }

  get totalOutstanding(): number {
    return this.outstandingInvoices.reduce((sum, inv) => sum + inv.balance, 0);
  }

  get totalRevenue(): number {
    return this.paidInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  }

  get activeLicenses(): number {
    return this.licenses.filter(l => l.status === 'ACTIVE').length;
  }

  get suspendedLicenses(): number {
    return this.licenses.filter(l => l.status === 'SUSPENDED').length;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'TRIAL': return 'bg-blue-100 text-blue-800';
      case 'SUSPENDED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'SENT': return 'bg-yellow-100 text-yellow-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'PARTIAL': return 'bg-orange-100 text-orange-800';
      case 'PENDING_CONFIRMATION': return 'bg-blue-100 text-blue-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING_CONFIRMATION': return 'Pending Verification';
      default: return status;
    }
  }

  getTransactionTypeLabel(type: string): string {
    switch (type) {
      case 'CONTRIBUTION': return 'Contribution';
      case 'FINE': return 'Fine';
      case 'LOAN_DISBURSEMENT': return 'Loan';
      case 'LOAN_INTEREST': return 'Loan Interest';
      case 'PENALTY': return 'Penalty';
      case 'MONTHLY_FIXED': return 'Fixed Fee';
      default: return type;
    }
  }

  getTransactionTypeClass(type: string): string {
    switch (type) {
      case 'CONTRIBUTION': return 'bg-blue-100 text-blue-700';
      case 'FINE': return 'bg-orange-100 text-orange-700';
      case 'LOAN_DISBURSEMENT': 
      case 'LOAN_INTEREST': return 'bg-purple-100 text-purple-700';
      case 'PENALTY': return 'bg-red-100 text-red-700';
      case 'MONTHLY_FIXED': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }
}
