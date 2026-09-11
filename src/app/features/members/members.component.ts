import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Member, MemberFinancialSummary } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

interface MemberForm extends Partial<Member> {
  password?: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './members.component.html',
})
export class MembersComponent implements OnInit {
  members: Member[] = [];
  search = '';
  statusFilter = 'ALL';
  showForm = false;
  editing: MemberForm = {};
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  formErrors = signal<FormErrors>({});

  // Member detail modal
  showDetailModal = false;
  selectedMember: Member | null = null;
  memberSummary: MemberFinancialSummary | null = null;
  loadingSummary = signal(false);
  detailTab: 'overview' | 'loans' | 'fines' | 'payouts' | 'transactions' = 'overview';

  constructor(
    private api: ApiService, 
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.loadMembers();
  }

  loadMembers() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMembers().subscribe({
      next: (m) => {
        this.members = m;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          this.error.set('Failed to load members. Please check if the backend is running.');
          this.toast.error('Failed to load members', 'Please check your connection and try again.');
          console.error('Failed to load members:', err);
        }
      }
    });
  }

  get filtered(): Member[] {
    return this.members.filter((m) => {
      const matchesSearch =
        !this.search ||
        m.name.toLowerCase().includes(this.search.toLowerCase()) ||
        m.memberNo.toLowerCase().includes(this.search.toLowerCase());
      const matchesStatus = this.statusFilter === 'ALL' || m.status === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  openNew() {
    this.editing = { status: 'ACTIVE' };
    this.formErrors.set({});
    this.showForm = true;
  }

  edit(m: Member) {
    this.editing = { ...m, password: '' };
    this.formErrors.set({});
    this.showForm = true;
  }

  validateForm(): boolean {
    const errors: FormErrors = {};
    
    // Name validation
    if (!this.editing.name?.trim()) {
      errors.name = 'Full name is required';
    } else if (this.editing.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    // Email validation
    if (!this.editing.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!this.isValidEmail(this.editing.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Phone validation
    if (!this.editing.phone?.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!this.isValidPhone(this.editing.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    // Password validation (only for new members)
    if (!this.editing.id) {
      if (!this.editing.password?.trim()) {
        errors.password = 'Password is required for new members';
      } else if (this.editing.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    }
    
    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // Allow various phone formats
    const phoneRegex = /^[\d\s\-+()]{7,20}$/;
    return phoneRegex.test(phone);
  }

  save() {
    if (!this.validateForm()) {
      this.toast.warning('Please fix the errors', 'Check the form for validation errors.');
      return;
    }

    this.saving.set(true);
    
    const data = { ...this.editing };
    if (this.editing.id && !data.password) {
      delete data.password; // Don't send empty password on edit
    }
    
    if (this.editing.id) {
      this.api.updateMember(this.editing.id, data).subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm = false;
          this.toast.success('Member updated', `${this.editing.name} has been updated successfully.`);
          this.loadMembers();
        },
        error: (err) => {
          this.saving.set(false);
          const message = err.error?.message || err.error?.error || 'An unexpected error occurred';
          this.toast.error('Failed to update member', message);
        }
      });
    } else {
      this.api.createMember(data).subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm = false;
          this.toast.success('Member created', `${this.editing.name} has been added to the chama.`);
          this.loadMembers();
        },
        error: (err) => {
          this.saving.set(false);
          const message = err.error?.message || err.error?.error || 'An unexpected error occurred';
          this.toast.error('Failed to create member', message);
        }
      });
    }
  }

  async delete(m: Member) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Member',
      message: `Are you sure you want to remove ${m.name} from this chama? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (confirmed) {
      this.api.deleteMember(m.id).subscribe({
        next: () => {
          this.toast.success('Member deleted', `${m.name} has been removed from the chama.`);
          this.loadMembers();
        },
        error: (err) => {
          const message = err.error?.message || err.error?.error || 'An unexpected error occurred';
          this.toast.error('Failed to delete member', message);
        }
      });
    }
  }

  close() {
    this.showForm = false;
    this.formErrors.set({});
  }

  // ==================== MEMBER DETAIL MODAL ====================

  viewMember(m: Member) {
    this.selectedMember = m;
    this.memberSummary = null;
    this.detailTab = 'overview';
    this.showDetailModal = true;
    this.loadMemberSummary(m.id);
  }

  loadMemberSummary(memberId: number) {
    this.loadingSummary.set(true);
    this.api.getMemberFinancialSummary(memberId).subscribe({
      next: (summary) => {
        this.memberSummary = summary;
        this.loadingSummary.set(false);
      },
      error: (err) => {
        this.loadingSummary.set(false);
        this.toast.error('Failed to load member details', err.error?.message || 'Unknown error');
      }
    });
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedMember = null;
    this.memberSummary = null;
  }
}
