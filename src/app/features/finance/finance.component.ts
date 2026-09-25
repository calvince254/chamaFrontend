import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { FinanceSummary, Transaction, PageResponse, Member } from '../../core/models/models';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { environment } from '../../../environments/environment';
import {
  StatStripComponent,
  StatChipComponent,
  StatusBadgeComponent,
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective,
  PaginationBarComponent
} from '../../shared/components';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IconComponent,
    StatStripComponent, StatChipComponent, StatusBadgeComponent, ListRowCardComponent,
    ListRowSecondaryDirective, ListRowFooterDirective, PaginationBarComponent
  ],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.css',
})
export class FinanceComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  summary?: FinanceSummary;
  transactions: Transaction[] = [];
  members: Member[] = [];
  loadingSummary = true;
  loadingTransactions = true;

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;
  Math = Math;

  // Filters
  typeFilter = '';
  directionFilter = '';
  memberFilter: number | null = null;
  
  // Date range filters
  startDate: string = '';
  endDate: string = '';

  // Export modal
  showExportModal = false;
  exportStartDate: string = '';
  exportEndDate: string = '';
  exportType: string = '';
  exportDirection: string = '';
  exportMember: number | null = null;
  isExporting = false;

  // Ledger balance (calculated from all transactions)
  totalCredits = 0;
  totalDebits = 0;
  ledgerBalance = 0;

  get hasFilters(): boolean {
    return !!(this.typeFilter || this.directionFilter || this.memberFilter || this.startDate || this.endDate);
  }

  resetFilters() {
    this.typeFilter = '';
    this.directionFilter = '';
    this.memberFilter = null;
    this.startDate = '';
    this.endDate = '';
    this.onFilterChange();
  }

  constructor(private api: ApiService, public session: SessionService) {}

  ngOnInit() {
    // Only load data if user has permission to view finance
    if (this.session.can('VIEW_FINANCE') || this.session.can('VIEW_TRANSACTIONS')) {
      this.loadMembers();
      this.loadData();
    }
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (members) => {
        this.members = members;
      },
      error: () => {
        this.members = [];
      }
    });
  }

  loadData() {
    this.loadingSummary = true;

    this.api.getFinanceSummary().subscribe({
      next: (s) => {
        this.summary = s;
        this.loadingSummary = false;
      },
      error: () => {
        this.summary = {
          totalSavings: 0,
          totalLoansOutstanding: 0,
          incomeThisMonth: 0,
          expenditureThisMonth: 0,
          welfareFundBalance: 0,
          investmentValue: 0
        };
        this.loadingSummary = false;
      }
    });

    this.loadLedgerBalance();
    this.loadTransactions();
  }

  loadLedgerBalance() {
    // Load all transactions to calculate ledger balance
    this.api.getTransactionsPaginated(0, 10000).subscribe({
      next: (response) => {
        this.totalCredits = response.content
          .filter(t => t.direction === 'IN')
          .reduce((sum, t) => sum + t.amount, 0);
        this.totalDebits = response.content
          .filter(t => t.direction === 'OUT')
          .reduce((sum, t) => sum + t.amount, 0);
        this.ledgerBalance = this.totalCredits - this.totalDebits;
      },
      error: () => {
        this.totalCredits = 0;
        this.totalDebits = 0;
        this.ledgerBalance = 0;
      }
    });
  }

  loadTransactions() {
    this.loadingTransactions = true;
    const type = this.typeFilter || undefined;
    const direction = this.directionFilter || undefined;
    const memberId = this.memberFilter || undefined;
    const start = this.startDate || undefined;
    const end = this.endDate || undefined;

    this.api.getTransactionsPaginated(this.currentPage, this.pageSize, type, direction, memberId, start, end).subscribe({
      next: (response: PageResponse<Transaction>) => {
        this.transactions = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loadingTransactions = false;
      },
      error: () => {
        this.transactions = [];
        this.loadingTransactions = false;
      }
    });
  }

  onFilterChange() {
    this.currentPage = 0;
    this.loadTransactions();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadTransactions();
    }
  }

  previousPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadTransactions();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadTransactions();
    }
  }

  get isLoading() {
    return this.loadingSummary || this.loadingTransactions;
  }

  // ==================== MOBILE HELPERS ====================

  handleMobileTransactionAction(t: Transaction): void {
    // Could show transaction detail modal
  }

  getMobileTransactionActionLabel(t: Transaction): string {
    return 'View';
  }

  isMobileTransactionActionDisabled(t: Transaction): boolean {
    return true; // No detail view currently
  }

  // ==================== EXPORT MODAL ====================

  openExportModal() {
    // Pre-fill with current filter values
    this.exportStartDate = this.startDate;
    this.exportEndDate = this.endDate;
    this.exportType = this.typeFilter;
    this.exportDirection = this.directionFilter;
    this.exportMember = this.memberFilter;
    this.showExportModal = true;
  }

  closeExportModal() {
    this.showExportModal = false;
  }

  setExportPeriod(period: 'week' | 'month' | 'quarter' | 'year' | 'all') {
    const today = new Date();
    let start = new Date();
    
    switch (period) {
      case 'week':
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start.setMonth(today.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(today.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        this.exportStartDate = '';
        this.exportEndDate = '';
        return;
    }
    
    this.exportStartDate = this.formatDateForInput(start);
    this.exportEndDate = this.formatDateForInput(today);
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  exportReport() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.isExporting = true;
    
    // Build query params
    const params = new URLSearchParams();
    if (this.exportStartDate) params.append('startDate', this.exportStartDate);
    if (this.exportEndDate) params.append('endDate', this.exportEndDate);
    if (this.exportType) params.append('type', this.exportType);
    if (this.exportDirection) params.append('direction', this.exportDirection);
    if (this.exportMember) params.append('memberId', this.exportMember.toString());
    
    const token = localStorage.getItem('chama.token');
    const url = `${environment.apiUrl}/finance/report/pdf?${params.toString()}`;
    
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) throw new Error('Export failed');
      return response.blob();
    })
    .then(blob => {
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Generate filename with date range
      let filename = 'Finance_Report';
      if (this.exportStartDate && this.exportEndDate) {
        filename += `_${this.exportStartDate}_to_${this.exportEndDate}`;
      } else if (this.exportStartDate) {
        filename += `_from_${this.exportStartDate}`;
      } else if (this.exportEndDate) {
        filename += `_until_${this.exportEndDate}`;
      }
      filename += '.pdf';
      
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      
      this.toast.success('Export Complete', 'Finance report downloaded successfully');
      this.closeExportModal();
    })
    .catch(error => {
      console.error('Export failed:', error);
      this.toast.error('Export Failed', 'Could not generate the finance report');
    })
    .finally(() => {
      this.isExporting = false;
    });
  }
}
