import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { FinanceSummary, Transaction } from '../../core/models/models';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './finance.component.html',
})
export class FinanceComponent implements OnInit {
  summary?: FinanceSummary;
  transactions: Transaction[] = [];
  loadingSummary = true;
  loadingTransactions = true;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loadingSummary = true;
    this.loadingTransactions = true;

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

    this.api.getTransactions().subscribe({
      next: (t) => {
        this.transactions = t;
        this.loadingTransactions = false;
      },
      error: () => {
        this.transactions = [];
        this.loadingTransactions = false;
      }
    });
  }

  get isLoading() {
    return this.loadingSummary || this.loadingTransactions;
  }
}
