import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Member, MemberFinancialSummary, PageResponse, RegistrationFeePayment, RegistrationFeeInfo } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

interface MemberForm extends Partial<Member> {
  password?: string;
  passwordMode?: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

interface MemberWithRegFee extends Member {
  regFeeStatus?: 'PENDING' | 'AWAITING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | null;
  regFeePayment?: RegistrationFeePayment | null;
}

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './members.component.html',
})
export class MembersComponent implements OnInit {
  members: MemberWithRegFee[] = [];
  search = '';
  statusFilter = 'ALL';
  showForm = false;
  editing: MemberForm = {};
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  formErrors = signal<FormErrors>({});

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;
  Math = Math; // For template access

  // Member detail modal
  showDetailModal = false;
  selectedMember: MemberWithRegFee | null = null;
  memberSummary: MemberFinancialSummary | null = null;
  loadingSummary = signal(false);
  detailTab: 'overview' | 'loans' | 'fines' | 'payouts' | 'transactions' = 'overview';

  // Registration fee
  registrationFeeInfo: RegistrationFeeInfo | null = null;
  registrationFeePayments: Map<number, RegistrationFeePayment> = new Map();
  awaitingVerificationPayments: RegistrationFeePayment[] = [];
  awaitingVerificationCount = 0;
  showRegFeePayModal = false;
  regFeePayMember: MemberWithRegFee | null = null;
  regFeeReferenceNumber = '';
  submittingRegFee = signal(false);
  
  // Verification modal
  showVerificationModal = false;
  verifyingPayment: RegistrationFeePayment | null = null;
  rejectReason = '';
  verifyingAction = signal(false);
  showRejectModal = false;

  constructor(
    private api: ApiService, 
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.loadRegistrationFeeInfo();
    this.loadMembers();
  }

  loadRegistrationFeeInfo() {
    this.api.getRegistrationFeeInfo().subscribe({
      next: (info) => {
        this.registrationFeeInfo = info;
        if (info.required && info.amount > 0) {
          this.loadAllRegistrationFeePayments();
          if (this.session.can('VERIFY_REGISTRATION_FEE')) {
            this.loadAwaitingVerification();
          }
        }
      },
      error: () => {
        // Registration fee info not available
        this.registrationFeeInfo = null;
      }
    });
  }

  loadAllRegistrationFeePayments() {
    this.api.getAllRegistrationFeePayments().subscribe({
      next: (payments) => {
        this.registrationFeePayments.clear();
        payments.forEach(p => {
          this.registrationFeePayments.set(p.memberId, p);
        });
        // Update member registration fee status
        this.updateMembersRegFeeStatus();
      }
    });
  }

  loadAwaitingVerification() {
    this.api.getAwaitingVerificationPayments().subscribe({
      next: (payments) => {
        this.awaitingVerificationPayments = payments;
        this.awaitingVerificationCount = payments.length;
      }
    });
    this.api.countAwaitingVerification().subscribe({
      next: (response) => {
        this.awaitingVerificationCount = response.count;
      }
    });
  }

  updateMembersRegFeeStatus() {
    this.members.forEach(m => {
      const payment = this.registrationFeePayments.get(m.id);
      m.regFeePayment = payment || null;
      m.regFeeStatus = payment?.status || null;
    });
  }

  isRegFeeRequired(): boolean {
    return this.registrationFeeInfo?.required === true && (this.registrationFeeInfo?.amount || 0) > 0;
  }

  getRegFeeStatusClass(member: MemberWithRegFee): string {
    if (!this.isRegFeeRequired()) return '';
    const status = member.regFeeStatus;
    if (!status || status === 'PENDING') return 'reg-fee-unpaid';
    if (status === 'AWAITING_VERIFICATION') return 'reg-fee-awaiting';
    if (status === 'VERIFIED') return 'reg-fee-paid';
    if (status === 'REJECTED') return 'reg-fee-rejected';
    return '';
  }

  getRegFeeStatusLabel(member: MemberWithRegFee): string {
    if (!this.isRegFeeRequired()) return '';
    const status = member.regFeeStatus;
    if (!status || status === 'PENDING') return 'Unpaid';
    if (status === 'AWAITING_VERIFICATION') return 'Awaiting Verification';
    if (status === 'VERIFIED') return 'Paid';
    if (status === 'REJECTED') return 'Rejected';
    return '';
  }

  canPayRegFee(member: MemberWithRegFee): boolean {
    if (!this.isRegFeeRequired()) return false;
    const status = member.regFeeStatus;
    return !status || status === 'PENDING' || status === 'REJECTED';
  }

  openRegFeePayModal(member: MemberWithRegFee) {
    this.regFeePayMember = member;
    this.regFeeReferenceNumber = '';
    this.showRegFeePayModal = true;
  }

  closeRegFeePayModal() {
    this.showRegFeePayModal = false;
    this.regFeePayMember = null;
    this.regFeeReferenceNumber = '';
  }

  submitRegFeePayment() {
    if (!this.regFeePayMember || !this.regFeeReferenceNumber.trim()) {
      this.toast.warning('Reference required', 'Please enter a payment reference number.');
      return;
    }
    this.submittingRegFee.set(true);
    this.api.submitRegistrationFeePayment(this.regFeePayMember.id, this.regFeeReferenceNumber.trim()).subscribe({
      next: (payment) => {
        this.submittingRegFee.set(false);
        this.toast.success('Payment submitted', 'Your registration fee payment has been submitted for verification.');
        this.closeRegFeePayModal();
        this.loadAllRegistrationFeePayments();
        if (this.session.can('VERIFY_REGISTRATION_FEE')) {
          this.loadAwaitingVerification();
        }
      },
      error: (err) => {
        this.submittingRegFee.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Failed to submit payment.');
      }
    });
  }

