import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css']
})
export class ChangePasswordComponent implements OnInit {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  isRequired = signal(false);
  
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  constructor(
    private session: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.isRequired.set(params['required'] === 'true');
    });
  }

  isValid(): boolean {
    return (
      this.currentPassword.length > 0 &&
      this.newPassword.length >= 8 &&
      this.newPassword === this.confirmPassword
    );
  }

  toggleCurrentPassword() {
    this.showCurrentPassword.set(!this.showCurrentPassword());
  }

  toggleNewPassword() {
    this.showNewPassword.set(!this.showNewPassword());
  }

  toggleConfirmPassword() {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  submit() {
    if (!this.isValid()) return;
    
    this.error.set(null);
    this.success.set(null);
    this.loading.set(true);

    this.session.changePassword(this.currentPassword, this.newPassword, this.confirmPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set('Password changed successfully! Redirecting...');
        
        // Clear the flag and redirect after a short delay
        setTimeout(() => {
          const user = this.session.currentUser();
          if (user?.isSuperAdmin === true) {
            this.router.navigate(['/super-admin/chamas']);
          } else {
            this.router.navigate(['/app/dashboard']);
          }
        }, 1500);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error?.message || err?.message || 'Failed to change password. Please try again.';
        this.error.set(message);
      }
    });
  }

  goBack() {
    const user = this.session.currentUser();
    if (user?.isSuperAdmin === true) {
      this.router.navigate(['/super-admin/chamas']);
    } else {
      this.router.navigate(['/app/dashboard']);
    }
  }
}
