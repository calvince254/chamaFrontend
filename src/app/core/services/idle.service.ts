import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, fromEvent, merge, Subscription, timer } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { SessionService } from './session.service';
import { ApiService } from './api.service';

/**
 * Service that monitors user activity and automatically logs out after idle timeout.
 * The timeout value comes from the tenant's sessionTimeoutMinutes setting.
 */
@Injectable({
  providedIn: 'root'
})
export class IdleService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private activitySubscription?: Subscription;
  private timeoutSubscription?: Subscription;
  private finalTimeoutSubscription?: Subscription;
  private timeoutMinutes = 0; // 0 = disabled
  private warningShown = false;
  private platformId = inject(PLATFORM_ID);
  
  // Events that count as user activity
  private activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor(
    private ngZone: NgZone,
    private router: Router,
    private session: SessionService,
    private api: ApiService
  ) {}

  /**
   * Start monitoring for idle timeout.
   * Call this after successful login.
   */
  startWatching(timeoutMinutes: number): void {
    if (!this.isBrowser) return;
    
    this.stopWatching();
    
    if (!timeoutMinutes || timeoutMinutes <= 0) {
      console.log('Idle timeout disabled (0 minutes)');
      return;
    }
    
    this.timeoutMinutes = timeoutMinutes;
    this.warningShown = false;
    console.log(`Idle monitoring started: ${timeoutMinutes} minute timeout`);
    
    // Run outside Angular zone for better performance
    this.ngZone.runOutsideAngular(() => {
      // Merge all activity events
      const activity$ = merge(
        ...this.activityEvents.map(event => fromEvent(document, event))
      ).pipe(
        debounceTime(1000), // Don't fire too often
        takeUntil(this.destroy$)
      );
      
      // Subscribe to activity - reset timer on each activity
      this.activitySubscription = activity$.subscribe(() => {
        this.resetTimer();
      });
      
      // Start the initial timer
      this.startTimer();
    });
  }

  /**
   * Stop monitoring for idle timeout.
   * Call this on logout.
   */
  stopWatching(): void {
    this.activitySubscription?.unsubscribe();
    this.timeoutSubscription?.unsubscribe();
    this.finalTimeoutSubscription?.unsubscribe();
    this.activitySubscription = undefined;
    this.timeoutSubscription = undefined;
    this.finalTimeoutSubscription = undefined;
    this.warningShown = false;
    this.hideWarning();
    console.log('Idle monitoring stopped');
  }

  private startTimer(): void {
    if (this.timeoutMinutes <= 0) return;
    
    const timeoutMs = this.timeoutMinutes * 60 * 1000;
    const warningMs = timeoutMs - 60000; // Warning 1 minute before timeout
    
    this.timeoutSubscription = timer(warningMs > 0 ? warningMs : timeoutMs).subscribe(() => {
      if (warningMs > 0 && !this.warningShown) {
        // Show warning 1 minute before logout
        this.ngZone.run(() => {
          this.showWarning();
        });
        
        // Set final timeout
        this.finalTimeoutSubscription = timer(60000).subscribe(() => {
          this.ngZone.run(() => {
            this.performLogout();
          });
        });
      } else {
        // No warning, just logout
        this.ngZone.run(() => {
          this.performLogout();
        });
      }
    });
  }

  private resetTimer(): void {
    this.timeoutSubscription?.unsubscribe();
    this.finalTimeoutSubscription?.unsubscribe();
    
    // If warning was shown, hide it on activity
    if (this.warningShown) {
      this.ngZone.run(() => {
        this.hideWarning();
      });
    }
    
    this.warningShown = false;
    this.startTimer();
  }

  private hideWarning(): void {
    if (!this.isBrowser) return;
    
    const warningEl = document.getElementById('idle-warning');
    if (warningEl) {
      warningEl.remove();
    }
    this.warningShown = false;
  }

  /** 
   * Dismiss the warning banner manually (e.g., when user clicks close button).
   * This also resets the idle timer.
   */
  dismissWarning(): void {
    this.resetTimer();
  }

  private showWarning(): void {
    if (!this.isBrowser) return;
    
    // Remove any existing warning first
    this.hideWarning();
    
    this.warningShown = true;
    // Create a simple toast-like warning with close button
    const warningEl = document.createElement('div');
    warningEl.id = 'idle-warning';
    warningEl.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #f59e0b;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>You will be logged out in 1 minute due to inactivity.</span>
        <button id="idle-warning-close" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 8px;
          padding: 0;
        " title="Dismiss (I'm still here)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(warningEl);
    
    // Add click handler for close button
    const closeBtn = document.getElementById('idle-warning-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissWarning();
      });
    }
  }

  private performLogout(): void {
    if (!this.isBrowser) return;
    
    // Remove warning if shown
    document.getElementById('idle-warning')?.remove();
    
    console.log('Logging out due to inactivity');
    
    // Call backend logout endpoint to blacklist the token
    const token = this.session.getToken();
    if (token) {
      this.api.logout().subscribe({
        complete: () => {
          this.completeLogout();
        },
        error: () => {
          // Even if backend call fails, still logout locally
          this.completeLogout();
        }
      });
    } else {
      this.completeLogout();
    }
  }

  private completeLogout(): void {
    this.stopWatching();
    this.session.logout();
    this.router.navigate(['/login'], { 
      queryParams: { reason: 'idle' } 
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopWatching();
  }
}