  // Verification functions
  openVerificationModal(payment: RegistrationFeePayment) {
    this.verifyingPayment = payment;
    this.rejectReason = '';
    this.showVerificationModal = true;
  }

  closeVerificationModal() {
    this.showVerificationModal = false;
    this.verifyingPayment = null;
    this.rejectReason = '';
  }

  verifyPayment() {
    if (!this.verifyingPayment?.id) return;
    this.verifyingAction.set(true);
    this.api.verifyRegistrationFeePayment(this.verifyingPayment.id).subscribe({
      next: () => {
        this.verifyingAction.set(false);
        this.toast.success('Payment verified', 'Registration fee payment has been verified and recorded.');
        this.closeVerificationModal();
        this.loadAllRegistrationFeePayments();
        this.loadAwaitingVerification();
      },
      error: (err) => {
        this.verifyingAction.set(false);
        this.toast.error('Verification failed', err.error?.message || 'Failed to verify payment.');
      }
    });
  }

  rejectPayment() {
    if (!this.verifyingPayment?.id) return;
    if (!this.rejectReason.trim()) {
      this.toast.warning('Reason required', 'Please provide a reason for rejection.');
      return;
    }
    this.verifyingAction.set(true);
    this.api.rejectRegistrationFeePayment(this.verifyingPayment.id, this.rejectReason.trim()).subscribe({
      next: () => {
        this.verifyingAction.set(false);
        this.toast.success('Payment rejected', 'Registration fee payment has been rejected.');
        this.closeRejectModal();
        this.loadAllRegistrationFeePayments();
        this.loadAwaitingVerification();
      },
      error: (err) => {
        this.verifyingAction.set(false);
        this.toast.error('Rejection failed', err.error?.message || 'Failed to reject payment.');
      }
    });
  }

  openRejectModal(payment: RegistrationFeePayment) {
    this.verifyingPayment = payment;
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal() {
    this.showRejectModal = false;
    this.rejectReason = '';
  }

  loadMembers() {
    this.loading.set(true);
    this.error.set(null);
    const status = this.statusFilter === 'ALL' ? undefined : this.statusFilter;
    const searchTerm = this.search.trim() || undefined;
    
    this.api.getMembersPaginated(this.currentPage, this.pageSize, searchTerm, status).subscribe({
      next: (response: PageResponse<Member>) => {
        this.members = response.content as MemberWithRegFee[];
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loading.set(false);
        // Update registration fee status for loaded members
        this.updateMembersRegFeeStatus();
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

  onFilterChange() {
    this.currentPage = 0;
    this.loadMembers();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadMembers();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadMembers();
    }
  }

  prevPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadMembers();
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
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
    
    // Password validation (only for new members without passwordMode)
    if (!this.editing.id && !this.editing.passwordMode) {
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
    
    // Build the data object with only the fields we need
    const data: any = {
      name: this.editing.name,
      phone: this.editing.phone,
      email: this.editing.email,
      status: this.editing.status
    };
    
    // For new members, include password info
    if (!this.editing.id) {
      if (this.editing.passwordMode === 'default') {
        data.password = '12345678';
      } else if (this.editing.passwordMode === 'random') {
        data.sendEmail = true;
      } else if (this.editing.password) {
        data.password = this.editing.password;
      }
    } else {
      // For existing members, only include password if provided
      if (this.editing.password && this.editing.password.trim()) {
        data.password = this.editing.password;
      }
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
          let successMsg = `${this.editing.name} has been added to the chama.`;
          if (data.passwordMode === 'random') {
            successMsg += ' Login credentials have been sent to their email.';
          } else if (data.passwordMode === 'default') {
            successMsg += ' Default password is 12345678.';
          }
          this.toast.success('Member created', successMsg);
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
      message: `Are you sure you want to remove ${m.name} from this chama? This will mark them as Exited but keep their records.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (confirmed) {
      this.api.deleteMember(m.id).subscribe({
        next: () => {
          this.toast.success('Member removed', `${m.name} has been marked as Exited.`);
          this.loadMembers();
        },
        error: (err) => {
          const message = err.error?.message || err.error?.error || 'An unexpected error occurred';
          this.toast.error('Failed to delete member', message);
        }
      });
    }
  }

  async hardDelete(m: Member) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Permanently Delete Member',
      message: `⚠️ WARNING: This will PERMANENTLY delete ${m.name} and ALL their data including contributions, loans, fines, penalties, and transactions.\n\nThis action CANNOT be undone!`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (confirmed) {
      // Double confirmation for hard delete
      const doubleConfirmed = await this.confirmDialog.confirm({
        title: 'Final Confirmation',
        message: `Type DELETE to confirm permanent deletion of ${m.name} and all related data.`,
        confirmText: 'Yes, Delete Everything',
        cancelText: 'Cancel',
        type: 'danger'
      });
      
      if (doubleConfirmed) {
        this.api.hardDeleteMember(m.id).subscribe({
          next: () => {
            this.toast.success('Member permanently deleted', `${m.name} and all related data have been removed.`);
            this.loadMembers();
          },
          error: (err) => {
            const message = err.error?.message || err.error?.error || 'An unexpected error occurred';
            this.toast.error('Failed to delete member', message);
          }
        });
      }
    }
  }

  close() {
    this.showForm = false;
    this.formErrors.set({});
  }

  // ==================== MEMBER DETAIL MODAL ====================

  viewMember(m: MemberWithRegFee) {
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
