import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { Member, MemberFinancialSummary, PageResponse, RegistrationFeePayment, RegistrationFeeInfo, EnabledPaymentMethods, PaymentMethod, InitiatePaymentRequest, InitiatePaymentResponse } from '../../core/models/models';
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
  regFeePhoneNumber = '';
  selectedPaymentMethod: PaymentMethod = 'MANUAL';
  enabledPaymentMethods: EnabledPaymentMethods | null = null;
  submittingRegFee = signal(false);
  paymentResponse: InitiatePaymentResponse | null = null;
  
  // Pending payment claims (for admin to verify)
  pendingPaymentClaims: InitiatePaymentResponse[] = [];
  
  // Verification modal
  showVerificationModal = false;
  verifyingPayment: RegistrationFeePayment | null = null;
  verifyingClaim: InitiatePaymentResponse | null = null;
  rejectReason = '';
  verifyingAction = signal(false);
  showRejectModal = false;

  // Reset password modal
  showResetPasswordModal = false;
  resetPasswordMember: MemberWithRegFee | null = null;
  selectedResetPassword = '12345678';
  resetPasswordOptions = ['12345678', 'password123', 'Welcome@123', 'Chama@2024'];
  resettingPassword = signal(false);

  constructor(
    private api: ApiService, 
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.initializeData();
  }

  /**
   * Initialize data - loads reg fee info, payments, and members together
   * to ensure reg fee status is properly displayed without needing refresh
   */
  initializeData() {
    this.loading.set(true);
    
    // First, load registration fee info to know if we need payments
    this.api.getRegistrationFeeInfo().pipe(
      catchError(() => of(null))
    ).subscribe({
      next: (info) => {
        this.registrationFeeInfo = info;
        
        if (info?.required && info?.amount > 0) {
          // Load members and payments together
          this.loadMembersWithPayments();
          if (this.session.can('VERIFY_REGISTRATION_FEE')) {
            this.loadAwaitingVerification();
          }
        } else {
          // No reg fee required, just load members
          this.loadMembers();
        }
      }
    });
  }

  /**
   * Load members and registration fee payments together using forkJoin
   * This ensures both are available before updating the UI
   */
  loadMembersWithPayments() {
    this.loading.set(true);
    const status = this.statusFilter === 'ALL' ? undefined : this.statusFilter;
    const searchTerm = this.search.trim() || undefined;

    forkJoin({
      members: this.api.getMembersPaginated(this.currentPage, this.pageSize, searchTerm, status),
      payments: this.api.getAllRegistrationFeePayments().pipe(catchError(() => of([] as RegistrationFeePayment[])))
    }).subscribe({
      next: ({ members, payments }) => {
        // Update members
        this.members = members.content as MemberWithRegFee[];
        this.totalElements = members.totalElements;
        this.totalPages = members.totalPages;
        this.isFirst = members.first;
        this.isLast = members.last;

        // Update payments map
        this.registrationFeePayments.clear();
        payments.forEach(p => {
          this.registrationFeePayments.set(p.memberId, p);
        });

        // Now update member statuses - both data sources are ready
        this.updateMembersRegFeeStatus();
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

  loadRegistrationFeeInfo() {
    this.api.getRegistrationFeeInfo().subscribe({
      next: (info) => {
        this.registrationFeeInfo = info;
        if (info.required && info.amount > 0) {
          // Load payments, which will update member statuses when complete
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
        console.log('=== Registration Fee Payments loaded ===');
        console.log('Payments:', payments);
        payments.forEach(p => {
          console.log(`Member ${p.memberId}: status=${p.status}, hasPendingClaim=${p.hasPendingClaim}, payableId=${p.payableId}`);
        });
        this.registrationFeePayments.clear();
        payments.forEach(p => {
          this.registrationFeePayments.set(p.memberId, p);
        });
        // Update member registration fee status - this will update even if members loaded first
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

  /**
   * Check if the given member is the currently logged-in user
   */
  isCurrentUser(member: MemberWithRegFee): boolean {
    const currentUser = this.session.currentUser();
    return currentUser !== null && currentUser.id === member.id;
  }

  /**
   * Check if the current user can pay registration fee for this member.
   * - PAY_ALL_REGISTRATION_FEE: Can pay for ANY member
   * - PAY_REGISTRATION_FEE: Can ONLY pay for their own
   */
  canPayRegFee(member: MemberWithRegFee): boolean {
    if (!this.isRegFeeRequired()) return false;
    const status = member.regFeeStatus;
    const isUnpaid = !status || status === 'PENDING' || status === 'REJECTED';
    if (!isUnpaid) return false;

    // Check permissions
    if (this.session.can('PAY_ALL_REGISTRATION_FEE')) {
      return true; // Admin can pay for anyone
    }
    if (this.session.can('PAY_REGISTRATION_FEE') && this.isCurrentUser(member)) {
      return true; // Regular member can only pay their own
    }
    return false;
  }

  openRegFeePayModal(member: MemberWithRegFee) {
    this.regFeePayMember = member;
    this.regFeeReferenceNumber = '';
    this.regFeePhoneNumber = member.phone || '';
    this.selectedPaymentMethod = 'MANUAL';
    this.paymentResponse = null;
    this.showRegFeePayModal = true;
    
    // Load enabled payment methods
    this.api.getEnabledPaymentMethods().subscribe({
      next: (methods) => {
        this.enabledPaymentMethods = methods;
        // Set default method if available
        if (methods.defaultMethod) {
          this.selectedPaymentMethod = methods.defaultMethod;
        } else if (methods.manualEnabled) {
          this.selectedPaymentMethod = 'MANUAL';
        } else if (methods.stkPushEnabled) {
          this.selectedPaymentMethod = 'STK_PUSH';
        } else if (methods.inAppSmsEnabled) {
          this.selectedPaymentMethod = 'IN_APP_SMS';
        }
      },
      error: () => {
        // Default to MANUAL if can't load methods
        this.enabledPaymentMethods = { manualEnabled: true, stkPushEnabled: false, inAppSmsEnabled: false };
      }
    });
  }

  closeRegFeePayModal() {
    this.showRegFeePayModal = false;
    this.regFeePayMember = null;
    this.regFeeReferenceNumber = '';
    this.regFeePhoneNumber = '';
    this.paymentResponse = null;
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    switch (method) {
      case 'MANUAL': return 'Manual (Enter Reference)';
      case 'STK_PUSH': return 'M-PESA STK Push';
      case 'IN_APP_SMS': return 'In-App SMS Verification';
      default: return method;
    }
  }

  getPaymentMethodDescription(method: PaymentMethod): string {
    switch (method) {
      case 'MANUAL': return 'Pay via M-PESA or bank transfer, then enter the transaction reference for admin verification.';
      case 'STK_PUSH': return 'Receive an M-PESA prompt on your phone to complete payment automatically.';
      case 'IN_APP_SMS': return 'Complete payment and capture the confirmation SMS for automatic verification.';
      default: return '';
    }
  }

  isPaymentMethodEnabled(method: PaymentMethod): boolean {
    if (!this.enabledPaymentMethods) return method === 'MANUAL';
    switch (method) {
      case 'MANUAL': return this.enabledPaymentMethods.manualEnabled;
      case 'STK_PUSH': return this.enabledPaymentMethods.stkPushEnabled;
      case 'IN_APP_SMS': return this.enabledPaymentMethods.inAppSmsEnabled;
      default: return false;
    }
  }

  canSubmitPayment(): boolean {
    if (!this.regFeePayMember) return false;
    if (this.selectedPaymentMethod === 'MANUAL' && !this.regFeeReferenceNumber.trim()) return false;
    if (this.selectedPaymentMethod === 'STK_PUSH' && !this.regFeePhoneNumber.trim()) return false;
    return true;
  }

  submitRegFeePayment() {
    if (!this.regFeePayMember) return;
    
    // Validate based on method
    if (this.selectedPaymentMethod === 'MANUAL' && !this.regFeeReferenceNumber.trim()) {
      this.toast.warning('Reference required', 'Please enter a payment reference number.');
      return;
    }
    if (this.selectedPaymentMethod === 'STK_PUSH' && !this.regFeePhoneNumber.trim()) {
      this.toast.warning('Phone required', 'Please enter the phone number for M-PESA.');
      return;
    }
    
    this.submittingRegFee.set(true);
    
    const request: InitiatePaymentRequest = {
      paymentType: 'REGISTRATION_FEE',
      referenceId: this.regFeePayMember.id,
      payerMemberId: this.regFeePayMember.id,
      paymentMethod: this.selectedPaymentMethod,
      referenceCode: this.selectedPaymentMethod === 'MANUAL' ? this.regFeeReferenceNumber.trim() : undefined,
      phoneNumber: this.selectedPaymentMethod === 'STK_PUSH' ? this.regFeePhoneNumber.trim() : undefined
    };
    
    this.api.initiatePayment(request).subscribe({
      next: (response) => {
        this.submittingRegFee.set(false);
        this.paymentResponse = response;
        
        if (response.awaitingVerification) {
          this.toast.success('Payment submitted', 'Your payment has been submitted and is awaiting admin verification.');
          this.closeRegFeePayModal();
          this.loadAllRegistrationFeePayments();
          if (this.session.can('VERIFY_REGISTRATION_FEE')) {
            this.loadAwaitingVerification();
          }
        } else if (response.status === 'STK_INITIATED') {
          this.toast.info('Check your phone', 'An M-PESA prompt has been sent to your phone. Complete the payment.');
          // Keep modal open to show status, could poll for completion
        } else if (response.status === 'MATCHED') {
          this.toast.success('Payment confirmed!', 'Your registration fee payment has been confirmed.');
          this.closeRegFeePayModal();
          this.loadAllRegistrationFeePayments();
        } else {
          this.toast.info('Payment processing', response.statusMessage);
        }
      },
      error: (err) => {
        this.submittingRegFee.set(false);
        this.toast.error('Payment failed', err.error?.message || 'Failed to process payment.');
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
    // If reg fee is required, use the combined loading method to ensure status is correct
    if (this.isRegFeeRequired()) {
      this.loadMembersWithPayments();
      return;
    }

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

  // ==================== RESET PASSWORD ====================

  openResetPasswordModal(m: MemberWithRegFee) {
    this.resetPasswordMember = m;
    this.selectedResetPassword = '12345678';
    this.showResetPasswordModal = true;
  }

  closeResetPasswordModal() {
    this.showResetPasswordModal = false;
    this.resetPasswordMember = null;
    this.selectedResetPassword = '12345678';
  }

  confirmResetPassword() {
    if (!this.resetPasswordMember || !this.selectedResetPassword) return;
    
    this.resettingPassword.set(true);
    this.api.resetMemberPassword(this.resetPasswordMember.id, this.selectedResetPassword).subscribe({
      next: (response) => {
        this.resettingPassword.set(false);
        this.toast.success('Password Reset', `${this.resetPasswordMember?.name}'s password has been reset. They will be required to change it on next login.`);
        this.closeResetPasswordModal();
      },
      error: (err) => {
        this.resettingPassword.set(false);
        const message = err.error?.message || err.error?.error || 'Failed to reset password';
        this.toast.error('Reset Failed', message);
      }
    });
  }
}
