import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Role } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import {
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective,
  LabelValueComponent,
  CollapsibleSectionComponent,
  CollapsedContentDirective,
  ExpandedContentDirective
} from '../../shared/components';

/**
 * Module permissions structure from the backend
 */
interface ModulePermissions {
  module: string;
  permissions: PermissionItem[];
  expanded?: boolean;  // Track if module is expanded
}

interface PermissionItem {
  code: string;
  displayName: string;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ListRowCardComponent, ListRowSecondaryDirective, ListRowFooterDirective, LabelValueComponent, CollapsibleSectionComponent, CollapsedContentDirective, ExpandedContentDirective],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css',
})
export class RolesComponent implements OnInit {
  roles: Role[] = [];
  selected?: Role & { permissionCodes?: string[] };
  showForm = false;
  newRoleName = '';
  
  // Available permissions from backend
  availablePermissions: ModulePermissions[] = [];
  
  // Selected permission codes for new role
  draftPermissionCodes: Set<string> = new Set();
  
  // Selected permission codes for editing existing role
  selectedPermissionCodes: Set<string> = new Set();
  
  saving = signal(false);
  savingPermissions = signal(false);
  loading = true;
  loadingPermissions = true;
  
  // Track if permissions have been modified
  permissionsModified = false;

  private api = inject(ApiService);
  session = inject(SessionService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmDialogService);

  ngOnInit() {
    // Only load data if user has permission to view roles
    if (this.session.can('VIEW_ROLES') || this.session.can('CREATE_ROLE')) {
      this.loadAvailablePermissions();
      this.loadRoles();
    }
  }

  loadAvailablePermissions() {
    this.loadingPermissions = true;
    this.api.getAvailablePermissions().subscribe({
      next: (permissions) => {
        // Add expanded property to each module, default first one to expanded
        this.availablePermissions = permissions.map((p, index) => ({
          ...p,
          expanded: index === 0  // Expand the first module by default
        }));
        this.loadingPermissions = false;
      },
      error: (err) => {
        if (err.status !== 403) {
          console.error('Failed to load available permissions:', err);
        }
        this.loadingPermissions = false;
      }
    });
  }

  loadRoles() {
    this.loading = true;
    this.api.getRoles().subscribe({
      next: (r) => {
        this.roles = r;
        if (r.length > 0) {
          this.selectRole(r[0]);
        }
        this.loading = false;
      },
      error: () => {
        this.roles = [];
        this.loading = false;
      }
    });
  }

  async selectRole(r: Role & { permissionCodes?: string[] }) {
    // If there are unsaved changes, warn user
    if (this.permissionsModified && this.selected) {
      const confirmed = await this.confirm.action(
        'Unsaved Changes',
        'You have unsaved changes. Discard them?'
      );
      if (!confirmed) return;
    }
    
    this.selected = r;
    this.permissionsModified = false;
    
    // Load the role's permission codes into the set
    this.selectedPermissionCodes = new Set(r.permissionCodes || []);
  }

  openNewRole() {
    this.newRoleName = '';
    this.draftPermissionCodes = new Set();
    // Pre-select VIEW_DASHBOARD by default
    this.draftPermissionCodes.add('VIEW_DASHBOARD');
    this.showForm = true;
  }

  /**
   * Toggle a permission for the selected role
   */
  togglePermission(code: string) {
    if (this.selected?.isSystemDefault) {
      return; // Can't edit system default roles
    }
    
    if (this.selectedPermissionCodes.has(code)) {
      this.selectedPermissionCodes.delete(code);
    } else {
      this.selectedPermissionCodes.add(code);
    }
    this.permissionsModified = true;
  }

  /**
   * Toggle a permission for new role creation
   */
  toggleDraftPermission(code: string) {
    if (this.draftPermissionCodes.has(code)) {
      this.draftPermissionCodes.delete(code);
    } else {
      this.draftPermissionCodes.add(code);
    }
  }

  /**
   * Check if a permission is selected for the current role
   */
  hasPermission(code: string): boolean {
    return this.selectedPermissionCodes.has(code);
  }

  /**
   * Check if a permission is selected for new role
   */
  hasDraftPermission(code: string): boolean {
    return this.draftPermissionCodes.has(code);
  }

  /**
   * Select all permissions in a module
   */
  selectAllInModule(module: ModulePermissions) {
    module.permissions.forEach(p => {
      this.selectedPermissionCodes.add(p.code);
    });
    this.permissionsModified = true;
  }

