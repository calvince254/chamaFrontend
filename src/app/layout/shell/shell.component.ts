import { Component, computed, OnInit, OnDestroy, Signal, signal, HostListener, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../core/services/session.service';
import { IdleService } from '../../core/services/idle.service';
import { IconComponent } from '../../shared/icon.component';
import { CurrentUser } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { filter } from 'rxjs/operators';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  permissionCodes: string[];  // Any of these permission codes will show this nav item
}

interface License {
  id: number;
  status: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, IconComponent, FormsModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit, OnDestroy {
  memberNav: NavItem[] = [
    { label: 'Dashboard', path: '/app/dashboard', icon: 'grid', permissionCodes: ['VIEW_DASHBOARD'] },
    { label: 'Members', path: '/app/members', icon: 'users', permissionCodes: ['VIEW_MEMBERS', 'CREATE_MEMBER', 'EDIT_MEMBER', 'DELETE_MEMBER', 'DEACTIVATE_MEMBER', 'REACTIVATE_MEMBER'] },
    { label: 'Meetings', path: '/app/meetings', icon: 'calendar', permissionCodes: ['VIEW_MEETINGS', 'CREATE_MEETING', 'EDIT_MEETING', 'DELETE_MEETING', 'SCHEDULE_MEETING', 'RECORD_ATTENDANCE', 'VIEW_ATTENDANCE', 'MANAGE_MEETING_FINES'] },
    { label: 'Contributions', path: '/app/contributions', icon: 'wallet', permissionCodes: ['VIEW_CONTRIBUTIONS', 'CREATE_CONTRIBUTION', 'RECORD_CONTRIBUTION_PAYMENT', 'APPROVE_CONTRIBUTION', 'DELETE_CONTRIBUTION', 'VIEW_CONTRIBUTION_TYPES', 'CREATE_CONTRIBUTION_TYPE', 'EDIT_CONTRIBUTION_TYPE', 'DELETE_CONTRIBUTION_TYPE'] },
    { label: 'Loans', path: '/app/loans', icon: 'cash', permissionCodes: ['VIEW_LOANS', 'VIEW_MY_LOANS', 'APPLY_LOAN', 'APPROVE_LOAN', 'REJECT_LOAN', 'DISBURSE_LOAN', 'RECORD_LOAN_REPAYMENT', 'WAIVE_LOAN_PENALTY', 'VIEW_LOAN_PRODUCTS', 'CREATE_LOAN_PRODUCT', 'EDIT_LOAN_PRODUCT', 'DELETE_LOAN_PRODUCT'] },
    { label: 'Merry-Go-Round', path: '/app/merry-go-round', icon: 'refresh', permissionCodes: ['VIEW_MERRY_GO_ROUND', 'CREATE_MERRY_GO_ROUND', 'EDIT_MERRY_GO_ROUND', 'DELETE_MERRY_GO_ROUND', 'MANAGE_MERRY_GO_ROUND_ROUNDS'] },
    { label: 'Shares', path: '/app/shares', icon: 'pie', permissionCodes: ['VIEW_SHARES', 'CREATE_SHARE', 'TRANSFER_SHARE', 'EDIT_SHARE', 'DELETE_SHARE'] },
    { label: 'Welfare', path: '/app/welfare', icon: 'heart', permissionCodes: ['VIEW_WELFARE_EVENTS', 'CREATE_WELFARE_EVENT', 'EDIT_WELFARE_EVENT', 'DELETE_WELFARE_EVENT', 'APPROVE_WELFARE_DISBURSEMENT', 'CONTRIBUTE_WELFARE'] },
    { label: 'Investments', path: '/app/investments', icon: 'trending', permissionCodes: ['VIEW_INVESTMENTS', 'CREATE_INVESTMENT', 'EDIT_INVESTMENT', 'DELETE_INVESTMENT', 'CLOSE_INVESTMENT'] },
    { label: 'Finance', path: '/app/finance', icon: 'chart', permissionCodes: ['VIEW_FINANCE_SUMMARY', 'VIEW_TRANSACTIONS', 'CREATE_TRANSACTION', 'APPROVE_TRANSACTION', 'EDIT_TRANSACTION', 'DELETE_TRANSACTION'] },
    { label: 'Resources', path: '/app/resources', icon: 'folder', permissionCodes: ['VIEW_RESOURCES', 'UPLOAD_RESOURCE', 'DOWNLOAD_RESOURCE', 'EDIT_RESOURCE', 'DELETE_RESOURCE'] },
    { label: 'Billing', path: '/app/billing', icon: 'file-text', permissionCodes: ['VIEW_BILLING'] },
    { label: 'Audit Trail', path: '/app/audit-trail', icon: 'activity', permissionCodes: ['VIEW_AUDIT_LOGS', 'VIEW_AUDIT_DETAILS', 'VIEW_AUDIT_STATISTICS'] },
    { label: 'Roles & Rights', path: '/app/roles', icon: 'shield', permissionCodes: ['VIEW_ROLES', 'CREATE_ROLE', 'EDIT_ROLE', 'DELETE_ROLE', 'VIEW_PERMISSIONS', 'ASSIGN_ROLE'] },
    { label: 'Settings', path: '/app/settings', icon: 'gear', permissionCodes: ['VIEW_CONTRIBUTION_TYPES', 'VIEW_FINE_TYPES', 'VIEW_LOAN_PRODUCTS', 'VIEW_TENANT_SETTINGS', 'EDIT_TENANT_SETTINGS', 'CREATE_FINE_TYPE', 'EDIT_FINE_TYPE', 'DELETE_FINE_TYPE'] },
  ];

  superAdminNav: NavItem[] = [
    { label: 'Chamas', path: '/super-admin/chamas', icon: 'grid', permissionCodes: ['FULL_ACCESS'] },
    { label: 'Licenses', path: '/super-admin/licenses', icon: 'file-badge', permissionCodes: ['FULL_ACCESS'] },
    { label: 'Audit Trail', path: '/super-admin/audit-trail', icon: 'activity', permissionCodes: ['FULL_ACCESS'] }
  ];

  user: Signal<CurrentUser | null>;
  visibleNav: Signal<NavItem[]>;
  
  // License suspension state
  license = signal<License | null>(null);
  licenseLoading = signal(true);
  
  // Mobile menu state
  mobileMenuOpen = signal(false);
  
  // Password change modal state
  showPasswordChangeModal = signal(false);
  passwordChangeForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  passwordChangeError = signal('');
  passwordChanging = signal(false);
  
  // Session validation
  private platformId = inject(PLATFORM_ID);
  private sessionValidated = false;

  constructor(
    public session: SessionService, 
    private router: Router,
    private api: ApiService,
    private idleService: IdleService
  ) {
    this.user = this.session.currentUser;
    this.visibleNav = computed(() => {
      const u = this.session.currentUser();
      if (!u) return [];
      if (u.isSuperAdmin) return this.superAdminNav;
      
      // If license is suspended, only show billing for admins
      const lic = this.license();
      if (lic?.status === 'SUSPENDED' && this.isAdmin()) {
        return this.memberNav.filter(item => item.label === 'Billing');
      }
      
      // Filter nav items - show if user has ANY of the permission codes for that module
      // Dashboard is always visible for authenticated users
      // Items with empty permissionCodes are visible to all authenticated users
      return this.memberNav.filter(item => 
        item.label === 'Dashboard' || 
        item.permissionCodes.length === 0 ||
        this.session.canAny(...item.permissionCodes)
      );
    });
    
    // Check if password change is required after login
    if (this.session.mustChangePassword()) {
      this.showPasswordChangeModal.set(true);
    }
    
    // Listen for navigation changes to enforce license suspension
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkLicenseSuspension(event.url);
    });
  }

  ngOnInit() {
    // Validate session on app init (check if token is still valid)
    this.validateSessionOnInit();
    
    this.loadLicenseStatus();
    
    // Start idle monitoring if session timeout is configured
    const timeout = this.session.sessionTimeoutMinutes();
    if (timeout > 0) {
      this.idleService.startWatching(timeout);
    }
  }

  /**
   * Validate session when tab becomes visible (user returns to tab)
   */
  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (document.visibilityState === 'visible' && this.session.isLoggedIn()) {
      // Check token expiry first (fast, no API call)
      if (this.session.isTokenExpired()) {
        console.log('Token expired on tab focus, logging out');
        this.forceLogout('Token expired. Please log in again.');
        return;
      }
      
      // Validate with backend every time tab becomes visible
      this.session.validateSession().subscribe(valid => {
        if (!valid) {
          this.forceLogout('Session expired. Please log in again.');
        }
      });
    }
  }

  /**
   * Validate session on app initialization
   */
  private validateSessionOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.session.isLoggedIn()) return;
    
    // Check token expiry first
    if (this.session.isTokenExpired()) {
      console.log('Token expired on init, logging out');
      this.forceLogout('Session expired. Please log in again.');
      return;
    }
    
    // Validate with backend
    this.session.validateSession().subscribe(valid => {
      if (!valid) {
        this.forceLogout('Session expired. Please log in again.');
      } else {
        this.sessionValidated = true;
        // Restart idle monitoring with potentially updated timeout
        const timeout = this.session.sessionTimeoutMinutes();
        if (timeout > 0) {
          this.idleService.startWatching(timeout);
        }
      }
    });
  }

  /**
   * Force logout and redirect to login with message
   */
  private forceLogout(message: string) {
    this.idleService.stopWatching();
    this.session.logout();
    this.router.navigate(['/login'], { 
      queryParams: { sessionExpired: 'true', message: message } 
    });
  }

  ngOnDestroy() {
    this.idleService.stopWatching();
  }

  loadLicenseStatus() {
    const u = this.session.currentUser();
    // Only load license for non-super-admin users
    if (u && !u.isSuperAdmin) {
      this.licenseLoading.set(true);
      this.api.getMyLicense().subscribe({
        next: (license) => {
          this.license.set(license);
          this.licenseLoading.set(false);
          // Check current route for suspension
          this.checkLicenseSuspension(this.router.url);
        },
        error: () => {
          this.license.set(null);
          this.licenseLoading.set(false);
        }
      });
    } else {
      this.licenseLoading.set(false);
    }
  }

  checkLicenseSuspension(currentUrl: string) {
    const lic = this.license();
    if (lic?.status === 'SUSPENDED') {
      // If admin and not on billing page, redirect to billing
      if (this.isAdmin() && !currentUrl.includes('/billing')) {
        this.router.navigate(['/app/billing']);
      }
    }
  }

  isAdmin(): boolean {
    // Check if user has admin-level permissions (can access billing or manage settings)
    return this.session.canAny('VIEW_BILLING', 'EDIT_TENANT_SETTINGS', 'VIEW_TENANT_SETTINGS');
  }

  isMemberOnly(): boolean {
    // Regular member without admin permissions
    return !this.isAdmin() && !this.session.currentUser()?.isSuperAdmin;
  }

  get isLicenseSuspended(): boolean {
    return this.license()?.status === 'SUSPENDED';
  }

  get showSuspendedOverlay(): boolean {
    // Show overlay only for non-admin members when license is suspended
    return this.isLicenseSuspended && this.isMemberOnly() && !this.licenseLoading();
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  logout() {
    // Stop idle monitoring
    this.idleService.stopWatching();
    
    // Call backend to blacklist the token
    this.api.logout().subscribe({
      complete: () => {
        this.session.logout();
        this.router.navigate(['/login']);
      },
      error: () => {
        // Even if backend call fails, still logout locally
        this.session.logout();
        this.router.navigate(['/login']);
      }
    });
  }

  // Password change methods
  submitPasswordChange() {
    if (!this.passwordChangeForm.currentPassword || !this.passwordChangeForm.newPassword || !this.passwordChangeForm.confirmPassword) {
      this.passwordChangeError.set('All fields are required');
      return;
    }
    
    if (this.passwordChangeForm.newPassword.length < 6) {
      this.passwordChangeError.set('New password must be at least 6 characters');
      return;
    }
    
    if (this.passwordChangeForm.newPassword !== this.passwordChangeForm.confirmPassword) {
      this.passwordChangeError.set('Passwords do not match');
      return;
    }
    
    this.passwordChanging.set(true);
    this.passwordChangeError.set('');
    
    this.session.changePassword(
      this.passwordChangeForm.currentPassword,
      this.passwordChangeForm.newPassword,
      this.passwordChangeForm.confirmPassword
    ).subscribe({
      next: () => {
        this.passwordChanging.set(false);
        this.showPasswordChangeModal.set(false);
        this.resetPasswordForm();
      },
      error: (err) => {
        this.passwordChanging.set(false);
        this.passwordChangeError.set(err.error?.message || err.message || 'Failed to change password');
      }
    });
  }
  
  resetPasswordForm() {
    this.passwordChangeForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    this.passwordChangeError.set('');
  }
}
