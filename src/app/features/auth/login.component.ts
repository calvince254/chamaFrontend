import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { IdleService } from '../../core/services/idle.service';

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
    this.loading.set(true);

    this.session.login(this.email, this.password).subscribe({
      next: (success) => {
        this.loading.set(false);
        if (success) {
          // Start idle monitoring if configured
          const timeout = this.session.sessionTimeoutMinutes();
          if (timeout > 0) {
            this.idleService.startWatching(timeout);
          }
          
          // Check if user must change password (first login or admin reset)
          if (this.session.mustChangePassword()) {
            this.router.navigate(['/change-password'], { queryParams: { required: 'true' } });
            return;
          }
          
          // Route based on role
          const user = this.session.currentUser();
          console.log('Logged in user:', user);
          
          if (user?.isSuperAdmin === true) {
            this.router.navigate(['/super-admin/chamas']);
          } else {
            this.router.navigate(['/app/dashboard']);
          }
        } else {
          this.error.set('Invalid email or password.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        console.error('Login error:', err);
        this.error.set('Login failed. Please check your credentials.');
      }
    });
  }
}
