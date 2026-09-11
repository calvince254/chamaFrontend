import { Component, computed, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { CurrentUser } from '../../core/models/models';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  permissionCodes: string[];  // Any of these permission codes will show this nav item
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
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
    { label: 'Roles & Rights', path: '/app/roles', icon: 'shield', permissionCodes: ['VIEW_ROLES', 'CREATE_ROLE', 'EDIT_ROLE', 'DELETE_ROLE', 'VIEW_PERMISSIONS', 'ASSIGN_ROLE'] },
    { label: 'Settings', path: '/app/settings', icon: 'gear', permissionCodes: ['VIEW_CONTRIBUTION_TYPES', 'VIEW_FINE_TYPES', 'VIEW_LOAN_PRODUCTS', 'VIEW_TENANT_SETTINGS', 'EDIT_TENANT_SETTINGS', 'CREATE_FINE_TYPE', 'EDIT_FINE_TYPE', 'DELETE_FINE_TYPE'] },
  ];

  superAdminNav: NavItem[] = [{ label: 'Chamas', path: '/super-admin/chamas', icon: 'grid', permissionCodes: ['FULL_ACCESS'] }];

  user: Signal<CurrentUser | null>;
  visibleNav: Signal<NavItem[]>;
  
  // Mobile menu state
  mobileMenuOpen = signal(false);

  constructor(private session: SessionService, private router: Router) {
    this.user = this.session.currentUser;
    this.visibleNav = computed(() => {
      const u = this.session.currentUser();
      if (!u) return [];
      if (u.isSuperAdmin) return this.superAdminNav;
      
      // Filter nav items - show if user has ANY of the permission codes for that module
      // Dashboard is always visible for authenticated users
      return this.memberNav.filter(item => 
        item.label === 'Dashboard' || this.session.canAny(...item.permissionCodes)
      );
    });
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  logout() {
    this.session.logout();
    this.router.navigate(['/login']);
  }
}
