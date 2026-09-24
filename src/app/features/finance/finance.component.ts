import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { FinanceSummary, Transaction, PageResponse, Member } from '../../core/models/models';
import { IconComponent } from '../../shared/icon.component';
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

  // Ledger balance (calculated from all transactions)
  totalCredits = 0;
  totalDebits = 0;
  ledgerBalance = 0;

  get hasFilters(): boolean {
    return !!(this.typeFilter || this.directionFilter || this.memberFilter);
  }

  resetFilters() {
    this.typeFilter = '';
    this.directionFilter = '';
    this.memberFilter = null;
    this.onFilterChange();
  }

  constructor(private api: ApiService, private session: SessionService) {}

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

    this.api.getTransactionsPaginated(this.currentPage, this.pageSize, type, direction, memberId).subscribe({
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
}
