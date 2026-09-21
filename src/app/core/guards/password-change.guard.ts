import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SessionService } from '../services/session.service';

/**
 * Guard that redirects users who must change their password to the change-password page.
 * This should be applied to protected routes to enforce password change before accessing the app.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.mustChangePassword()) {
    router.navigate(['/change-password'], { queryParams: { required: 'true' } });
    return false;
  }

  return true;
};
