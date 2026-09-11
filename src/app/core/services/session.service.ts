import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { CurrentUser } from '../models/models';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  token: string;
  id: number;
  tenantId: number;
  name: string;
  email: string;
  phone: string;
  tenantName: string;
  roleName: string;
  superAdmin: boolean;
  avatarInitials: string;
  permissionCodes: string[];  // New granular permission codes from JWT
}

/**
 * SessionService handles authentication and authorization.
 * Uses the new granular permission codes system.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly user = signal<CurrentUser | null>(null);
  private readonly apiUrl = environment.apiUrl;
  
  // Store permission codes for quick lookup
  private permissionCodes = signal<Set<string>>(new Set());

  currentUser = this.user.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const restored = this.restore();
      if (restored) {
        this.user.set(restored.user);
        this.permissionCodes.set(new Set(restored.codes));
      }
    }
  }

  private restore(): { user: CurrentUser; codes: string[] } | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem('chama.currentUser');
      const token = localStorage.getItem('chama.token');
      const codesRaw = localStorage.getItem('chama.permissionCodes');
      if (raw && token) {
        const user = JSON.parse(raw) as CurrentUser;
        const codes = codesRaw ? JSON.parse(codesRaw) as string[] : [];
        return { user, codes };
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    }
    return null;
  }

  private persist(user: CurrentUser | null, token?: string, codes?: string[]) {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (user && token) {
        localStorage.setItem('chama.currentUser', JSON.stringify(user));
        localStorage.setItem('chama.token', token);
        localStorage.setItem('chama.permissionCodes', JSON.stringify(codes || []));
      } else {
        localStorage.removeItem('chama.currentUser');
        localStorage.removeItem('chama.token');
        localStorage.removeItem('chama.permissionCodes');
      }
    } catch (e) {
      console.error('Failed to persist session:', e);
    }
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return localStorage.getItem('chama.token');
    } catch (e) {
      return null;
    }
  }

  login(email: string, password: string): Observable<boolean> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap(response => {
        const user: CurrentUser = {
          id: response.id,
          name: response.name,
          email: response.email,
          phone: response.phone || '',
          tenantId: response.tenantId,
          tenantName: response.tenantName,
          roleName: response.roleName,
          isSuperAdmin: response.superAdmin,
          avatarInitials: response.avatarInitials || this.getInitials(response.name)
        };
        
        const codes = response.permissionCodes || [];
        this.user.set(user);
        this.permissionCodes.set(new Set(codes));
        this.persist(user, response.token, codes);
      }),
      map(() => true),
      catchError(error => {
        console.error('Login failed:', error);
        return of(false);
      })
    );
  }

  private getInitials(name: string): string {
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  logout() {
    this.user.set(null);
    this.permissionCodes.set(new Set());
    this.persist(null);
  }

  /**
   * Check if user has a specific permission code.
   * Super admin always has all permissions.
   * 
   * @param code Permission code like 'VIEW_MEMBERS', 'DISBURSE_LOAN', etc.
   */
  can(code: string): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.isSuperAdmin) return true;
    return this.permissionCodes().has(code);
  }

  /**
   * Check multiple permissions - returns true if user has ANY of them
   */
  canAny(...codes: string[]): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.isSuperAdmin) return true;
    return codes.some(code => this.permissionCodes().has(code));
  }

  /**
   * Check multiple permissions - returns true if user has ALL of them
   */
  canAll(...codes: string[]): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.isSuperAdmin) return true;
    return codes.every(code => this.permissionCodes().has(code));
  }

  /**
   * Legacy method for backward compatibility.
   * Maps old module+action to new permission codes.
   */
  hasPermission(module: string, action: 'view' | 'create' | 'edit' | 'approve' | 'delete' = 'view'): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.isSuperAdmin) return true;
    
    // Map to new permission code format
    const actionMap: Record<string, string> = {
      'view': 'VIEW',
      'create': 'CREATE',
      'edit': 'EDIT',
      'approve': 'APPROVE',
      'delete': 'DELETE'
    };
    
    const moduleMap: Record<string, string> = {
      'members': 'MEMBERS',
      'contributions': 'CONTRIBUTIONS',
      'loans': 'LOANS',
      'meetings': 'MEETINGS',
      'welfare': 'WELFARE',
      'finance': 'FINANCE',
      'shares': 'SHARES',
      'investments': 'INVESTMENTS',
      'merry-go-round': 'MERRY_GO_ROUND',
      'roles': 'ROLES',
      'settings': 'SETTINGS',
      'dashboard': 'DASHBOARD',
      'fines': 'FINES',
      'penalties': 'PENALTIES'
    };
    
    const actionCode = actionMap[action] || action.toUpperCase();
    const moduleCode = moduleMap[module] || module.toUpperCase().replace(/-/g, '_');
    
    // Try the generic permission code first
    const genericCode = `${actionCode}_${moduleCode}`;
    if (this.permissionCodes().has(genericCode)) {
      return true;
    }
    
    // For 'view' action, also check specific view permissions
    if (action === 'view') {
      // Check for VIEW_MEMBERS, VIEW_LOANS, etc.
      return this.permissionCodes().has(`VIEW_${moduleCode}`);
    }
    
    return false;
  }

  isLoggedIn(): boolean {
    return !!this.user() && !!this.getToken();
  }

  /**
   * Get all current permission codes (for debugging)
   */
  getPermissionCodes(): string[] {
    return Array.from(this.permissionCodes());
  }
}
