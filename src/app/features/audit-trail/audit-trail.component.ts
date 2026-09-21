import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { AuditLog, PageResponse, Member } from '../../core/models/models';

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './audit-trail.component.html',
})
export class AuditTrailComponent implements OnInit {
  Math = Math;  // Expose Math for template
  auditLogs: AuditLog[] = [];
  loading = signal(false);
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;

  // Filters
  modules: string[] = [];
  actions: string[] = [];
  members: Member[] = [];
  
  filterModule = '';
  filterAction = '';
  filterMemberId: number | null = null;
  filterStartDate = '';
  filterEndDate = '';

  // Detail modal
  showDetailModal = false;
  selectedLog: AuditLog | null = null;

  // Statistics
  statistics: any = null;
  showStats = true;

  constructor(
    private api: ApiService,
    public session: SessionService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    // Only load data if user has permission to view audit trail
    if (this.session.can('VIEW_AUDIT_LOGS') || this.session.currentUser()?.isSuperAdmin) {
      this.loadFilters();
      this.loadAuditLogs();
      this.loadStatistics();
    }
  }

  loadFilters() {
    this.api.getAuditModules().subscribe({
      next: (modules) => this.modules = modules,
      error: () => {}
    });
    this.api.getAuditActions().subscribe({
      next: (actions) => this.actions = actions,
      error: () => {}
    });
    this.api.getMembers().subscribe({
      next: (members) => this.members = members,
      error: () => {}
    });
  }

  loadAuditLogs() {
    this.loading.set(true);
    
    const filters: any = {};
    if (this.filterModule) filters.module = this.filterModule;
    if (this.filterAction) filters.action = this.filterAction;
    if (this.filterMemberId) filters.memberId = this.filterMemberId;
    if (this.filterStartDate) filters.startDate = this.filterStartDate;
    if (this.filterEndDate) filters.endDate = this.filterEndDate;

    this.api.getAuditLogs(this.currentPage, this.pageSize, filters).subscribe({
      next: (response: PageResponse<AuditLog>) => {
        this.auditLogs = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          this.toast.error('Failed to load audit logs', 'Please try again.');
        }
      }
    });
  }

  loadStatistics() {
    this.api.getAuditStatistics(7).subscribe({
      next: (stats) => this.statistics = stats,
      error: () => {}
    });
  }

  onFilterChange() {
    this.currentPage = 0;
    this.loadAuditLogs();
  }

  clearFilters() {
    this.filterModule = '';
    this.filterAction = '';
    this.filterMemberId = null;
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.currentPage = 0;
    this.loadAuditLogs();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadAuditLogs();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadAuditLogs();
    }
  }

  prevPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadAuditLogs();
    }
  }

  // ==================== Detail View ====================

  viewLog(log: AuditLog) {
    this.selectedLog = log;
    this.showDetailModal = true;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedLog = null;
  }

  // ==================== Helpers ====================

  getActionClass(action: string): string {
    const lower = action?.toLowerCase() || '';
    if (lower.includes('delete') || lower.includes('reject')) return 'action-danger';
    if (lower.includes('create') || lower.includes('upload') || lower.includes('approve')) return 'action-success';
    if (lower.includes('update') || lower.includes('edit')) return 'action-warning';
    if (lower.includes('login') || lower.includes('logout')) return 'action-info';
    return 'action-neutral';
  }

  getStatusClass(status: string): string {
    return status === 'SUCCESS' ? 'status-success' : 'status-failure';
  }

  getHttpMethodClass(method: string): string {
    switch (method) {
      case 'GET': return 'method-get';
      case 'POST': return 'method-post';
      case 'PUT': return 'method-put';
      case 'DELETE': return 'method-delete';
      default: return 'method-other';
    }
  }

  formatJson(value: string | undefined): string {
    if (!value) return '-';
    try {
      const obj = JSON.parse(value);
      return JSON.stringify(obj, null, 2);
    } catch {
      return value;
    }
  }

  hasFilters(): boolean {
    return !!(this.filterModule || this.filterAction || this.filterMemberId || 
              this.filterStartDate || this.filterEndDate);
  }

  getModuleStats(): { key: string; value: number; percent: number }[] {
    if (!this.statistics?.byModule) return [];
    const entries = Object.entries(this.statistics.byModule) as [string, number][];
    const maxValue = Math.max(...entries.map(([, v]) => v));
    return entries.map(([key, value]) => ({
      key,
      value,
      percent: maxValue > 0 ? (value / maxValue) * 100 : 0
    }));
  }

  formatTimestamp(timestamp: string): string {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }) + ', ' + date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return timestamp;
    }
  }

  parseUserAgent(ua: string): { browser: string } {
    if (!ua) return { browser: 'Unknown' };
    
    // Simple browser detection
    if (ua.includes('Firefox')) {
      const match = ua.match(/Firefox\/(\d+)/);
      return { browser: `Firefox ${match ? match[1] : ''} · ${this.getOS(ua)}` };
    }
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      const match = ua.match(/Chrome\/(\d+)/);
      return { browser: `Chrome ${match ? match[1] : ''} · ${this.getOS(ua)}` };
    }
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      const match = ua.match(/Version\/(\d+)/);
      return { browser: `Safari ${match ? match[1] : ''} · ${this.getOS(ua)}` };
    }
    if (ua.includes('Edg')) {
      const match = ua.match(/Edg\/(\d+)/);
      return { browser: `Edge ${match ? match[1] : ''} · ${this.getOS(ua)}` };
    }
    return { browser: this.getOS(ua) };
  }

  private getOS(ua: string): string {
    if (ua.includes('Windows NT 10')) return 'Windows 10 (64-bit)';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS X')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown OS';
  }

  copyChanges() {
    if (!this.selectedLog) return;
    const text = this.selectedLog.newValue || this.selectedLog.oldValue || '';
    navigator.clipboard.writeText(this.formatJson(text)).then(() => {
      this.toast.success('Copied!', 'Changes copied to clipboard');
    }).catch(() => {
      this.toast.error('Failed to copy', 'Please try again');
    });
  }
}
