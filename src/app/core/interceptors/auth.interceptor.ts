import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, of, EMPTY } from 'rxjs';
import { ToastService } from '../../shared/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  
  // Skip adding token for login requests
  if (req.url.includes('/auth/')) {
    return next(req);
  }

  // Only access localStorage in browser
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const token = localStorage.getItem('chama.token');

  let request = req;
  if (token) {
    request = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized only - this means session expired or not authenticated
      // Do NOT redirect on 403 - that means user is logged in but lacks permission
      if (error.status === 401) {
        // Clear stored auth data
        localStorage.removeItem('chama.token');
        localStorage.removeItem('chama.currentUser');
        localStorage.removeItem('chama.permissionCodes');
        
        // Redirect to login
        router.navigate(['/login'], { 
          queryParams: { sessionExpired: 'true' } 
        });
      }
      
      return throwError(() => error);
    })
  );
};

/**
 * Error interceptor to catch all HTTP errors and display them in UI
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);
  
  // Only inject toast in browser (not in SSR)
  let toast: ToastService | null = null;
  if (isBrowser) {
    toast = inject(ToastService);
  }
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Extract endpoint name from URL for better error messages
      const urlParts = req.url.split('/api/');
      const endpoint = urlParts.length > 1 ? urlParts[1].split('?')[0] : req.url;
      
      // In SSR mode, just log and return empty to prevent crash
      if (!isBrowser) {
        console.warn(`[SSR] HTTP error for ${endpoint}: ${error.status || 'Network Error'}`);
        return throwError(() => error);
      }
      
      if (error.status === 0) {
        // Network error - backend unreachable
        toast?.error('Connection Error', 'Unable to connect to server. Please check if the backend is running.');
      } else if (error.status === 400) {
        // Bad request
        const message = error.error?.message || 'Invalid request data';
        toast?.error('Bad Request', message);
      } else if (error.status === 401) {
        // Unauthorized - session expired (handled by authInterceptor, but show message)
        toast?.warning('Session Expired', 'Please log in again.');
      } else if (error.status === 403) {
        // Forbidden - user is logged in but lacks permission for this action
        // Do NOT show generic error for dashboard data - just silently fail
        if (!endpoint.includes('dashboard') && !endpoint.includes('finance/summary')) {
          toast?.warning('Access Denied', 'You do not have permission to perform this action.');
        }
      } else if (error.status === 404) {
        // Not found
        toast?.error('Not Found', `The requested resource (${endpoint}) was not found.`);
      } else if (error.status === 500) {
        // Server error
        const message = error.error?.message || 'An unexpected server error occurred';
        toast?.error('Server Error', message);
      } else if (error.status >= 400) {
        // Other client/server errors
        const message = error.error?.message || `Request failed with status ${error.status}`;
        toast?.error('Error', message);
      }
      
      return throwError(() => error);
    })
  );
};
