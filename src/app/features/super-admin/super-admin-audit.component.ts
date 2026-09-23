import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { AuditLog, PageResponse } from '../../core/models/models';

@Component({
  selector: 'app-super-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './super-admin-audit.component.html',
  styleUrl: './super-admin-audit.component.css',
})
export class SuperAdminAuditComponent implements OnInit {
  Math = Math;
  auditLogs: AuditLog[] = [];
  loading = signal(false);
  
  // Pagination
  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;

  // Detail modal
  showDetailModal = false;
  selectedLog: AuditLog | null = null;

  constructor(
    private api: ApiService,
    public session: SessionService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loadAuditLogs();
  }

  loadAuditLogs() {
    this.loading.set(true);
    
    this.api.getAllAuditLogs(this.currentPage, this.pageSize).subscribe({
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
        if (err.status === 403) {
          this.toast.error('Access denied', 'Only super admins can view this page');
        } else {
          this.toast.error('Failed to load audit logs', 'Please try again.');
        }
      }
    });
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

  formatJson(value: string | undefined): string {
    if (!value) return '-';
    try {
      const obj = JSON.parse(value);
      return JSON.stringify(obj, null, 2);
    } catch {
      return value;
    }
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
