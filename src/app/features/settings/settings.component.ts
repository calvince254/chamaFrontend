import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../core/services/session.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { IconComponent } from '../../shared/icon.component';
import { FineType, ContributionType, LoanProduct, LoanApprovalLevel, Role, Member, TenantSettings, ShareSettings, PaymentSettings, TreasurerDevice } from '../../core/models/models';
import {
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective,
  LabelValueComponent,
  StatusBadgeComponent
} from '../../shared/components';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ListRowCardComponent, ListRowSecondaryDirective, ListRowFooterDirective, LabelValueComponent, StatusBadgeComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  // Chama settings (fetched from API)
  chama: TenantSettings = {
    tenantId: 0,
    name: '',
    registrationFee: 0,
    registrationFeeRequired: false,
    minMembers: 3,
    maxMembers: 50,
    signaturesRequired: 2,
    sessionTimeoutMinutes: 30
  };
  loadingSettings = signal(false);
  savingSettings = signal(false);

  // Fine Types
  fineTypes: FineType[] = [];
  loadingFineTypes = signal(false);
  showFineTypeForm = false;
  editingFineType: Partial<FineType> = {};
  savingFineType = signal(false);

  // Contribution Types
  contributionTypes: ContributionType[] = [];
  loadingContributionTypes = signal(false);
  showContributionTypeForm = false;
  editingContributionType: Partial<ContributionType> = {};
  savingContributionType = signal(false);

  // Loan Products
  loanProducts: LoanProduct[] = [];
  loadingLoanProducts = signal(false);
  showLoanProductForm = false;
  editingLoanProduct: Partial<LoanProduct> = {};
  savingLoanProduct = signal(false);
  roles: Role[] = [];
  members: Member[] = [];

  // Active tab
  activeTab: 'general' | 'fines' | 'contributions' | 'loans' | 'shares' | 'payments' | 'system' = 'general';

  // Payment Settings
  paymentSettings: PaymentSettings = {
    inAppSmsEnabled: false,
    stkPushEnabled: false,
    manualEnabled: true,
    darajaConsumerKey: '',
    darajaConsumerSecret: '',
    businessShortCode: '',
    treasurerPhone: '',
    treasurerName: '',
    claimExpiryMinutes: 30,
    fallbackMatchWindowMinutes: 20,
    smsNotificationsEnabled: false,
    pushNotificationsEnabled: true,
    defaultPaymentMethod: 'MANUAL'
  };
  treasurerDevices: TreasurerDevice[] = [];
  loadingPaymentSettings = signal(false);
  savingPaymentSettings = signal(false);
  loadingTreasurerDevices = signal(false);

  // Share Settings
  shareSettings: ShareSettings = {
    shareContributionTypeIds: [],
    poolContributionTypeIds: [],
    includeFines: false,
    includeLoanInterest: false,
    includeInvestmentReturns: false,
    includePenalties: false,
    includeProcessingFees: false
  };
  loadingShareSettings = signal(false);
  savingShareSettings = signal(false);

  // System Settings (Super Admin only)
  systemSettings: {
    tokenExpiryHours: number;
    minTokenExpiryHours: number;
    maxTokenExpiryHours: number;
  } | null = null;
  loadingSystemSettings = signal(false);
  savingSystemSettings = signal(false);

  // Frequency options
  frequencyOptions = [
    { value: 'WEEKLY', label: 'Weekly' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
    { value: 'YEARLY', label: 'Yearly' }
  ];

  // Loan product options
  interestTypeOptions = [
    { value: 'FLAT', label: 'Flat Rate', description: 'Interest is calculated on the original principal throughout the loan term. Total interest = Principal × Rate × Term. Simple but you pay more interest overall.' },
    { value: 'REDUCING_BALANCE', label: 'Reducing Balance', description: 'Interest is calculated on the remaining balance each month. As you repay, your interest decreases. You pay less total interest compared to flat rate.' }
  ];

  periodTypeOptions = [
    { value: 'DAYS', label: 'Days' },
    { value: 'MONTHS', label: 'Months' }
  ];

  penaltyTypeOptions = [
    { value: 'PERCENTAGE_OF_PRINCIPAL', label: '% of Principal' },
    { value: 'PERCENTAGE_OF_OUTSTANDING', label: '% of Outstanding Balance' },
    { value: 'FIXED_AMOUNT', label: 'Fixed Amount' }
  ];

  penaltyFrequencyOptions = [
    { value: 'FLAT', label: 'One-time (Flat)' },
    { value: 'PER_PERIOD', label: 'Per Period (Recurring)' }
  ];

  constructor(
    public session: SessionService,
    private api: ApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    // Determine default tab based on permissions
    this.setDefaultTab();
    
    // Only load data for tabs the user has permission to view
    // This prevents 403 errors showing in Network tab/console
    
    if (this.session.can('VIEW_TENANT_SETTINGS') || this.session.can('EDIT_TENANT_SETTINGS') || this.session.currentUser()?.isSuperAdmin) {
      this.loadTenantSettings();
    }
    
    if (this.session.can('VIEW_FINE_TYPES') || this.session.can('CREATE_FINE_TYPE')) {
      this.loadFineTypes();
    }
    
    if (this.session.can('VIEW_CONTRIBUTION_TYPES') || this.session.can('CREATE_CONTRIBUTION_TYPE')) {
      this.loadContributionTypes();
    }
    
    if (this.session.can('VIEW_LOAN_PRODUCTS') || this.session.can('CREATE_LOAN_PRODUCT')) {
      this.loadLoanProducts();
      this.loadRoles(); // Needed for loan approvers
      this.loadMembers(); // Needed for loan approvers
    }
    
    if (this.session.can('VIEW_SHARE_SETTINGS') || this.session.can('MANAGE_SHARE_SETTINGS')) {
      this.loadShareSettings();
      // Also need contribution types for share settings
      if (!this.session.can('VIEW_CONTRIBUTION_TYPES') && !this.session.can('CREATE_CONTRIBUTION_TYPE')) {
        this.loadContributionTypes();
      }
    }
    
    if (this.session.can('VIEW_PAYMENT_SETTINGS') || this.session.can('MANAGE_PAYMENT_SETTINGS')) {
      this.loadPaymentSettings();
      this.loadTreasurerDevices();
    }
    
    // Load system settings for super admin
    if (this.session.currentUser()?.isSuperAdmin) {
      this.loadSystemSettings();
    }
  }

  /**
   * Set the default active tab based on user's permissions
   */
  setDefaultTab() {
    if (this.session.can('VIEW_TENANT_SETTINGS') || this.session.can('EDIT_TENANT_SETTINGS')) {
      this.activeTab = 'general';
    } else if (this.session.can('VIEW_FINE_TYPES') || this.session.can('CREATE_FINE_TYPE')) {
      this.activeTab = 'fines';
    } else if (this.session.can('VIEW_CONTRIBUTION_TYPES') || this.session.can('CREATE_CONTRIBUTION_TYPE')) {
      this.activeTab = 'contributions';
    } else if (this.session.can('VIEW_LOAN_PRODUCTS') || this.session.can('CREATE_LOAN_PRODUCT')) {
      this.activeTab = 'loans';
    } else if (this.session.can('VIEW_SHARE_SETTINGS') || this.session.can('MANAGE_SHARE_SETTINGS')) {
      this.activeTab = 'shares';
    } else if (this.session.can('VIEW_PAYMENT_SETTINGS') || this.session.can('MANAGE_PAYMENT_SETTINGS')) {
      this.activeTab = 'payments';
    } else if (this.session.currentUser()?.isSuperAdmin) {
      this.activeTab = 'system';
    }
    // If no permissions, keep default 'general' - the tab will just be hidden
  }

  // ==================== Tenant Settings ====================
  loadTenantSettings() {
    // Check permission first to avoid unnecessary API call
    if (!this.session.can('VIEW_TENANT_SETTINGS') && !this.session.currentUser()?.isSuperAdmin) {
      this.chama.name = this.session.currentUser()?.tenantName || 'My Chama';
      return;
    }
    
    this.loadingSettings.set(true);
    this.api.getTenantSettings().subscribe({
      next: (settings) => {
        this.chama = settings;
        this.loadingSettings.set(false);
      },
      error: (err) => {
        this.loadingSettings.set(false);
        // Silent fail for 403 - user doesn't have permission
        if (err.status !== 403) {
          console.error('Failed to load tenant settings:', err);
        }
        // Set default name from session if load fails
        this.chama.name = this.session.currentUser()?.tenantName || 'My Chama';
      }
    });
  }

  saveTenantSettings() {
    this.savingSettings.set(true);
    this.api.updateTenantSettings(this.chama).subscribe({
      next: (settings) => {
        this.chama = settings;
        this.savingSettings.set(false);
        this.toast.success('Settings saved', 'General settings have been updated.');
      },
      error: (err) => {
        this.savingSettings.set(false);
        this.toast.error('Failed to save', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Roles ====================
  loadRoles() {
    this.api.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
      },
      error: (err) => {
        // Silent fail for 403 - user doesn't have permission
        if (err.status !== 403) {
          console.error('Failed to load roles:', err);
        }
      }
    });
  }

  // ==================== Members ====================
  loadMembers() {
    this.api.getMembers().subscribe({
      next: (members) => {
        this.members = members.filter(m => m.status === 'ACTIVE');
      },
      error: (err) => {
        // Silent fail for 403 - user doesn't have permission
        if (err.status !== 403) {
          console.error('Failed to load members:', err);
        }
      }
    });
  }

  // ==================== Fine Types ====================
  loadFineTypes() {
    this.loadingFineTypes.set(true);
    this.api.getFineTypes().subscribe({
      next: (types) => {
        this.fineTypes = types;
        this.loadingFineTypes.set(false);
      },
      error: (err) => {
        this.loadingFineTypes.set(false);
        // Silent fail for 403 - user doesn't have permission
        if (err.status !== 403) {
          console.error('Failed to load fine types:', err);
        }
      }
    });
  }

  openNewFineType() {
    this.editingFineType = {
      name: '',
      description: '',
      amount: 0,
      active: true,
      automatic: false,
      triggerType: undefined
    };
    this.showFineTypeForm = true;
  }

  editFineType(fineType: FineType) {
    this.editingFineType = { ...fineType };
    this.showFineTypeForm = true;
  }

  closeFineTypeForm() {
    this.showFineTypeForm = false;
    this.editingFineType = {};
  }

  saveFineType() {
    if (!this.editingFineType.name || !this.editingFineType.amount) {
      this.toast.warning('Missing fields', 'Please provide a name and amount');
      return;
    }

    // Validate trigger type when automatic is enabled
    if (this.editingFineType.automatic && !this.editingFineType.triggerType) {
      this.toast.warning('Missing trigger', 'Please select a trigger type for automatic fines');
      return;
    }

    // Clear triggerType if not automatic
    if (!this.editingFineType.automatic) {
      this.editingFineType.triggerType = undefined;
    }

    this.savingFineType.set(true);

    if (this.editingFineType.id) {
      // Update existing
      this.api.updateFineType(this.editingFineType.id, this.editingFineType).subscribe({
        next: () => {
          this.savingFineType.set(false);
          this.showFineTypeForm = false;
          this.toast.success('Fine type updated', 'The fine type has been updated.');
          this.loadFineTypes();
        },
        error: (err) => {
          this.savingFineType.set(false);
          this.toast.error('Failed to update', err.error?.message || 'Please try again.');
        }
      });
    } else {
      // Create new
      this.api.createFineType(this.editingFineType).subscribe({
        next: () => {
          this.savingFineType.set(false);
          this.showFineTypeForm = false;
          this.toast.success('Fine type created', 'The new fine type has been added.');
          this.loadFineTypes();
        },
        error: (err) => {
          this.savingFineType.set(false);
          this.toast.error('Failed to create', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  async deleteFineType(fineType: FineType) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Fine Type?',
      message: `Are you sure you want to delete "${fineType.name}"? This will deactivate the fine type.`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      this.api.deleteFineType(fineType.id).subscribe({
        next: () => {
          this.toast.success('Fine type deleted', 'The fine type has been deactivated.');
          this.loadFineTypes();
        },
        error: (err) => {
          this.toast.error('Failed to delete', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  toggleFineTypeActive(fineType: FineType) {
    const updated = { ...fineType, active: !fineType.active };
    this.api.updateFineType(fineType.id, updated).subscribe({
      next: () => {
        fineType.active = !fineType.active;
        this.toast.success(
          fineType.active ? 'Fine type activated' : 'Fine type deactivated',
          `"${fineType.name}" is now ${fineType.active ? 'active' : 'inactive'}.`
        );
      },
      error: (err) => {
        this.toast.error('Failed to update', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Contribution Types ====================
  loadContributionTypes() {
    this.loadingContributionTypes.set(true);
    this.api.getContributionTypes().subscribe({
      next: (types) => {
        this.contributionTypes = types;
        this.loadingContributionTypes.set(false);
      },
      error: (err) => {
        this.loadingContributionTypes.set(false);
        // Silent fail for 403 - user doesn't have permission
        if (err.status !== 403) {
          console.error('Failed to load contribution types:', err);
        }
      }
    });
  }

  openNewContributionType() {
    this.editingContributionType = {
      name: '',
      description: '',
      amount: 0,
      frequency: 'MONTHLY',
      dueDay: 5,
      active: true,
      lateFineEnabled: false,
      lateFineAmount: undefined,
      gracePeriodDays: 3
    };
    this.showContributionTypeForm = true;
  }

  editContributionType(ct: ContributionType) {
    this.editingContributionType = { ...ct };
    this.showContributionTypeForm = true;
  }

  closeContributionTypeForm() {
    this.showContributionTypeForm = false;
    this.editingContributionType = {};
  }

  saveContributionType() {
    if (!this.editingContributionType.name || !this.editingContributionType.amount) {
      this.toast.warning('Missing fields', 'Please provide a name and amount');
      return;
    }

    if (!this.editingContributionType.frequency) {
      this.toast.warning('Missing frequency', 'Please select a payment frequency');
      return;
    }

    // Validate late fine settings
    if (this.editingContributionType.lateFineEnabled && !this.editingContributionType.lateFineAmount) {
      this.toast.warning('Missing late fine amount', 'Please enter the late payment fine amount');
      return;
    }

    // Clear late fine amount if not enabled
    if (!this.editingContributionType.lateFineEnabled) {
      this.editingContributionType.lateFineAmount = undefined;
    }

    this.savingContributionType.set(true);

    if (this.editingContributionType.id) {
      // Update existing
      this.api.updateContributionType(this.editingContributionType.id, this.editingContributionType).subscribe({
        next: () => {
          this.savingContributionType.set(false);
          this.showContributionTypeForm = false;
          this.toast.success('Contribution type updated', 'The contribution type has been updated.');
          this.loadContributionTypes();
        },
        error: (err) => {
          this.savingContributionType.set(false);
          this.toast.error('Failed to update', err.error?.message || 'Please try again.');
        }
      });
    } else {
      // Create new
      this.api.createContributionType(this.editingContributionType).subscribe({
        next: () => {
          this.savingContributionType.set(false);
          this.showContributionTypeForm = false;
          this.toast.success('Contribution type created', 'The new contribution type has been added.');
          this.loadContributionTypes();
        },
        error: (err) => {
          this.savingContributionType.set(false);
          this.toast.error('Failed to create', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  async deleteContributionType(ct: ContributionType) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Contribution Type?',
      message: `Are you sure you want to delete "${ct.name}"? This will deactivate the contribution type.`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      this.api.deleteContributionType(ct.id).subscribe({
        next: () => {
          this.toast.success('Contribution type deleted', 'The contribution type has been deactivated.');
          this.loadContributionTypes();
        },
        error: (err) => {
          this.toast.error('Failed to delete', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  toggleContributionTypeActive(ct: ContributionType) {
    const updated = { ...ct, active: !ct.active };
    this.api.updateContributionType(ct.id, updated).subscribe({
      next: () => {
        ct.active = !ct.active;
        this.toast.success(
          ct.active ? 'Contribution type activated' : 'Contribution type deactivated',
          `"${ct.name}" is now ${ct.active ? 'active' : 'inactive'}.`
        );
      },
      error: (err) => {
        this.toast.error('Failed to update', err.error?.message || 'Please try again.');
      }
    });
  }

  getFrequencyLabel(frequency: string): string {
    const option = this.frequencyOptions.find(o => o.value === frequency);
    return option?.label || frequency;
  }

  // ==================== Loan Products ====================
  loadLoanProducts() {
    this.loadingLoanProducts.set(true);
    this.api.getLoanProducts().subscribe({
      next: (products) => {
        this.loanProducts = products;
        this.loadingLoanProducts.set(false);
      },
      error: (err) => {
        this.loadingLoanProducts.set(false);
        // Silent fail for 403 - user doesn't have permission
        if (err.status !== 403) {
          console.error('Failed to load loan products:', err);
        }
      }
    });
  }

  openNewLoanProduct() {
    this.editingLoanProduct = {
      name: '',
      description: '',
      interestRate: 10,
      interestType: 'REDUCING_BALANCE',
      minAmount: 1000,
      maxAmount: 100000,
      repaymentPeriod: 12,
      repaymentPeriodType: 'MONTHS',
      requiredGuarantors: 0,
      penaltyEnabled: false,
      penaltyRate: 0,
      penaltyType: 'PERCENTAGE_OF_OUTSTANDING',
      penaltyFrequency: 'FLAT',
      gracePeriodDays: 3,
      requiresApproval: true,
      approvalLevels: 1,
      active: true,
      approvalLevelConfig: [],
      processingFeeEnabled: false,
      processingFeeType: 'FIXED',
      processingFeeValue: 0,
      processingFeeDeduction: 'UPFRONT'
    };
    // Initialize approval level configs
    this.onApprovalLevelsChange();
    this.showLoanProductForm = true;
  }

  editLoanProduct(product: LoanProduct) {
    this.editingLoanProduct = { 
      ...product,
      approvalLevelConfig: product.approvalLevelConfig || []
    };
    // Ensure approval configs match the level count
    if (this.editingLoanProduct.requiresApproval && this.editingLoanProduct.approvalLevels) {
      this.onApprovalLevelsChange();
    }
    this.showLoanProductForm = true;
  }

  closeLoanProductForm() {
    this.showLoanProductForm = false;
    this.editingLoanProduct = {};
  }

  onApprovalLevelsChange() {
    const levels = this.editingLoanProduct.approvalLevels || 0;
    const currentConfigs = this.editingLoanProduct.approvalLevelConfig || [];
    
    // Create array with correct number of levels
    const newConfigs: LoanApprovalLevel[] = [];
    for (let i = 1; i <= levels; i++) {
      const existing = currentConfigs.find(c => c.level === i);
      if (existing) {
        newConfigs.push(existing);
      } else {
        newConfigs.push({
          level: i,
          memberId: 0,
          levelName: `Level ${i} Approval`,
          canReject: true
        });
      }
    }
    this.editingLoanProduct.approvalLevelConfig = newConfigs;
  }

  getMemberName(memberId: number): string {
    const member = this.members.find(m => m.id === memberId);
    return member?.name || 'Select Member';
  }

  getRoleName(roleId: number): string {
    const role = this.roles.find(r => r.id === roleId);
    return role?.name || 'Select Role';
  }

  saveLoanProduct() {
    if (!this.editingLoanProduct.name) {
      this.toast.warning('Missing fields', 'Please provide a product name');
      return;
    }

    if (!this.editingLoanProduct.interestRate || this.editingLoanProduct.interestRate < 0) {
      this.toast.warning('Invalid interest rate', 'Please provide a valid interest rate');
      return;
    }

    if (!this.editingLoanProduct.repaymentPeriod || this.editingLoanProduct.repaymentPeriod <= 0) {
      this.toast.warning('Invalid repayment period', 'Please provide a valid repayment period');
      return;
    }

    // Validate penalty settings
    if (this.editingLoanProduct.penaltyEnabled && 
        (!this.editingLoanProduct.penaltyRate || this.editingLoanProduct.penaltyRate <= 0)) {
      this.toast.warning('Invalid penalty rate', 'Please provide a valid penalty rate');
      return;
    }

    // Validate processing fee settings
    if (this.editingLoanProduct.processingFeeEnabled && 
        (!this.editingLoanProduct.processingFeeValue || this.editingLoanProduct.processingFeeValue <= 0)) {
      this.toast.warning('Invalid processing fee', 'Please provide a valid processing fee amount');
      return;
    }

    // Validate approval levels
    if (this.editingLoanProduct.requiresApproval && this.editingLoanProduct.approvalLevels && this.editingLoanProduct.approvalLevels > 0) {
      const configs = this.editingLoanProduct.approvalLevelConfig || [];
      for (let i = 0; i < this.editingLoanProduct.approvalLevels; i++) {
        if (!configs[i] || !configs[i].memberId || configs[i].memberId === 0) {
          this.toast.warning('Missing approver', `Please select a member for approval level ${i + 1}`);
          return;
        }
      }
    }

    this.savingLoanProduct.set(true);

    if (this.editingLoanProduct.id) {
      // Update existing
      this.api.updateLoanProduct(this.editingLoanProduct.id, this.editingLoanProduct).subscribe({
        next: () => {
          this.savingLoanProduct.set(false);
          this.showLoanProductForm = false;
          this.toast.success('Loan product updated', 'The loan product has been updated.');
          this.loadLoanProducts();
        },
        error: (err) => {
          this.savingLoanProduct.set(false);
          this.toast.error('Failed to update', err.error?.message || 'Please try again.');
        }
      });
    } else {
      // Create new
      this.api.createLoanProduct(this.editingLoanProduct).subscribe({
        next: () => {
          this.savingLoanProduct.set(false);
          this.showLoanProductForm = false;
          this.toast.success('Loan product created', 'The new loan product has been added.');
          this.loadLoanProducts();
        },
        error: (err) => {
          this.savingLoanProduct.set(false);
          this.toast.error('Failed to create', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  async deleteLoanProduct(product: LoanProduct) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Loan Product?',
      message: `Are you sure you want to delete "${product.name}"? This will deactivate the loan product.`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      this.api.deleteLoanProduct(product.id).subscribe({
        next: () => {
          this.toast.success('Loan product deleted', 'The loan product has been deactivated.');
          this.loadLoanProducts();
        },
        error: (err) => {
          this.toast.error('Failed to delete', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  toggleLoanProductActive(product: LoanProduct) {
    const updated = { ...product, active: !product.active };
    this.api.updateLoanProduct(product.id, updated).subscribe({
      next: () => {
        product.active = !product.active;
        this.toast.success(
          product.active ? 'Loan product activated' : 'Loan product deactivated',
          `"${product.name}" is now ${product.active ? 'active' : 'inactive'}.`
        );
      },
      error: (err) => {
        this.toast.error('Failed to update', err.error?.message || 'Please try again.');
      }
    });
  }

  getInterestTypeLabel(type: string): string {
    const option = this.interestTypeOptions.find(o => o.value === type);
    return option?.label || type;
  }

  getPeriodTypeLabel(type: string): string {
    const option = this.periodTypeOptions.find(o => o.value === type);
    return option?.label || type;
  }

  getPenaltyTypeLabel(type: string | undefined): string {
    if (!type) return '-';
    const option = this.penaltyTypeOptions.find(o => o.value === type);
    return option?.label || type;
  }

  // ==================== Share Settings ====================
  loadShareSettings() {
    this.loadingShareSettings.set(true);
    this.api.getShareSettings().subscribe({
      next: (settings) => {
        this.shareSettings = {
          ...settings,
          shareContributionTypeIds: settings.shareContributionTypeIds || [],
          poolContributionTypeIds: settings.poolContributionTypeIds || []
        };
        this.loadingShareSettings.set(false);
      },
      error: (err) => {
        this.loadingShareSettings.set(false);
        if (err.status !== 403) {
          console.error('Failed to load share settings:', err);
        }
      }
    });
  }

  saveShareSettings() {
    this.savingShareSettings.set(true);
    this.api.saveShareSettings(this.shareSettings).subscribe({
      next: (settings) => {
        this.shareSettings = {
          ...settings,
          shareContributionTypeIds: settings.shareContributionTypeIds || [],
          poolContributionTypeIds: settings.poolContributionTypeIds || []
        };
        this.savingShareSettings.set(false);
        this.toast.success('Settings saved', 'Share calculation settings have been updated.');
      },
      error: (err) => {
        this.savingShareSettings.set(false);
        this.toast.error('Failed to save', err.error?.message || 'Please try again.');
      }
    });
  }

  toggleShareContributionType(typeId: number) {
    const idx = this.shareSettings.shareContributionTypeIds.indexOf(typeId);
    if (idx === -1) {
      this.shareSettings.shareContributionTypeIds.push(typeId);
    } else {
      this.shareSettings.shareContributionTypeIds.splice(idx, 1);
    }
  }

  isShareContributionType(typeId: number): boolean {
    return this.shareSettings.shareContributionTypeIds.includes(typeId);
  }

  togglePoolContributionType(typeId: number) {
    const idx = this.shareSettings.poolContributionTypeIds.indexOf(typeId);
    if (idx === -1) {
      this.shareSettings.poolContributionTypeIds.push(typeId);
    } else {
      this.shareSettings.poolContributionTypeIds.splice(idx, 1);
    }
  }

  isPoolContributionType(typeId: number): boolean {
    return this.shareSettings.poolContributionTypeIds.includes(typeId);
  }

  // ==================== System Settings (Super Admin) ====================
  loadSystemSettings() {
    this.loadingSystemSettings.set(true);
    this.api.getSystemSettings().subscribe({
      next: (settings) => {
        this.systemSettings = settings;
        this.loadingSystemSettings.set(false);
      },
      error: (err) => {
        this.loadingSystemSettings.set(false);
        console.error('Failed to load system settings:', err);
      }
    });
  }

  saveSystemSettings() {
    if (!this.systemSettings) return;
    
    // Validate token expiry
    if (this.systemSettings.tokenExpiryHours < this.systemSettings.minTokenExpiryHours) {
      this.toast.warning('Invalid value', `Token expiry must be at least ${this.systemSettings.minTokenExpiryHours} hour(s)`);
      return;
    }
    if (this.systemSettings.tokenExpiryHours > this.systemSettings.maxTokenExpiryHours) {
      this.toast.warning('Invalid value', `Token expiry cannot exceed ${this.systemSettings.maxTokenExpiryHours} hours`);
      return;
    }

    this.savingSystemSettings.set(true);
    this.api.updateSystemSettings({
      tokenExpiryHours: this.systemSettings.tokenExpiryHours
    }).subscribe({
      next: (settings) => {
        this.systemSettings = settings;
        this.savingSystemSettings.set(false);
        this.toast.success('Settings saved', 'System settings have been updated.');
      },
      error: (err) => {
        this.savingSystemSettings.set(false);
        this.toast.error('Failed to save', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Payment Settings ====================
  loadPaymentSettings() {
    this.loadingPaymentSettings.set(true);
    this.api.getPaymentSettings().subscribe({
      next: (settings) => {
        this.paymentSettings = settings;
        this.loadingPaymentSettings.set(false);
      },
      error: (err) => {
        this.loadingPaymentSettings.set(false);
        if (err.status !== 403 && err.status !== 404) {
          console.error('Failed to load payment settings:', err);
        }
      }
    });
  }

  savePaymentSettings() {
    // Validate STK Push fields if enabled
    if (this.paymentSettings.stkPushEnabled) {
      if (!this.paymentSettings.darajaConsumerKey || !this.paymentSettings.darajaConsumerSecret || !this.paymentSettings.businessShortCode) {
        this.toast.warning('Missing fields', 'STK Push requires Daraja Consumer Key, Secret, and Business Short Code');
        return;
      }
    }

    // Validate In-App SMS fields if enabled
    if (this.paymentSettings.inAppSmsEnabled) {
      if (!this.paymentSettings.treasurerPhone || !this.paymentSettings.treasurerName) {
        this.toast.warning('Missing fields', 'In-App SMS requires Treasurer Phone and Name');
        return;
      }
    }

    this.savingPaymentSettings.set(true);
    this.api.updatePaymentSettings(this.paymentSettings).subscribe({
      next: (settings) => {
        this.paymentSettings = settings;
        this.savingPaymentSettings.set(false);
        this.toast.success('Settings saved', 'Payment settings have been updated.');
      },
      error: (err) => {
        this.savingPaymentSettings.set(false);
        this.toast.error('Failed to save', err.error?.message || 'Please try again.');
      }
    });
  }

  loadTreasurerDevices() {
    this.loadingTreasurerDevices.set(true);
    this.api.getTreasurerDevices().subscribe({
      next: (devices) => {
        this.treasurerDevices = devices;
        this.loadingTreasurerDevices.set(false);
      },
      error: (err) => {
        this.loadingTreasurerDevices.set(false);
        if (err.status !== 403 && err.status !== 404) {
          console.error('Failed to load treasurer devices:', err);
        }
      }
    });
  }

  async revokeTreasurerDevice(device: TreasurerDevice) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Revoke Device?',
      message: `Are you sure you want to revoke access for "${device.deviceName}"? The treasurer will need to re-register this device.`,
      confirmText: 'Revoke',
      type: 'danger'
    });

    if (confirmed) {
      this.api.revokeTreasurerDevice(device.id).subscribe({
        next: () => {
          this.toast.success('Device revoked', 'The device has been removed from the authorized list.');
          this.loadTreasurerDevices();
        },
        error: (err) => {
          this.toast.error('Failed to revoke', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'IN_APP_SMS': return 'In-App SMS';
      case 'STK_PUSH': return 'STK Push';
      case 'MANUAL': return 'Manual Verification';
      default: return method;
    }
  }
}
