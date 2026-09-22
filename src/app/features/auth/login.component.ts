import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SessionService, MultiTenantLoginResult, LoginResult } from '../../core/services/session.service';
import { IdleService } from '../../core/services/idle.service';

interface TenantOption {
  id: number;
  name: string;
  code: string;
  roleName: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  
  // UI state
  loading = signal(false);
  error = signal<string | null>(null);
  sessionExpired = signal(false);
  idleLogout = signal(false);
  
  // Multi-tenant state
  showTenantSelection = signal(false);
  availableTenants = signal<TenantOption[]>([]);
  multiTenantUserName = signal('');

  constructor(
    private session: SessionService, 
    private router: Router,
    private route: ActivatedRoute,
    private idleService: IdleService
  ) {}

  ngOnInit() {
    // Check if redirected due to session expiration or idle logout
    this.route.queryParams.subscribe(params => {
      if (params['sessionExpired'] === 'true') {
        this.sessionExpired.set(true);
        this.error.set('Your session has expired. Please log in again.');
      }
      if (params['reason'] === 'idle') {
        this.idleLogout.set(true);
      }
    });
  }

  submit() {
    this.error.set(null);
    this.sessionExpired.set(false);
    this.idleLogout.set(false);
    this.showTenantSelection.set(false);
    this.loading.set(true);

    this.session.login(this.email, this.password).subscribe({
      next: (result: LoginResult) => {
        this.loading.set(false);
        
        // Check if multi-tenant response
        if (typeof result === 'object' && result.multiTenant) {
          this.multiTenantUserName.set(result.name);
          this.availableTenants.set(result.tenants);
          this.showTenantSelection.set(true);
          return;
        }
        
        // Normal login success
        if (result === true) {
          this.handleSuccessfulLogin();
        } else {
          this.error.set('Invalid email/phone or password.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Login error:', err);
        this.error.set('Login failed. Please check your credentials.');
      }
    });
  }

  selectTenant(tenant: TenantOption) {
    this.loading.set(true);
    this.error.set(null);
    
    this.session.loginToTenant(this.email, this.password, tenant.id).subscribe({
      next: (success) => {
        this.loading.set(false);
        if (success) {
          this.handleSuccessfulLogin();
        } else {
          this.error.set('Failed to login to selected chama.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Tenant login error:', err);
        this.error.set('Failed to login. Please try again.');
      }
    });
  }

  backToLogin() {
    this.showTenantSelection.set(false);
    this.availableTenants.set([]);
    this.password = ''; // Clear password for security
  }

  private handleSuccessfulLogin() {
    // Start idle monitoring if configured (skip for super admin)
    const user = this.session.currentUser();
    if (!user?.isSuperAdmin) {
      const timeout = this.session.sessionTimeoutMinutes();
      if (timeout > 0) {
        this.idleService.startWatching(timeout);
      }
    }
    
    // Check if user must change password (first login or admin reset)
    if (this.session.mustChangePassword()) {
      this.router.navigate(['/change-password'], { queryParams: { required: 'true' } });
      return;
    }
    
    // Route based on role
    console.log('Logged in user:', user);
    
    if (user?.isSuperAdmin === true) {
      this.router.navigate(['/super-admin/chamas']);
    } else {
      this.router.navigate(['/app/dashboard']);
    }
  }
}