  /**
   * Deselect all permissions in a module
   */
  deselectAllInModule(module: ModulePermissions) {
    module.permissions.forEach(p => {
      this.selectedPermissionCodes.delete(p.code);
    });
    this.permissionsModified = true;
  }

  /**
   * Check if all permissions in a module are selected
   */
  allSelectedInModule(module: ModulePermissions): boolean {
    return module.permissions.every(p => this.selectedPermissionCodes.has(p.code));
  }

  /**
   * Check if some (but not all) permissions in a module are selected
   */
  someSelectedInModule(module: ModulePermissions): boolean {
    const count = module.permissions.filter(p => this.selectedPermissionCodes.has(p.code)).length;
    return count > 0 && count < module.permissions.length;
  }

  /**
   * Save permissions for the selected role
   */
  savePermissions() {
    if (!this.selected || this.selected.isSystemDefault) {
      return;
    }
    
    this.savingPermissions.set(true);
    const codes = Array.from(this.selectedPermissionCodes);
    
    this.api.updateRolePermissionCodes(this.selected.id, codes).subscribe({
      next: (updatedRole) => {
        this.savingPermissions.set(false);
        this.permissionsModified = false;
        // Update the role in the list
        if (this.selected) {
          this.selected.permissionCodes = codes;
        }
        this.toast.success('Permissions saved', `Permissions for "${this.selected?.name}" have been updated.`);
      },
      error: (err) => {
        this.savingPermissions.set(false);
        this.toast.error('Failed to save', err.error?.message || 'Please try again.');
      }
    });
  }

  /**
   * Create a new role
   */
  saveRole() {
    if (!this.newRoleName.trim()) {
      this.toast.warning('Missing name', 'Please enter a role name.');
      return;
    }
    
    this.saving.set(true);
    const roleData: any = {
      name: this.newRoleName.trim(),
      permissionCodes: Array.from(this.draftPermissionCodes)
    };
    
    this.api.createRole(roleData).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.toast.success('Role created', `"${this.newRoleName}" has been created.`);
        this.loadRoles();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Failed to create role', err.error?.message || 'Please try again.');
      }
    });
  }

  /**
   * Discard changes and reload
   */
  discardChanges() {
    if (this.selected) {
      this.selectedPermissionCodes = new Set(this.selected.permissionCodes || []);
      this.permissionsModified = false;
    }
  }

  /**
   * Toggle module expansion (accordion behavior - only one at a time)
   */
  toggleModule(module: ModulePermissions) {
    // If clicking the currently expanded module, close it
    if (module.expanded) {
      module.expanded = false;
    } else {
      // Close all other modules first
      this.availablePermissions.forEach(m => m.expanded = false);
      // Then open the clicked one
      module.expanded = true;
    }
  }

  /**
   * Get count of selected permissions for a module
   */
  getModuleSelectedCount(module: ModulePermissions): number {
    return module.permissions.filter(p => this.selectedPermissionCodes.has(p.code)).length;
  }

  /**
   * Get icon name for a module
   */
  getModuleIcon(moduleName: string): string {
    const iconMap: Record<string, string> = {
      'Dashboard': 'layout',
      'Members': 'users',
      'Contributions': 'wallet',
      'Loans': 'credit-card',
      'Meetings': 'calendar',
      'Welfare': 'heart',
      'Finance': 'bar-chart',
      'Shares': 'pie-chart',
      'Payouts': 'dollar-sign',
      'Investments': 'trending-up',
      'Merry-Go-Round': 'refresh-cw',
      'Fines': 'percent',
      'Penalties': 'percent',
      'Roles': 'shield',
      'Settings': 'settings',
      'Billing': 'file-text'
    };
    return iconMap[moduleName] || 'folder';
  }

  // ==================== Mobile Helpers ====================

  handleMobileRoleAction(role: Role & { permissionCodes?: string[] }) {
    this.selectRole(role);
  }

  getMobileRoleActionLabel(role: Role): string {
    return 'View Permissions';
  }

  getTotalPermissionCount(): number {
    return this.availablePermissions.reduce((sum, m) => sum + m.permissions.length, 0);
  }

  getRolePermissionCount(role: Role & { permissionCodes?: string[] }): number {
    if (role.isSystemDefault) {
      return this.getTotalPermissionCount();
    }
    return role.permissionCodes?.length || 0;
  }
}
