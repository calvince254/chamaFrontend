import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, DashboardAnalytics, FundGrowthPoint, MeetingInfo, LoanAlert, PayoutInfo, DashboardTransaction, ApprovalInfo } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import {
  StatStripComponent,
  StatChipComponent,
  LabelValueComponent,
  StatusBadgeComponent,
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective
} from '../../shared/components';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, IconComponent, DecimalPipe,
    StatStripComponent, StatChipComponent, LabelValueComponent, StatusBadgeComponent,
    ListRowCardComponent, ListRowSecondaryDirective, ListRowFooterDirective
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  loading = true;
  analytics: DashboardAnalytics | null = null;

  constructor(
    private api: ApiService,
    public session: SessionService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.api.getDashboardAnalytics().subscribe({
      next: (data) => {
        this.analytics = data;
        this.loading = false;
      },
      error: () => {
        // Fallback to empty data on error
        this.analytics = {
          totalSavings: 0,
          activeMembers: 0,
          loansOutstanding: 0,
          loansNeedingAttention: 0,
          welfareBalance: 0,
          investmentValue: 0,
          savingsPercent: 0,
          investmentsPercent: 0,
          welfarePercent: 0,
          loansPercent: 0,
          ledgerBalance: 0,
          totalCredits: 0,
          totalDebits: 0,
          fundGrowth: [],
          nextMeeting: null,
          loanAlerts: [],
          nextPayout: null,
          recentTransactions: [],
          pendingApprovals: []
        };
        this.loading = false;
      }
    });
  }

  // Helper for chart bar heights
  getBarHeight(amount: number): number {
    if (!this.analytics?.fundGrowth || this.analytics.fundGrowth.length === 0) return 0;
    const max = Math.max(...this.analytics.fundGrowth.map(p => p.amount || 0));
    if (max === 0) return 0;
    return Math.round((amount / max) * 100);
  }

  // Helper for fund allocation
  get allocationData() {
    if (!this.analytics) return [];
    return [
      { label: 'Savings', percent: this.analytics.savingsPercent || 0, color: '#10b981' },
      { label: 'Investments', percent: this.analytics.investmentsPercent || 0, color: '#3b82f6' },
      { label: 'Welfare', percent: this.analytics.welfarePercent || 0, color: '#f59e0b' },
      { label: 'Loans Out', percent: this.analytics.loansPercent || 0, color: '#ef4444' }
    ].filter(d => d.percent > 0);
  }

  // Build CSS conic-gradient for donut
  get donutGradient(): string {
    const data = this.allocationData;
    if (data.length === 0) return 'conic-gradient(#e5e7eb 0% 100%)';
    let gradient = 'conic-gradient(';
    let cumulative = 0;
    data.forEach((item, i) => {
      const start = cumulative;
      cumulative += item.percent;
      gradient += `${item.color} ${start}% ${cumulative}%`;
      if (i < data.length - 1) gradient += ', ';
    });
    gradient += ')';
    return gradient;
  }

  // Line chart helpers
  getPointX(index: number): number {
    const points = this.analytics?.fundGrowth?.length || 1;
    const chartWidth = 260; // 290 - 30 (left margin)
    const spacing = chartWidth / Math.max(points - 1, 1);
    return 30 + (index * spacing);
  }

  getPointY(amount: number): number {
    if (!this.analytics?.fundGrowth || this.analytics.fundGrowth.length === 0) return 90;
    const max = Math.max(...this.analytics.fundGrowth.map(p => p.amount || 0));
    if (max === 0) return 90;
    const chartHeight = 80; // 90 - 10 (margins)
    return 90 - ((amount / max) * chartHeight);
  }

  getLinePath(): string {
    if (!this.analytics?.fundGrowth || this.analytics.fundGrowth.length === 0) return '';
    return this.analytics.fundGrowth
      .map((point, i) => {
        const x = this.getPointX(i);
        const y = this.getPointY(point.amount);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');
  }

  getAreaPath(): string {
    if (!this.analytics?.fundGrowth || this.analytics.fundGrowth.length === 0) return '';
    const points = this.analytics.fundGrowth;
    let path = `M 30 90`; // Start at bottom left
    points.forEach((point, i) => {
      const x = this.getPointX(i);
      const y = this.getPointY(point.amount);
      path += ` L ${x} ${y}`;
    });
    // Close the path back to bottom
    const lastX = this.getPointX(points.length - 1);
    path += ` L ${lastX} 90 Z`;
    return path;
  }
}
