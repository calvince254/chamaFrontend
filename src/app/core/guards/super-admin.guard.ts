import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const superAdminGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  const session = inject(SessionService);
  const router = inject(Router);
  
  // Skip guard on server-side rendering
  if (!isPlatformBrowser(platformId)) {
    return true;
  }
  
  // Check if user is logged in as super admin with valid token
  if (session.isLoggedIn() && session.currentUser()?.isSuperAdmin) {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};
