import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { FinanceSummary, Meeting, Loan, Transaction } from '../../core/models/models';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  summary?: FinanceSummary;
  nextMeeting?: Meeting;
  pendingLoans: Loan[] = [];
  recentTransactions: Transaction[] = [];
  memberCount = 0;
  loading = true;

  constructor(
    private api: ApiService,
    public session: SessionService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    let loadCount = 0;
    let totalCalls = 0;

    // Count how many API calls we'll make based on permissions
    if (this.session.can('VIEW_FINANCE_SUMMARY')) totalCalls++;
    if (this.session.can('VIEW_MEETINGS')) totalCalls++;
    if (this.session.canAny('VIEW_LOANS', 'VIEW_PENDING_LOAN_APPROVALS')) totalCalls++;
    if (this.session.can('VIEW_TRANSACTIONS')) totalCalls++;
    if (this.session.can('VIEW_MEMBERS')) totalCalls++;

    // If no permissions at all, just stop loading
    if (totalCalls === 0) {
      this.loading = false;
      return;
    }

    const checkDone = () => {
      loadCount++;
      if (loadCount >= totalCalls) {
        this.loading = false;
      }
    };

    // Only call finance summary if user has permission
    if (this.session.can('VIEW_FINANCE_SUMMARY')) {
      this.api.getFinanceSummary().subscribe({
        next: (s) => {
          this.summary = s;
          checkDone();
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
          checkDone();
        }
      });
    } else {
      this.summary = {
        totalSavings: 0,
        totalLoansOutstanding: 0,
        incomeThisMonth: 0,
        expenditureThisMonth: 0,
        welfareFundBalance: 0,
        investmentValue: 0
      };
    }

    // Only call meetings if user has permission
    if (this.session.can('VIEW_MEETINGS')) {
      this.api.getMeetings().subscribe({
        next: (meetings) => {
          this.nextMeeting = meetings.find((m) => m.minutesStatus === 'DRAFT') ?? meetings[0];
          checkDone();
        },
        error: () => {
          this.nextMeeting = undefined;
          checkDone();
        }
      });
    }

    // Only call loans if user has permission
    if (this.session.canAny('VIEW_LOANS', 'VIEW_PENDING_LOAN_APPROVALS')) {
      this.api.getLoans().subscribe({
        next: (loans) => {
          this.pendingLoans = loans.filter((l) => l.status === 'PENDING' || l.status === 'DEFAULTED');
          checkDone();
        },
        error: () => {
          this.pendingLoans = [];
          checkDone();
        }
      });
    }

    // Only call transactions if user has permission
    if (this.session.can('VIEW_TRANSACTIONS')) {
      this.api.getTransactions().subscribe({
        next: (tx) => {
          this.recentTransactions = tx.slice(0, 5);
          checkDone();
        },
        error: () => {
          this.recentTransactions = [];
          checkDone();
        }
      });
    }

    // Only call members if user has permission
    if (this.session.can('VIEW_MEMBERS')) {
      this.api.getMembers().subscribe({
        next: (m) => {
          this.memberCount = m.length;
          checkDone();
        },
        error: () => {
          this.memberCount = 0;
          checkDone();
        }
      });
    }
  }
}
