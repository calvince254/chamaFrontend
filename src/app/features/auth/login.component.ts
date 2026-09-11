import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SessionService } from '../../core/services/session.service';

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

  constructor(
    private session: SessionService, 
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Check if redirected due to session expiration
    this.route.queryParams.subscribe(params => {
      if (params['sessionExpired'] === 'true') {
        this.sessionExpired.set(true);
        this.error.set('Your session has expired. Please log in again.');
      }
    });
  }

  submit() {
    this.error.set(null);
    this.sessionExpired.set(false);
    this.loading.set(true);

    this.session.login(this.email, this.password).subscribe({
      next: (success) => {
        this.loading.set(false);
        if (success) {
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
