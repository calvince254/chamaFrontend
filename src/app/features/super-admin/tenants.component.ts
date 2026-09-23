import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Tenant } from '../../core/models/models';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

interface CreateTenantForm {
  name: string;
  code: string;
  contactEmail: string;
  contactPhone: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  adminRoleName: string;  // Role for the first member (Admin, Treasurer, Secretary, Member)
}

interface TenantMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleId: number;
  status: string;
  joinDate: string;
}

interface TenantRole {
  id: number;
  name: string;
}

interface FormErrors {
  name?: string;
  contactEmail?: string;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './tenants.component.html',
  styleUrl: './tenants.component.css',
})
export class TenantsComponent implements OnInit {
  tenants: Tenant[] = [];
  showForm = false;
  draft: CreateTenantForm = this.getEmptyForm();
  saving = signal(false);
  loading = true;
  error = signal<string | null>(null);
  formErrors: FormErrors = {};

  // Expanded chama details
  expandedTenantId: number | null = null;
  tenantMembers: TenantMember[] = [];
  tenantRoles: TenantRole[] = [];
  loadingMembers = false;

  // Delete confirmation
  showDeleteConfirm = false;
  tenantToDelete: Tenant | null = null;
  deleting = signal(false);

  // Success message
  successMessage = signal<string | null>(null);

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.loadTenants();
  }

  getEmptyForm(): CreateTenantForm {
    return {
      name: '',
      code: '',
      contactEmail: '',
      contactPhone: '',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: '',
      adminRoleName: 'Admin'  // Default to Admin role
    };
  }

  // Available role names for dropdown
  availableRoleNames = ['Admin', 'Treasurer', 'Secretary', 'Member'];

  loadTenants() {
    this.loading = true;
    this.loadError = null;
    this.api.getTenants().subscribe({
      next: (t) => {
        this.tenants = t;
        this.loading = false;
      },
      error: (err) => {
        this.tenants = [];
        this.loading = false;
        
        // Show meaningful error in UI based on status code
        if (err.status === 403) {
          this.loadError = 'Access Denied. You don\'t have permission to view this page. Please login as a super admin.';
        } else if (err.status === 401) {
          this.loadError = 'Session expired. Please login again.';
        } else {
          this.loadError = 'Failed to load chamas. Please check your connection and try again.';
        }
      }
    });
  }

  // Error message for load failures
  loadError: string | null = null;

  get activeCount() { return this.tenants.filter((t) => t.status === 'ACTIVE').length; }
  get totalMembers() { return this.tenants.reduce((s, t) => s + t.memberCount, 0); }

  openNew() {
    this.draft = this.getEmptyForm();
    this.error.set(null);
    this.formErrors = {};
    this.showForm = true;
  }

  validateForm(): boolean {
    this.formErrors = {};
    let valid = true;

    // Chama name
    if (!this.draft.name || this.draft.name.trim().length < 3) {
      this.formErrors.name = 'Chama name must be at least 3 characters';
      valid = false;
    }

    // Contact email
    if (!this.draft.contactEmail || !this.isValidEmail(this.draft.contactEmail)) {
      this.formErrors.contactEmail = 'Please enter a valid email address';
      valid = false;
    }

    // Admin name
    if (!this.draft.adminName || this.draft.adminName.trim().length < 2) {
      this.formErrors.adminName = 'Admin name must be at least 2 characters';
      valid = false;
    }

    // Admin email
    if (!this.draft.adminEmail || !this.isValidEmail(this.draft.adminEmail)) {
      this.formErrors.adminEmail = 'Please enter a valid admin email';
      valid = false;
    }

    // Admin password
    if (!this.draft.adminPassword || this.draft.adminPassword.length < 6) {
      this.formErrors.adminPassword = 'Password must be at least 6 characters';
      valid = false;
    }

    return valid;
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  save() {
    if (!this.validateForm()) {
      this.toast.warning('Please fix the errors', 'Check the form for validation errors.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    
    // Auto-generate code from name if not provided
    if (!this.draft.code) {
      this.draft.code = this.draft.name.toLowerCase().replace(/\s+/g, '-');
    }
    
    this.api.createTenant(this.draft).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.showForm = false;
        this.toast.success('Chama created!', `"${created.name}" has been created successfully.`);
        
        // Add the new tenant to the list immediately
        this.tenants = [...this.tenants, created];
        this.loading = false;
      },
      error: (err) => {
        this.saving.set(false);
        console.error('Failed to create tenant:', err);
        const message = err.error?.message || err.message || 'Failed to create chama';
        this.error.set(message);
        this.toast.error('Failed to create chama', message);
      }
    });
  }

  // Expand/collapse tenant details
  toggleExpand(tenant: Tenant) {
    if (this.expandedTenantId === tenant.id) {
      this.expandedTenantId = null;
      this.tenantMembers = [];
    } else {
      this.expandedTenantId = tenant.id;
      this.loadTenantMembers(tenant.id);
    }
  }

  loadTenantMembers(tenantId: number) {
    this.loadingMembers = true;
    this.api.getTenantMembers(tenantId).subscribe({
      next: (members) => {
        this.tenantMembers = members;
        this.loadingMembers = false;
      },
      error: () => {
        this.tenantMembers = [];
        this.loadingMembers = false;
      }
    });

    this.api.getTenantRoles(tenantId).subscribe({
      next: (roles) => this.tenantRoles = roles,
      error: () => this.tenantRoles = []
    });
  }

  // Delete confirmation
  async confirmDelete(tenant: Tenant) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Chama',
      message: `Are you sure you want to delete "${tenant.name}"? This will permanently remove all members, transactions, and data associated with this chama. This action cannot be undone.`,
      confirmText: 'Delete Chama',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (confirmed) {
      this.deleteTenantAction(tenant);
    }
  }

  cancelDelete() {
    this.tenantToDelete = null;
    this.showDeleteConfirm = false;
  }

  private deleteTenantAction(tenant: Tenant) {
    this.deleting.set(true);
    this.api.deleteTenant(tenant.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.expandedTenantId = null;
        this.toast.success('Chama deleted', `"${tenant.name}" has been permanently deleted.`);
        this.loadTenants();
      },
      error: (err) => {
        this.deleting.set(false);
        this.toast.error('Failed to delete chama', err.error?.message || 'An error occurred');
      }
    });
  }

  deleteTenant() {
    if (!this.tenantToDelete) return;
    this.deleteTenantAction(this.tenantToDelete);
    this.showDeleteConfirm = false;
    this.tenantToDelete = null;
  }

  // Update member role
  updateMemberRole(member: TenantMember, newRoleId: number) {
    if (!this.expandedTenantId) return;
    
    this.api.updateMemberRole(this.expandedTenantId, member.id, newRoleId).subscribe({
      next: (updated) => {
        const idx = this.tenantMembers.findIndex(m => m.id === member.id);
        if (idx >= 0) {
          this.tenantMembers[idx] = updated;
        }
        this.toast.success('Role updated', `${member.name}'s role has been updated.`);
      },
      error: (err) => {
        this.toast.error('Failed to update role', err.error?.message || 'An error occurred');
      }
    });
  }

  // Remove member
  async removeMember(member: TenantMember) {
    if (!this.expandedTenantId) return;
    
    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove Member',
      message: `Remove ${member.name} from this chama? This will delete all their data including contributions, loans, and shares.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger'
    });
    
    if (!confirmed) return;
    
    this.api.removeMemberFromTenant(this.expandedTenantId, member.id).subscribe({
      next: () => {
        this.tenantMembers = this.tenantMembers.filter(m => m.id !== member.id);
        this.toast.success('Member removed', `${member.name} has been removed from this chama.`);
        this.loadTenants(); // Refresh member count
      },
      error: (err) => {
        this.toast.error('Failed to remove member', err.error?.message || 'An error occurred');
      }
    });
  }

  // Suspend/Activate tenant
  async toggleTenantStatus(tenant: Tenant) {
    const action = tenant.status === 'ACTIVE' ? 'suspend' : 'activate';
    const actionTitle = tenant.status === 'ACTIVE' ? 'Suspend Chama' : 'Activate Chama';
    const actionMessage = tenant.status === 'ACTIVE'
      ? `Are you sure you want to suspend "${tenant.name}"? Members will not be able to access the chama while suspended.`
      : `Are you sure you want to activate "${tenant.name}"? Members will regain access to the chama.`;
    
    const confirmed = await this.confirmDialog.confirm({
      title: actionTitle,
      message: actionMessage,
      confirmText: tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate',
      cancelText: 'Cancel',
      type: tenant.status === 'ACTIVE' ? 'warning' : 'info'
    });
    
    if (!confirmed) return;
    
    const method = tenant.status === 'ACTIVE' 
      ? this.api.suspendTenant(tenant.id)
      : this.api.activateTenant(tenant.id);

    method.subscribe({
      next: () => {
        this.toast.success(`Chama ${action}d`, `"${tenant.name}" has been ${action}d.`);
        this.loadTenants();
      },
      error: (err) => this.toast.error(`Failed to ${action} chama`, err.error?.message || 'An error occurred')
    });
  }

  // Search functionality
  searchQuery = '';
  
  // Tab filter
  activeTab: 'all' | 'active' | 'suspended' = 'all';

  get filteredTenants(): Tenant[] {
    let result = this.tenants;
    
    // Filter by tab
    if (this.activeTab === 'active') {
      result = result.filter(t => t.status === 'ACTIVE');
    } else if (this.activeTab === 'suspended') {
      result = result.filter(t => t.status === 'SUSPENDED');
    }
    
    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.code.toLowerCase().includes(query)
      );
    }
    
    return result;
  }
  
  get suspendedCount() { return this.tenants.filter((t) => t.status === 'SUSPENDED').length; }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
