import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import {
  Tenant, TenantSettings, Role, Member, Meeting, Contribution, Loan, MerryGoRoundRound,
  ShareEntry, WelfareEvent, WelfareContribution, Investment, InvestmentValueHistory, InvestmentApproval, FinanceSummary, Transaction,
  ContributionType, Penalty, LoanProduct, LoanPenalty, LoanExtended, ShareSettings, ShareCalculation,
  Liquidity, Payout, PayoutPreview, CreatePayoutRequest, PayoutPreviewRequest, MemberFinancialSummary,
  PageResponse, LoanEligibility, LoanIncomeSummary, LoanIncomeTransaction, LoanPayment, RecordPaymentRequest,
  RegistrationFeePayment, RegistrationFeeInfo, Resource, AuditLog, ContributionTopUp, ContributionBalance,
  PaymentSettings, EnabledPaymentMethods, TreasurerDevice, InitiatePaymentRequest, InitiatePaymentResponse,
  GuarantorLiability, CreditScoreResponse
} from '../models/models';

/**
 * ApiService - Real HTTP client for the Spring Boot backend.
 * Replaces MockDataService with actual API calls.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private baseUrl = environment.apiUrl;

  // Helper to check if running in browser
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // ==================== AUTH ====================
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, { email, password });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/logout`, {});
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/register`, data);
  }

  // ==================== TENANTS (Super Admin) ====================
  getTenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(`${this.baseUrl}/tenants`);
  }

  getTenant(id: number): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.baseUrl}/tenants/${id}`);
  }

  createTenant(tenant: Partial<Tenant>): Observable<Tenant> {
    return this.http.post<Tenant>(`${this.baseUrl}/tenants`, tenant);
  }

  updateTenant(id: number, tenant: Partial<Tenant>): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.baseUrl}/tenants/${id}`, tenant);
  }

  deleteTenant(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenants/${id}`);
  }

  // Get members of a specific tenant (for super admin)
  getTenantMembers(tenantId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tenants/${tenantId}/members`);
  }

  // Get roles of a specific tenant (for super admin)
  getTenantRoles(tenantId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/tenants/${tenantId}/roles`);
  }

  // Update member role within a tenant
  updateMemberRole(tenantId: number, memberId: number, roleId: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/tenants/${tenantId}/members/${memberId}/role`, { roleId });
  }

  // Remove member from tenant
  removeMemberFromTenant(tenantId: number, memberId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tenants/${tenantId}/members/${memberId}`);
  }

  // Suspend tenant
  suspendTenant(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tenants/${id}/suspend`, {});
  }

  // Activate tenant
  activateTenant(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tenants/${id}/activate`, {});
  }

  // ==================== TENANT SETTINGS (General Settings for current user's chama) ====================
  getTenantSettings(): Observable<TenantSettings> {
    return this.http.get<TenantSettings>(`${this.baseUrl}/tenants/settings`);
  }

  updateTenantSettings(settings: Partial<TenantSettings>): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/tenants/settings`, settings);
  }

  // ==================== ROLES ====================
  getRoles(): Observable<Role[]> {
    return this.http.get<any[]>(`${this.baseUrl}/roles`).pipe(
      map(roles => roles.map(r => ({
        id: r.id,
        name: r.name,
        isSystemDefault: r.systemDefault,
        permissions: r.permissions?.map((p: any) => ({
          module: p.module,
          view: p.canView ?? p.view,
          create: p.canCreate ?? p.create,
          edit: p.canEdit ?? p.edit,
          approve: p.canApprove ?? p.approve,
          delete: p.canDelete ?? p.delete
        })) || [],
        permissionCodes: r.permissionCodes || [],
        memberCount: r.memberCount || 0
      })))
    );
  }

  getRole(id: number): Observable<Role> {
    return this.http.get<any>(`${this.baseUrl}/roles/${id}`).pipe(
      map(r => ({
        id: r.id,
        name: r.name,
        isSystemDefault: r.systemDefault,
        permissions: r.permissions?.map((p: any) => ({
          module: p.module,
          view: p.canView,
          create: p.canCreate,
          edit: p.canEdit,
          approve: p.canApprove,
          delete: p.canDelete
        })) || [],
        memberCount: r.memberCount || 0
      }))
    );
  }

  createRole(role: Partial<Role>): Observable<Role> {
    return this.http.post<Role>(`${this.baseUrl}/roles`, role);
  }

  updateRole(id: number, role: Partial<Role>): Observable<Role> {
    return this.http.put<Role>(`${this.baseUrl}/roles/${id}`, role);
  }

  updateRolePermissions(id: number, permissions: any[]): Observable<Role> {
    // Frontend permission format matches backend PermissionDto (view, create, edit, approve, delete)
    return this.http.put<Role>(`${this.baseUrl}/roles/${id}/permissions`, permissions);
  }

  /**
   * Update role with granular permission codes
   */
  updateRolePermissionCodes(id: number, permissionCodes: string[]): Observable<Role> {
    return this.http.put<Role>(`${this.baseUrl}/roles/${id}/permission-codes`, permissionCodes);
  }

  /**
   * Get all available permissions grouped by module
   */
  getAvailablePermissions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/permissions`);
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/roles/${id}`);
  }

  // ==================== MEMBERS ====================
  getMembers(): Observable<Member[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<any[]>(`${this.baseUrl}/members`).pipe(
      map(members => members.map(m => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        email: m.email,
        memberNo: m.memberNo,
        joinDate: m.joinDate,
        status: m.status,
        role: m.roleName || m.role?.name || 'Member',
        totalSavings: m.totalSavings || 0,
        totalShares: m.totalShares || 0,
        outstandingLoan: m.outstandingLoan || 0,
        arrearsMonths: m.arrearsMonths || 0
      })))
    );
  }

  getMembersPaginated(page: number = 0, size: number = 10, search?: string, status?: string): Observable<PageResponse<Member>> {
    if (!this.isBrowser) return of({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, first: true, last: true });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    
    return this.http.get<any>(`${this.baseUrl}/members/paginated`, { params }).pipe(
      map(response => ({
        ...response,
        content: response.content.map((m: any) => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          email: m.email,
          memberNo: m.memberNo,
          joinDate: m.joinDate,
          status: m.status,
          role: m.role || m.roleName || m.role?.name || 'Member',
          roleId: m.roleId,
          totalSavings: m.totalSavings || 0,
          totalShares: m.totalShares || 0,
          outstandingLoan: m.outstandingLoan || 0,
          arrearsMonths: m.arrearsMonths || 0
        }))
      }))
    );
  }

  getMember(id: number): Observable<Member> {
    return this.http.get<any>(`${this.baseUrl}/members/${id}`).pipe(
      map(m => ({
        id: m.id,
        name: m.name,
        phone: m.phone,
        email: m.email,
        memberNo: m.memberNo,
        joinDate: m.joinDate,
        status: m.status,
        role: m.roleName || m.role?.name || 'Member',
        totalSavings: m.totalSavings || 0,
        totalShares: m.totalShares || 0,
        outstandingLoan: m.outstandingLoan || 0,
        arrearsMonths: m.arrearsMonths || 0
      }))
    );
  }

  createMember(member: any): Observable<Member> {
    return this.http.post<Member>(`${this.baseUrl}/members`, member);
  }

  updateMember(id: number, member: any): Observable<Member> {
    return this.http.put<Member>(`${this.baseUrl}/members/${id}`, member);
  }

  deleteMember(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/members/${id}`);
  }

  hardDeleteMember(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/members/${id}/hard`);
  }

  resetMemberPassword(memberId: number, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/members/reset-password`, {
      memberId,
      newPassword
    });
  }

  getMemberFinancialSummary(id: number): Observable<MemberFinancialSummary> {
    return this.http.get<MemberFinancialSummary>(`${this.baseUrl}/members/${id}/financial-summary`);
  }

  getMemberTransactionsPaginated(memberId: number, page: number = 0, size: number = 10, type?: string): Observable<PageResponse<Transaction>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (type) params = params.set('type', type);
    
    return this.http.get<PageResponse<Transaction>>(`${this.baseUrl}/members/${memberId}/transactions/paginated`, { params });
  }

  // ==================== MEETINGS ====================
  getMeetings(): Observable<Meeting[]> {
    return this.http.get<any[]>(`${this.baseUrl}/meetings`).pipe(
      map(meetings => meetings.map(m => ({
        id: m.id,
        date: m.date,
        venue: m.venue,
        type: m.type,
        attendeesCount: m.attendeesCount || 0,
        totalMembers: m.totalMembers || 0,
        quorumMet: m.quorumMet || false,
        finesCollected: m.finesCollected || 0,
        minutesStatus: m.minutesStatus || 'DRAFT',
        rsvpAttending: m.rsvpAttending || 0,
        rsvpNotAttending: m.rsvpNotAttending || 0,
        rsvpPending: m.rsvpPending || 0
      })))
    );
  }

  getMeetingsPaginated(page: number = 0, size: number = 10, search?: string): Observable<PageResponse<Meeting>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (search) params = params.set('search', search);
    
    return this.http.get<any>(`${this.baseUrl}/meetings/paginated`, { params }).pipe(
      map(response => ({
        ...response,
        content: response.content.map((m: any) => ({
          id: m.id,
          date: m.date,
          venue: m.venue,
          type: m.type,
          attendeesCount: m.attendeesCount || 0,
          totalMembers: m.totalMembers || 0,
          quorumMet: m.quorumMet || false,
          finesCollected: m.finesCollected || 0,
          minutesStatus: m.minutesStatus || 'DRAFT',
          rsvpAttending: m.rsvpAttending || 0,
          rsvpNotAttending: m.rsvpNotAttending || 0,
          rsvpPending: m.rsvpPending || 0
        }))
      }))
    );
  }

  getMeeting(id: number): Observable<Meeting> {
    return this.http.get<Meeting>(`${this.baseUrl}/meetings/${id}`);
  }

  createMeeting(meeting: any): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.baseUrl}/meetings`, meeting);
  }

  updateMeeting(id: number, meeting: any): Observable<Meeting> {
    return this.http.put<Meeting>(`${this.baseUrl}/meetings/${id}`, meeting);
  }

  deleteMeeting(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/meetings/${id}`);
  }

  // Meeting RSVP
  getMeetingAttendees(meetingId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/meetings/${meetingId}/attendees`);
  }

  getMyRsvp(meetingId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/meetings/${meetingId}/my-rsvp`);
  }

  submitRsvp(meetingId: number, request: { attending: boolean; declineReason?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/rsvp`, request);
  }

  markAttendance(meetingId: number, memberId: number, attended: boolean): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/attendance/${memberId}?attended=${attended}`, {});
  }

  // Mark attendance with selected fines (for marking absent with specific fines)
  markAttendanceWithFines(meetingId: number, memberId: number, attended: boolean, fineTypeIds: number[]): Observable<any> {
    let url = `${this.baseUrl}/meetings/${meetingId}/attendance/${memberId}/with-fines?attended=${attended}`;
    if (fineTypeIds && fineTypeIds.length > 0) {
      url += `&fineTypeIds=${fineTypeIds.join(',')}`;
    }
    return this.http.post<any>(url, {});
  }

  getRsvpSummary(meetingId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/meetings/${meetingId}/rsvp-summary`);
  }

  // Meeting Details (with fines summary)
  getMeetingDetails(meetingId: number): Observable<Meeting> {
    return this.http.get<Meeting>(`${this.baseUrl}/meetings/${meetingId}/details`);
  }

  // Add/Remove members from meeting
  addMemberToMeeting(meetingId: number, memberId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/invites/${memberId}`, {});
  }

  removeMemberFromMeeting(meetingId: number, memberId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/meetings/${meetingId}/invites/${memberId}`);
  }

  getUninvitedMembers(meetingId: number): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.baseUrl}/meetings/${meetingId}/uninvited-members`);
  }

  // ==================== MEETING MINUTES ====================
  uploadMeetingMinutes(meetingId: number, file: File): Observable<Meeting> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Meeting>(`${this.baseUrl}/meetings/${meetingId}/minutes/upload`, formData);
  }

  downloadMeetingMinutes(meetingId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/meetings/${meetingId}/minutes/download`, {
      responseType: 'blob'
    });
  }

  viewMeetingMinutes(meetingId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/meetings/${meetingId}/minutes/view`, {
      responseType: 'blob'
    });
  }

  deleteMeetingMinutes(meetingId: number): Observable<Meeting> {
    return this.http.delete<Meeting>(`${this.baseUrl}/meetings/${meetingId}/minutes`);
  }

  confirmMeetingMinutes(meetingId: number): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.baseUrl}/meetings/${meetingId}/minutes/confirm`, {});
  }

  getMeetingMinutesUrl(meetingId: number): string {
    return `${this.baseUrl}/meetings/${meetingId}/minutes/view`;
  }

  /**
   * Generate meeting minutes document with real data from the system
   * Returns DOC file for editing in Word
   */
  generateMeetingMinutes(meetingId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/meetings/${meetingId}/minutes/generate`, {
      responseType: 'blob',
      headers: { 'Accept': 'application/msword' }
    });
  }

  // ==================== FINE TYPES (Settings) ====================
  getFineTypes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/fine-types`);
  }

  getActiveFineTypes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/fine-types/active`);
  }

  createFineType(fineType: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/fine-types`, fineType);
  }

  updateFineType(id: number, fineType: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/fine-types/${id}`, fineType);
  }

  deleteFineType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/fine-types/${id}`);
  }

  // ==================== FINES (Meeting-related) ====================
  getMeetingFines(meetingId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/meetings/${meetingId}/fines`);
  }

  getMemberMeetingFines(meetingId: number, memberId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/meetings/${meetingId}/fines/member/${memberId}`);
  }

  imposeFine(meetingId: number, request: { memberId: number; fineTypeId: number; notes?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/fines`, request);
  }

  markFinePaid(meetingId: number, fineId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/fines/${fineId}/pay`, {});
  }

  markFineUnpaid(meetingId: number, fineId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/fines/${fineId}/unpay`, {});
  }

  waiveFine(meetingId: number, fineId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/fines/${fineId}/waive`, {});
  }

  deleteFine(meetingId: number, fineId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/meetings/${meetingId}/fines/${fineId}`);
  }

  recordFinePayment(meetingId: number, fineId: number, amount: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/meetings/${meetingId}/fines/${fineId}/pay`, { amount });
  }

  // ==================== CONTRIBUTIONS ====================
  getContributions(month?: string, contributionTypeId?: number): Observable<Contribution[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (contributionTypeId) params = params.set('contributionTypeId', contributionTypeId.toString());
    
    return this.http.get<any[]>(`${this.baseUrl}/contributions`, { params }).pipe(
      map(contributions => contributions.map(c => ({
        id: c.id,
        memberId: c.memberId,
        memberName: c.memberName || c.member?.name || '',
        memberNo: c.memberNo || c.member?.memberNo || '',
        month: c.month,
        amountDue: c.amountDue || 0,
        amountPaid: c.amountPaid || 0,
        status: c.status,
        penalty: c.penalty || 0,
        paidOn: c.paidOn,
        dueDate: c.dueDate,
        penaltyApplied: c.penaltyApplied || false,
        contributionTypeId: c.contributionTypeId,
        contributionTypeName: c.contributionTypeName
      })))
    );
  }

  getContributionsPaginated(page: number = 0, size: number = 10, contributionTypeId?: number, month?: string, status?: string): Observable<PageResponse<Contribution>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (contributionTypeId) params = params.set('contributionTypeId', contributionTypeId.toString());
    if (month) params = params.set('month', month);
    if (status) params = params.set('status', status);
    
    return this.http.get<any>(`${this.baseUrl}/contributions/paginated`, { params }).pipe(
      map(response => ({
        ...response,
        content: response.content.map((c: any) => ({
          id: c.id,
          memberId: c.memberId,
          memberName: c.memberName || c.member?.name || '',
          memberNo: c.memberNo || c.member?.memberNo || '',
          month: c.month,
          amountDue: c.amountDue || 0,
          amountPaid: c.amountPaid || 0,
          status: c.status,
          penalty: c.penalty || 0,
          paidOn: c.paidOn,
          dueDate: c.dueDate,
          penaltyApplied: c.penaltyApplied || false,
          contributionTypeId: c.contributionTypeId,
          contributionTypeName: c.contributionTypeName,
          hasPendingClaim: c.hasPendingClaim || false,
          payableId: c.payableId
        }))
      }))
    );
  }

  getContribution(id: number): Observable<Contribution> {
    return this.http.get<Contribution>(`${this.baseUrl}/contributions/${id}`);
  }

  createContribution(contribution: any): Observable<Contribution> {
    return this.http.post<Contribution>(`${this.baseUrl}/contributions`, contribution);
  }

  updateContribution(id: number, contribution: any): Observable<Contribution> {
    return this.http.put<Contribution>(`${this.baseUrl}/contributions/${id}`, contribution);
  }

  recordPayment(id: number, amount: number): Observable<Contribution> {
    return this.http.post<Contribution>(`${this.baseUrl}/contributions/${id}/pay`, { amount });
  }

  /**
   * Generate contribution records for selected members (or all if memberIds empty)
   */
  generateContributions(contributionTypeId: number, month: string, memberIds?: number[]): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/contributions/generate`, {
      contributionTypeId,
      month,
      memberIds: memberIds || []
    });
  }

  /**
   * Get members who don't have contributions for a specific type and month
   */
  getAvailableMembersForContribution(contributionTypeId: number, month: string): Observable<{id: number, name: string, memberNo: string}[]> {
    return this.http.get<{id: number, name: string, memberNo: string}[]>(
      `${this.baseUrl}/contributions/available-members?contributionTypeId=${contributionTypeId}&month=${month}`
    );
  }

  /**
   * Generate contribution records for all active contribution types for a month
   */
  generateAllContributions(month: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/contributions/generate-all?month=${month}`, {});
  }

  /**
   * Check and impose penalties for overdue contributions for a specific month
   */
  checkAndImposePenalties(month: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/contributions/check-penalties?month=${month}`, {});
  }

  // ==================== LOANS ====================
  getLoans(): Observable<Loan[]> {
    return this.http.get<any[]>(`${this.baseUrl}/loans`).pipe(
      map(loans => loans.map(l => ({
        id: l.id,
        memberName: l.memberName || l.member?.name || '',
        principal: l.principal || 0,
        interestRate: l.interestRate || 0,
        termMonths: l.termMonths || 0,
        balanceOutstanding: l.balanceOutstanding || 0,
        status: l.status,
        guarantors: l.guarantorNames || l.guarantors?.map((g: any) => g.name) || [],
        disbursedOn: l.disbursedOn,
        nextDueDate: l.nextDueDate
      })))
    );
  }

  getLoansPaginated(page: number = 0, size: number = 10, status?: string): Observable<PageResponse<LoanExtended>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);
    
    return this.http.get<PageResponse<LoanExtended>>(`${this.baseUrl}/loans/paginated`, { params });
  }

  getMyLoansPaginated(page: number = 0, size: number = 10, status?: string): Observable<PageResponse<LoanExtended>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);
    
    return this.http.get<PageResponse<LoanExtended>>(`${this.baseUrl}/loans/my-loans/paginated`, { params });
  }

  getLoan(id: number): Observable<Loan> {
    return this.http.get<any>(`${this.baseUrl}/loans/${id}`).pipe(
      map(l => ({
        id: l.id,
        memberName: l.memberName || l.member?.name || '',
        principal: l.principal || 0,
        interestRate: l.interestRate || 0,
        termMonths: l.termMonths || 0,
        balanceOutstanding: l.balanceOutstanding || 0,
        status: l.status,
        guarantors: l.guarantorNames || l.guarantors?.map((g: any) => g.name) || [],
        disbursedOn: l.disbursedOn,
        nextDueDate: l.nextDueDate
      }))
    );
  }

  applyForLoan(loan: any): Observable<Loan> {
    return this.http.post<Loan>(`${this.baseUrl}/loans`, loan);
  }

  approveLoan(id: number): Observable<Loan> {
    return this.http.post<Loan>(`${this.baseUrl}/loans/${id}/approve`, {});
  }

  rejectLoan(id: number, reason?: string): Observable<Loan> {
    return this.http.post<Loan>(`${this.baseUrl}/loans/${id}/reject`, { reason });
  }

  disburseLoan(id: number): Observable<Loan> {
    return this.http.post<Loan>(`${this.baseUrl}/loans/${id}/disburse`, {});
  }

  recordLoanRepayment(id: number, amount: number): Observable<Loan> {
    return this.http.post<Loan>(`${this.baseUrl}/loans/${id}/repay`, { amount });
  }

  // ==================== MERRY-GO-ROUND ====================
  getMerryGoRound(): Observable<MerryGoRoundRound[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round`).pipe(
      map(rounds => rounds.map(r => ({
        id: r.id,
        cycleId: r.cycleId,
        cycleName: r.cycleName || r.cycle?.name || '',
        recipientId: r.recipientId,
        recipientName: r.recipientName || r.recipient?.name || '',
        payoutDate: r.payoutDate,
        amount: r.amount || 0,
        status: r.status,
        position: r.position || 0,
        paidContributions: r.paidContributions || 0,
        totalContributions: r.totalContributions || 0
      })))
    );
  }

  getMerryGoRoundCycles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round/cycles`);
  }

  getMerryGoRoundCycle(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/merry-go-round/cycles/${id}`);
  }

  createMerryGoRoundCycle(cycle: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/cycles`, cycle);
  }

  updateMerryGoRoundCycle(id: number, cycle: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/merry-go-round/cycles/${id}`, cycle);
  }

  deleteMerryGoRoundCycle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/merry-go-round/cycles/${id}`);
  }

  // Participants
  getMgrParticipants(cycleId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/participants`);
  }

  addMgrParticipant(cycleId: number, memberId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/participants/${memberId}`, {});
  }

  removeMgrParticipant(cycleId: number, memberId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/participants/${memberId}`);
  }

  reorderMgrParticipants(cycleId: number, memberIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/participants/reorder`, memberIds);
  }

  // Rounds
  getMgrRoundsByCycle(cycleId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/rounds`);
  }

  getMgrRound(roundId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/merry-go-round/rounds/${roundId}`);
  }

  markMgrRoundPaid(roundId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/rounds/${roundId}/pay`, {});
  }

  makeMgrRoundPayout(roundId: number, amount?: number): Observable<any> {
    const body = amount ? { amount } : {};
    return this.http.post(`${this.baseUrl}/merry-go-round/rounds/${roundId}/payout`, body);
  }

  // Contributions
  getMgrContributionsByRound(roundId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round/rounds/${roundId}/contributions`);
  }

  getMgrContributionsByCycle(cycleId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/contributions`);
  }

  markMgrContributionPaid(contributionId: number, paymentRef?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/contributions/${contributionId}/pay`, 
      paymentRef ? { paymentReference: paymentRef } : {});
  }

  markMultipleMgrContributionsPaid(contributionIds: number[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}/merry-go-round/contributions/pay-multiple`, contributionIds);
  }

  // Fines
  getMgrFinesByCycle(cycleId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/fines`);
  }

  getMyMgrFinesByCycle(cycleId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/merry-go-round/cycles/${cycleId}/my-fines`);
  }

  imposeMgrFine(request: { cycleId: number; reason: string; amount: number; memberIds: number[] }): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}/merry-go-round/fines`, request);
  }

  imposeMgrFineForContribution(contributionId: number, reason?: string, amount?: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/contributions/${contributionId}/fine`, { reason, amount });
  }

  payMgrFine(fineId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/fines/${fineId}/pay`, {});
  }

  initiateMgrFinePayment(fineId: number, request: InitiatePaymentRequest): Observable<InitiatePaymentResponse> {
    return this.http.post<InitiatePaymentResponse>(`${this.baseUrl}/merry-go-round/fines/${fineId}/initiate-payment`, request);
  }

  recordMgrFinePayment(fineId: number, amount?: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/fines/${fineId}/record-payment`, { amount });
  }

  waiveMgrFine(fineId: number, reason: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/fines/${fineId}/waive`, { reason });
  }

  // Summary
  getMgrSummary(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/merry-go-round/summary`);
  }

  markRoundPaid(roundId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/merry-go-round/rounds/${roundId}/pay`, {});
  }

  // ==================== SHARES ====================
  // Legacy share purchase system
  getLegacyShares(): Observable<ShareEntry[]> {
    return this.http.get<any[]>(`${this.baseUrl}/shares/legacy`).pipe(
      map(shares => shares.map(s => ({
        id: s.id,
        memberName: s.memberName || s.member?.name || '',
        sharesOwned: s.sharesOwned || 0,
        shareValue: s.shareValue || 0,
        totalValue: s.totalValue || 0,
        lastPurchaseDate: s.lastPurchaseDate
      })))
    );
  }

  purchaseShares(memberId: number, quantity: number): Observable<ShareEntry> {
    return this.http.post<ShareEntry>(`${this.baseUrl}/shares/purchase`, { memberId, quantity });
  }

  // New share calculation system
  getShareSettings(): Observable<ShareSettings> {
    return this.http.get<ShareSettings>(`${this.baseUrl}/shares/settings`);
  }

  saveShareSettings(settings: ShareSettings): Observable<ShareSettings> {
    return this.http.put<ShareSettings>(`${this.baseUrl}/shares/settings`, settings);
  }

  getShareCalculation(): Observable<ShareCalculation> {
    return this.http.get<ShareCalculation>(`${this.baseUrl}/shares`);
  }

  // ==================== PAYOUTS ====================
  getLiquidity(): Observable<Liquidity> {
    return this.http.get<Liquidity>(`${this.baseUrl}/payouts/liquidity`);
  }

  getGuarantorLiabilities(memberId: number): Observable<GuarantorLiability[]> {
    return this.http.get<GuarantorLiability[]>(`${this.baseUrl}/payouts/guarantor-liabilities/${memberId}`);
  }

  previewPayout(request: PayoutPreviewRequest): Observable<PayoutPreview> {
    return this.http.post<PayoutPreview>(`${this.baseUrl}/payouts/preview`, request);
  }

  getPayouts(): Observable<Payout[]> {
    return this.http.get<Payout[]>(`${this.baseUrl}/payouts`);
  }

  getPayoutsPaginated(page: number = 0, size: number = 10, status?: string): Observable<PageResponse<Payout>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);
    
    return this.http.get<PageResponse<Payout>>(`${this.baseUrl}/payouts/paginated`, { params });
  }

  getPayout(id: number): Observable<Payout> {
    return this.http.get<Payout>(`${this.baseUrl}/payouts/${id}`);
  }

  createPayout(request: CreatePayoutRequest): Observable<Payout> {
    return this.http.post<Payout>(`${this.baseUrl}/payouts`, request);
  }

  submitPayoutForApproval(id: number): Observable<Payout> {
    return this.http.post<Payout>(`${this.baseUrl}/payouts/${id}/submit`, {});
  }

  approvePayout(id: number): Observable<Payout> {
    return this.http.post<Payout>(`${this.baseUrl}/payouts/${id}/approve`, {});
  }

  cancelPayout(id: number, reason?: string): Observable<Payout> {
    return this.http.post<Payout>(`${this.baseUrl}/payouts/${id}/cancel`, { reason });
  }

  markMemberPaid(payoutId: number, memberId: number, paymentReference?: string): Observable<Payout> {
    return this.http.post<Payout>(`${this.baseUrl}/payouts/${payoutId}/members/${memberId}/paid`, { paymentReference });
  }

  markAllPaid(payoutId: number): Observable<Payout> {
    return this.http.post<Payout>(`${this.baseUrl}/payouts/${payoutId}/mark-all-paid`, {});
  }

  // ==================== WELFARE ====================
  getWelfareEvents(): Observable<WelfareEvent[]> {
    return this.http.get<any[]>(`${this.baseUrl}/welfare`).pipe(
      map(events => events.map(e => ({
        id: e.id,
        memberId: e.memberId,
        memberName: e.memberName || e.member?.name || '',
        eventType: e.eventType,
        relation: e.relation || '',
        dateReported: e.dateReported,
        amountPerMember: e.amountPerMember || 0,
        totalExpected: e.totalExpected || 0,
        totalCollected: e.totalCollected || 0,
        status: e.status,
        description: e.description,
        allMembersInvolved: e.allMembersInvolved ?? true,
        totalInvolved: e.totalInvolved || 0,
        paidCount: e.paidCount || 0
      })))
    );
  }

  getWelfareEventsPaginated(page: number = 0, size: number = 10, status?: string): Observable<PageResponse<WelfareEvent>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);
    
    return this.http.get<PageResponse<WelfareEvent>>(`${this.baseUrl}/welfare/paginated`, { params });
  }

  getWelfareEvent(id: number): Observable<WelfareEvent> {
    return this.http.get<WelfareEvent>(`${this.baseUrl}/welfare/${id}`);
  }

  createWelfareEvent(event: any): Observable<WelfareEvent> {
    return this.http.post<WelfareEvent>(`${this.baseUrl}/welfare`, event);
  }

  updateWelfareEvent(id: number, event: any): Observable<WelfareEvent> {
    return this.http.put<WelfareEvent>(`${this.baseUrl}/welfare/${id}`, event);
  }

  closeWelfareEvent(id: number): Observable<WelfareEvent> {
    return this.http.post<WelfareEvent>(`${this.baseUrl}/welfare/${id}/close`, {});
  }

  // Welfare Contributions
  getWelfareContributions(eventId: number): Observable<WelfareContribution[]> {
    return this.http.get<WelfareContribution[]>(`${this.baseUrl}/welfare/${eventId}/contributions`);
  }

  updateWelfareContributionPayment(eventId: number, memberId: number, paid: boolean): Observable<WelfareContribution> {
    return this.http.put<WelfareContribution>(`${this.baseUrl}/welfare/${eventId}/contributions/${memberId}`, { paid });
  }

  markAllWelfareContributionsPaid(eventId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/welfare/${eventId}/contributions/mark-all-paid`, {});
  }

  // ==================== INVESTMENTS ====================
  getInvestments(): Observable<Investment[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<any[]>(`${this.baseUrl}/investments`).pipe(
      map(investments => investments.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category,
        amountInvested: i.amountInvested || 0,
        currentValue: i.currentValue || 0,
        approvalStatus: i.approvalStatus,
        status: i.status || 'ACTIVE',
        dateInvested: i.dateInvested,
        description: i.description,
        netGain: i.netGain,
        returnPercentage: i.returnPercentage,
        approvedBy: i.approvedBy,
        approvedAt: i.approvedAt,
        rejectionReason: i.rejectionReason,
        soldDate: i.soldDate,
        soldAmount: i.soldAmount,
        soldBy: i.soldBy,
        soldNotes: i.soldNotes,
        finalGain: i.finalGain,
        requiresApproval: i.requiresApproval,
        requiredApprovals: i.requiredApprovals,
        approvals: i.approvals || [],
        approvalCount: i.approvalCount,
        rejectionCount: i.rejectionCount,
        pendingCount: i.pendingCount,
        createdByMemberId: i.createdByMemberId,
        createdByMemberName: i.createdByMemberName
      })))
    );
  }

  getInvestmentsPaginated(page: number = 0, size: number = 10, status?: string, approvalStatus?: string): Observable<PageResponse<Investment>> {
    if (!this.isBrowser) return of({ content: [], totalElements: 0, totalPages: 0, size: size, page: page, first: true, last: true });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);
    if (approvalStatus) params = params.set('approvalStatus', approvalStatus);
    
    return this.http.get<PageResponse<Investment>>(`${this.baseUrl}/investments/paginated`, { params });
  }

  getInvestment(id: number): Observable<Investment> {
    return this.http.get<Investment>(`${this.baseUrl}/investments/${id}`);
  }

  createInvestment(investment: any): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments`, investment);
  }

  updateInvestment(id: number, investment: any): Observable<Investment> {
    return this.http.put<Investment>(`${this.baseUrl}/investments/${id}`, investment);
  }

  approveInvestment(id: number): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/approve`, {});
  }

  rejectInvestment(id: number, reason?: string): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/reject`, { reason });
  }

  updateInvestmentValue(id: number, newValue: number, notes?: string): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/value`, { newValue, notes });
  }

  sellInvestment(id: number, soldAmount: number, soldDate?: string, notes?: string): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/sell`, { soldAmount, soldDate, notes });
  }

  // New partial sale method
  sellInvestmentPartial(id: number, saleAmount: number, saleDate: string, sellAll: boolean, unitsToSell?: number, notes?: string): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/sell`, {
      saleAmount,
      saleDate,
      sellAll,
      unitsToSell,
      notes
    });
  }

  // Get sale history
  getInvestmentSaleHistory(id: number): Observable<any[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<any[]>(`${this.baseUrl}/investments/${id}/sales`);
  }

  writeOffInvestment(id: number, reason?: string): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/write-off`, { reason });
  }

  deleteInvestment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/investments/${id}`);
  }

  getInvestmentValueHistory(id: number): Observable<InvestmentValueHistory[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<InvestmentValueHistory[]>(`${this.baseUrl}/investments/${id}/history`);
  }

  // Investment approval workflow
  submitInvestmentVote(id: number, approve: boolean, comments?: string): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/vote`, { approve, comments });
  }

  getMyPendingApprovals(): Observable<InvestmentApproval[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<InvestmentApproval[]>(`${this.baseUrl}/investments/my-pending-approvals`);
  }

  countMyPendingApprovals(): Observable<{ count: number }> {
    if (!this.isBrowser) return of({ count: 0 });
    return this.http.get<{ count: number }>(`${this.baseUrl}/investments/my-pending-approvals/count`);
  }

  topupInvestment(id: number, amount: number, topupDate?: string, notes?: string): Observable<Investment> {
    return this.http.post<Investment>(`${this.baseUrl}/investments/${id}/topup`, { amount, topupDate, notes });
  }

  getInvestmentTopupHistory(id: number): Observable<any[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<any[]>(`${this.baseUrl}/investments/${id}/topups`);
  }

  getInvestmentApprovals(id: number): Observable<InvestmentApproval[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<InvestmentApproval[]>(`${this.baseUrl}/investments/${id}/approvals`);
  }

  // ==================== FINANCE ====================
  getFinanceSummary(): Observable<FinanceSummary> {
    return this.http.get<FinanceSummary>(`${this.baseUrl}/finance/summary`);
  }

  getTransactions(): Observable<Transaction[]> {
    return this.http.get<any[]>(`${this.baseUrl}/finance/transactions`).pipe(
      map(transactions => transactions.map(t => ({
        id: t.id,
        date: t.date,
        type: t.type,
        description: t.description,
        amount: t.amount || 0,
        direction: t.direction
      })))
    );
  }

  getTransactionsPaginated(page: number = 0, size: number = 10, type?: string, direction?: string, memberId?: number): Observable<PageResponse<Transaction>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (type) params = params.set('type', type);
    if (direction) params = params.set('direction', direction);
    if (memberId) params = params.set('memberId', memberId.toString());
    
    return this.http.get<PageResponse<Transaction>>(`${this.baseUrl}/finance/transactions/paginated`, { params });
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/finance/dashboard`);
  }

  // ==================== CONTRIBUTION TYPES (Settings) ====================
  getContributionTypes(): Observable<ContributionType[]> {
    return this.http.get<ContributionType[]>(`${this.baseUrl}/contribution-types`);
  }

  getActiveContributionTypes(): Observable<ContributionType[]> {
    return this.http.get<ContributionType[]>(`${this.baseUrl}/contribution-types/active`);
  }

  getContributionType(id: number): Observable<ContributionType> {
    return this.http.get<ContributionType>(`${this.baseUrl}/contribution-types/${id}`);
  }

  createContributionType(contributionType: Partial<ContributionType>): Observable<ContributionType> {
    return this.http.post<ContributionType>(`${this.baseUrl}/contribution-types`, contributionType);
  }

  updateContributionType(id: number, contributionType: Partial<ContributionType>): Observable<ContributionType> {
    return this.http.put<ContributionType>(`${this.baseUrl}/contribution-types/${id}`, contributionType);
  }

  deleteContributionType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/contribution-types/${id}`);
  }

  // ==================== PENALTIES (Auto-Fines) ====================
  getPenalties(month?: string): Observable<Penalty[]> {
    let url = `${this.baseUrl}/penalties`;
    if (month) {
      url += `?month=${month}`;
    }
    return this.http.get<Penalty[]>(url);
  }

  getPenaltiesPaginated(page: number = 0, size: number = 10, status?: string, memberId?: number, penaltyType?: string): Observable<PageResponse<Penalty>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);
    if (memberId) params = params.set('memberId', memberId.toString());
    if (penaltyType) params = params.set('penaltyType', penaltyType);
    
    return this.http.get<PageResponse<Penalty>>(`${this.baseUrl}/penalties/paginated`, { params });
  }

  getUnpaidPenalties(): Observable<Penalty[]> {
    return this.http.get<Penalty[]>(`${this.baseUrl}/penalties/unpaid`);
  }

  getMemberPenalties(memberId: number): Observable<Penalty[]> {
    return this.http.get<Penalty[]>(`${this.baseUrl}/penalties/member/${memberId}`);
  }

  getPenalty(id: number): Observable<Penalty> {
    return this.http.get<Penalty>(`${this.baseUrl}/penalties/${id}`);
  }

  recordPenaltyPayment(id: number, amount: number): Observable<Penalty> {
    return this.http.post<Penalty>(`${this.baseUrl}/penalties/${id}/pay`, { amount });
  }

  waivePenalty(id: number): Observable<Penalty> {
    return this.http.post<Penalty>(`${this.baseUrl}/penalties/${id}/waive`, {});
  }

  deletePenalty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/penalties/${id}`);
  }

  // ==================== LOAN PRODUCTS ====================
  getLoanProducts(): Observable<LoanProduct[]> {
    return this.http.get<LoanProduct[]>(`${this.baseUrl}/loan-products`);
  }

  getActiveLoanProducts(): Observable<LoanProduct[]> {
    return this.http.get<LoanProduct[]>(`${this.baseUrl}/loan-products/active`);
  }

  getLoanProduct(id: number): Observable<LoanProduct> {
    return this.http.get<LoanProduct>(`${this.baseUrl}/loan-products/${id}`);
  }

  createLoanProduct(product: Partial<LoanProduct>): Observable<LoanProduct> {
    return this.http.post<LoanProduct>(`${this.baseUrl}/loan-products`, product);
  }

  updateLoanProduct(id: number, product: Partial<LoanProduct>): Observable<LoanProduct> {
    return this.http.put<LoanProduct>(`${this.baseUrl}/loan-products/${id}`, product);
  }

  deleteLoanProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/loan-products/${id}`);
  }

  // ==================== LOANS (Extended) ====================
  getLoansExtended(): Observable<LoanExtended[]> {
    return this.http.get<LoanExtended[]>(`${this.baseUrl}/loans`);
  }

  getMyLoans(): Observable<LoanExtended[]> {
    return this.http.get<LoanExtended[]>(`${this.baseUrl}/loans/my-loans`);
  }

  getPendingApprovals(): Observable<LoanExtended[]> {
    return this.http.get<LoanExtended[]>(`${this.baseUrl}/loans/pending-approvals`);
  }

  getLoanExtended(id: number): Observable<LoanExtended> {
    return this.http.get<LoanExtended>(`${this.baseUrl}/loans/${id}`);
  }

  applyForLoanExtended(loan: any, isAdmin: boolean = false): Observable<LoanExtended> {
    return this.http.post<LoanExtended>(`${this.baseUrl}/loans/apply?isAdmin=${isAdmin}`, loan);
  }

  checkLoanEligibility(memberId: number, guarantorIds: number[], loanAmount: number): Observable<LoanEligibility> {
    return this.http.post<LoanEligibility>(`${this.baseUrl}/loans/check-eligibility`, {
      memberId,
      guarantorIds,
      loanAmount
    });
  }

  getMyCreditScore(): Observable<CreditScoreResponse> {
    return this.http.get<CreditScoreResponse>(`${this.baseUrl}/loans/my-credit-score`);
  }

  approveLoanExtended(id: number, comments?: string): Observable<LoanExtended> {
    return this.http.post<LoanExtended>(`${this.baseUrl}/loans/${id}/approve`, { comments });
  }

  approveAsGuarantor(id: number, comments?: string): Observable<LoanExtended> {
    return this.http.post<LoanExtended>(`${this.baseUrl}/loans/${id}/approve-guarantor`, { comments });
  }

  rejectLoanExtended(id: number, reason: string, asGuarantor: boolean = false): Observable<LoanExtended> {
    return this.http.post<LoanExtended>(`${this.baseUrl}/loans/${id}/reject`, { reason, asGuarantor: asGuarantor.toString() });
  }

  disburseLoanExtended(id: number): Observable<LoanExtended> {
    return this.http.post<LoanExtended>(`${this.baseUrl}/loans/${id}/disburse`, {});
  }

  recordLoanRepaymentExtended(id: number, amount: number): Observable<LoanExtended> {
    return this.http.post<LoanExtended>(`${this.baseUrl}/loans/${id}/repay?amount=${amount}`, {});
  }

  // ==================== LOAN INCOME ====================
  getLoanIncomeSummary(startDate?: string, endDate?: string): Observable<LoanIncomeSummary> {
    let url = `${this.baseUrl}/loans/income/summary`;
    const params: string[] = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    if (params.length > 0) url += '?' + params.join('&');
    return this.http.get<LoanIncomeSummary>(url);
  }

  getLoanIncomeTransactions(page: number = 0, size: number = 20): Observable<PageResponse<LoanIncomeTransaction>> {
    return this.http.get<PageResponse<LoanIncomeTransaction>>(
      `${this.baseUrl}/loans/income/transactions?page=${page}&size=${size}`
    );
  }

  // ==================== LOAN PAYMENT ====================
  
  recordLoanPayment(loanId: number, request: RecordPaymentRequest): Observable<LoanPayment> {
    return this.http.post<LoanPayment>(`${this.baseUrl}/loans/${loanId}/payments/record`, request);
  }

  getLoanPayments(loanId: number): Observable<LoanPayment[]> {
    return this.http.get<LoanPayment[]>(`${this.baseUrl}/loans/${loanId}/payments`);
  }

  getMyLoanPayments(): Observable<LoanPayment[]> {
    return this.http.get<LoanPayment[]>(`${this.baseUrl}/loans/payments/my-payments`);
  }

  // ==================== LOAN PENALTIES ====================
  getLoanPenalties(): Observable<LoanPenalty[]> {
    return this.http.get<LoanPenalty[]>(`${this.baseUrl}/loans/penalties`);
  }

  getMyLoanPenalties(): Observable<LoanPenalty[]> {
    return this.http.get<LoanPenalty[]>(`${this.baseUrl}/loans/penalties/my-penalties`);
  }

  getLoanPenaltiesForLoan(loanId: number): Observable<LoanPenalty[]> {
    return this.http.get<LoanPenalty[]>(`${this.baseUrl}/loans/${loanId}/penalties`);
  }

  getLoanPenalty(id: number): Observable<LoanPenalty> {
    return this.http.get<LoanPenalty>(`${this.baseUrl}/loans/penalties/${id}`);
  }

  waiveLoanPenalty(id: number, reason: string): Observable<LoanPenalty> {
    return this.http.post<LoanPenalty>(`${this.baseUrl}/loans/penalties/${id}/waive`, { reason });
  }

  payLoanPenalty(id: number, amount: number): Observable<LoanPenalty> {
    return this.http.post<LoanPenalty>(`${this.baseUrl}/loans/penalties/${id}/pay?amount=${amount}`, {});
  }

  getLoanPenaltySummary(): Observable<any> {
    return this.http.get(`${this.baseUrl}/loans/penalties/summary`);
  }

  processOverdueLoans(): Observable<any> {
    return this.http.post(`${this.baseUrl}/loans/process-overdue`, {});
  }

  // ==================== SYSTEM SETTINGS (Super Admin) ====================
  getSystemSettings(): Observable<any> {
    return this.http.get(`${this.baseUrl}/system-settings`);
  }

  updateSystemSettings(settings: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/system-settings`, settings);
  }

  // ==================== LICENSE MANAGEMENT (Super Admin) ====================
  getLicenses(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses`);
  }

  getLicenseByTenant(tenantId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/licenses/tenant/${tenantId}`);
  }

  createLicense(tenantId: number, license: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/tenant/${tenantId}`, license);
  }

  updateLicense(licenseId: number, license: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/licenses/${licenseId}`, license);
  }

  activateLicense(licenseId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/${licenseId}/activate`, {});
  }

  suspendLicense(licenseId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/${licenseId}/suspend`, {});
  }

  getLicenseTransactions(tenantId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses/transactions/tenant/${tenantId}`);
  }

  getUninvoicedTransactions(tenantId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses/transactions/tenant/${tenantId}/uninvoiced`);
  }

  // Invoice management
  getOutstandingInvoices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses/invoices/outstanding`);
  }

  getPaidInvoices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses/invoices/paid`);
  }

  getBillableTransactions(year: number, month: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses/transactions/billable?year=${year}&month=${month}`);
  }

  getInvoicesByTenant(tenantId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses/invoices/tenant/${tenantId}`);
  }

  getInvoice(invoiceId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/licenses/invoices/${invoiceId}`);
  }

  generateInvoice(request: { tenantId: number; periodStart: string; periodEnd: string; isAdhoc?: boolean; description?: string; amount?: number }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/generate`, request);
  }

  sendInvoice(invoiceId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/${invoiceId}/send`, {});
  }

  recordInvoicePayment(invoiceId: number, amount: number, paymentReference?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/${invoiceId}/payment`, { amount, paymentReference });
  }

  markInvoicePaid(invoiceId: number, paymentReference?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/${invoiceId}/mark-paid`, { paymentReference });
  }

  cancelInvoice(invoiceId: number, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/${invoiceId}/cancel`, reason || 'Cancelled');
  }

  checkOverdueInvoices(): Observable<string> {
    return this.http.post(`${this.baseUrl}/licenses/check-overdue`, {}, { responseType: 'text' });
  }

  // For chama admins - get their own invoices
  getMyInvoices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/licenses/invoices/my`);
  }

  getMyInvoicesPaginated(page: number = 0, size: number = 10, status?: string): Observable<PageResponse<any>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (status) params = params.set('status', status);
    
    return this.http.get<PageResponse<any>>(`${this.baseUrl}/licenses/invoices/my/paginated`, { params });
  }

  // For chama admins - get their license status
  getMyLicense(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/licenses/my-license`);
  }

  // For chama admins - download invoice PDF
  downloadMyInvoicePdf(invoiceId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/licenses/invoices/my/${invoiceId}/pdf`, {
      responseType: 'blob'
    });
  }

  // For chama admins - confirm payment for invoice
  confirmInvoicePayment(invoiceId: number, amount: number, paymentReference: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/my/${invoiceId}/confirm-payment`, {
      amount,
      paymentReference
    });
  }

  // For super admin - confirm receipt of payment
  confirmInvoiceReceipt(invoiceId: number, amount?: number, notes?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/${invoiceId}/confirm-receipt`, {
      amount,
      paymentReference: notes
    });
  }

  // For super admin - reject payment confirmation
  rejectPaymentConfirmation(invoiceId: number, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/licenses/invoices/${invoiceId}/reject-payment`, reason);
  }

  // For super admin - download any invoice PDF
  downloadInvoicePdf(invoiceId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/licenses/invoices/${invoiceId}/pdf`, {
      responseType: 'blob'
    });
  }

  // ==================== DASHBOARD ANALYTICS ====================
  getDashboardAnalytics(): Observable<DashboardAnalytics> {
    return this.http.get<DashboardAnalytics>(`${this.baseUrl}/dashboard/analytics`);
  }

  // ==================== REGISTRATION FEE ====================
  getRegistrationFeeInfo(): Observable<RegistrationFeeInfo> {
    return this.http.get<RegistrationFeeInfo>(`${this.baseUrl}/registration-fee/info`);
  }

  getMemberRegistrationFeeStatus(memberId: number): Observable<RegistrationFeePayment | null> {
    return this.http.get<RegistrationFeePayment | null>(`${this.baseUrl}/registration-fee/member/${memberId}`);
  }

  getAllRegistrationFeePayments(): Observable<RegistrationFeePayment[]> {
    return this.http.get<RegistrationFeePayment[]>(`${this.baseUrl}/registration-fee`);
  }

  getAwaitingVerificationPayments(): Observable<RegistrationFeePayment[]> {
    return this.http.get<RegistrationFeePayment[]>(`${this.baseUrl}/registration-fee/awaiting-verification`);
  }

  countAwaitingVerification(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.baseUrl}/registration-fee/awaiting-verification/count`);
  }

  submitRegistrationFeePayment(memberId: number, referenceNumber: string): Observable<RegistrationFeePayment> {
    return this.http.post<RegistrationFeePayment>(`${this.baseUrl}/registration-fee/pay`, { memberId, referenceNumber });
  }

  verifyRegistrationFeePayment(paymentId: number): Observable<RegistrationFeePayment> {
    return this.http.post<RegistrationFeePayment>(`${this.baseUrl}/registration-fee/${paymentId}/verify`, {});
  }

  rejectRegistrationFeePayment(paymentId: number, reason: string): Observable<RegistrationFeePayment> {
    return this.http.post<RegistrationFeePayment>(`${this.baseUrl}/registration-fee/${paymentId}/reject`, { reason });
  }

  // ==================== RESOURCES ====================

  getResources(): Observable<Resource[]> {
    return this.http.get<Resource[]>(`${this.baseUrl}/resources`);
  }

  getResourcesPaginated(page: number, size: number, search?: string): Observable<PageResponse<Resource>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    return this.http.get<PageResponse<Resource>>(`${this.baseUrl}/resources/paginated`, { params });
  }

  getResource(id: number): Observable<Resource> {
    return this.http.get<Resource>(`${this.baseUrl}/resources/${id}`);
  }

  uploadResource(name: string, description: string, file: File): Observable<Resource> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) formData.append('description', description);
    return this.http.post<Resource>(`${this.baseUrl}/resources`, formData);
  }

  updateResource(id: number, data: { name?: string; description?: string }): Observable<Resource> {
    return this.http.put<Resource>(`${this.baseUrl}/resources/${id}`, data);
  }

  deleteResource(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/resources/${id}`);
  }

  hardDeleteResource(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/resources/${id}/hard`);
  }

  downloadResource(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/resources/${id}/download`, { responseType: 'blob' });
  }

  // ==================== AUDIT LOGS ====================

  getAuditLogs(page: number, size: number, filters?: {
    module?: string;
    memberId?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<PageResponse<AuditLog>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters?.module) params = params.set('module', filters.module);
    if (filters?.memberId) params = params.set('memberId', filters.memberId);
    if (filters?.action) params = params.set('action', filters.action);
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    return this.http.get<PageResponse<AuditLog>>(`${this.baseUrl}/audit-logs`, { params });
  }

  getAuditLog(id: number): Observable<AuditLog> {
    return this.http.get<AuditLog>(`${this.baseUrl}/audit-logs/${id}`);
  }

  getAuditModules(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/audit-logs/modules`);
  }

  getAuditActions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/audit-logs/actions`);
  }

  getAuditStatistics(days: number = 7): Observable<any> {
    return this.http.get(`${this.baseUrl}/audit-logs/statistics`, { params: { days } });
  }

  // Super Admin: Get all audit logs across all tenants
  getAllAuditLogs(page: number, size: number): Observable<PageResponse<AuditLog>> {
    let params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<AuditLog>>(`${this.baseUrl}/audit-logs/all`, { params });
  }

  // ==================== CONTRIBUTION TOP-UPS ====================

  getContributionTopUps(page: number, size: number, filters?: {
    status?: string;
    memberId?: number;
    contributionTypeId?: number;
  }): Observable<PageResponse<any>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.memberId) params = params.set('memberId', filters.memberId);
    if (filters?.contributionTypeId) params = params.set('contributionTypeId', filters.contributionTypeId);
    return this.http.get<PageResponse<any>>(`${this.baseUrl}/contribution-topups`, { params });
  }

  getMyContributionTopUps(page: number, size: number): Observable<PageResponse<any>> {
    let params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<any>>(`${this.baseUrl}/contribution-topups/my`, { params });
  }

  getContributionTopUp(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/contribution-topups/${id}`);
  }

  createContributionTopUp(data: { 
    contributionTypeId: number; 
    amount: number; 
    paymentReference?: string; 
    notes?: string;
    targetMonth?: string;
    description?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/contribution-topups`, data);
  }

  approveContributionTopUp(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/contribution-topups/${id}/approve`, {});
  }

  rejectContributionTopUp(id: number, reason?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/contribution-topups/${id}/reject`, { reason });
  }

  getPendingTopUpsCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.baseUrl}/contribution-topups/pending-count`);
  }

  // ==================== WELFARE CONTRIBUTION FUND PAYMENT ====================

  payWelfareFromContributionFund(eventId: number, memberId: number, contributionTypeId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/welfare/${eventId}/contributions/${memberId}/pay-from-fund`, { contributionTypeId });
  }

  getMemberContributionBalances(memberId: number): Observable<{ contributionTypeId: number; contributionTypeName: string; balance: number }[]> {
    return this.http.get<{ contributionTypeId: number; contributionTypeName: string; balance: number }[]>(
      `${this.baseUrl}/welfare/member/${memberId}/contribution-balances`
    );
  }

  // ==================== PAYMENT SETTINGS ====================
  
  getPaymentSettings(): Observable<PaymentSettings> {
    return this.http.get<PaymentSettings>(`${this.baseUrl}/payment-settings`);
  }

  updatePaymentSettings(settings: Partial<PaymentSettings>): Observable<PaymentSettings> {
    return this.http.put<PaymentSettings>(`${this.baseUrl}/payment-settings`, settings);
  }

  getEnabledPaymentMethods(): Observable<EnabledPaymentMethods> {
    return this.http.get<EnabledPaymentMethods>(`${this.baseUrl}/payment-settings/methods`);
  }

  // ==================== UNIFIED PAYMENT ====================

  /**
   * Initiate payment for any payable type (registration fee, fines, etc.)
   * Unified endpoint that handles all payment methods: MANUAL, STK_PUSH, IN_APP_SMS
   */
  initiatePayment(request: InitiatePaymentRequest): Observable<InitiatePaymentResponse> {
    return this.http.post<InitiatePaymentResponse>(`${this.baseUrl}/payments/initiate`, request);
  }

  /**
   * Confirm a payment by payableId (admin action).
   * This is the unified endpoint that works for ALL payment types.
   */
  confirmPayment(payableId: number): Observable<InitiatePaymentResponse> {
    return this.http.post<InitiatePaymentResponse>(`${this.baseUrl}/payments/payables/${payableId}/confirm`, {});
  }

  /**
   * Reject a payment by payableId (admin action).
   * This is the unified endpoint that works for ALL payment types.
   */
  rejectPayment(payableId: number, reason: string): Observable<InitiatePaymentResponse> {
    return this.http.post<InitiatePaymentResponse>(`${this.baseUrl}/payments/payables/${payableId}/reject`, { reason });
  }

  /**
   * Get payment claim status (for polling)
   */
  getPaymentClaimStatus(claimId: number): Observable<InitiatePaymentResponse> {
    return this.http.get<InitiatePaymentResponse>(`${this.baseUrl}/payments/claims/${claimId}/status`);
  }

  getTreasurerDevices(): Observable<TreasurerDevice[]> {
    return this.http.get<TreasurerDevice[]>(`${this.baseUrl}/payments/devices`);
  }

  revokeTreasurerDevice(deviceId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/payments/devices/${deviceId}`);
  }

  // ==================== PLATFORM SETTINGS ====================
  
  /**
   * Get contact info for login page (public endpoint)
   */
  getPlatformContactInfo(): Observable<PlatformContactInfo> {
    return this.http.get<PlatformContactInfo>(`${this.baseUrl}/platform/contact-info`);
  }

  /**
   * Update contact info (Super Admin only)
   */
  updatePlatformContactInfo(contactInfo: PlatformContactInfo): Observable<PlatformContactInfo> {
    return this.http.put<PlatformContactInfo>(`${this.baseUrl}/platform/contact-info`, contactInfo);
  }
}

// Platform Contact Info
export interface PlatformContactInfo {
  contactPhone: string;
  contactEmail: string;
  contactName: string;
}

// Dashboard Analytics Types
export interface DashboardAnalytics {
  totalSavings: number;
  activeMembers: number;
  loansOutstanding: number;
  loansNeedingAttention: number;
  welfareBalance: number;
  investmentValue: number;
  savingsPercent: number;
  investmentsPercent: number;
  welfarePercent: number;
  loansPercent: number;
  ledgerBalance: number;
  totalCredits: number;
  totalDebits: number;
  fundGrowth: FundGrowthPoint[];
  nextMeeting: MeetingInfo | null;
  loanAlerts: LoanAlert[];
  nextPayout: PayoutInfo | null;
  recentTransactions: DashboardTransaction[];
  pendingApprovals: ApprovalInfo[];
}

export interface FundGrowthPoint {
  month: string;
  amount: number;
}

export interface MeetingInfo {
  id: number;
  dateTime: string;
  venue: string;
  type: string;
  status: string;
  attended: number;
  totalMembers: number;
}

export interface LoanAlert {
  id: number;
  memberName: string;
  loanType: string;
  amount: number;
  overdue: number;
  daysOverdue: number;
}

export interface PayoutInfo {
  id: number;
  memberName: string;
  roundNumber: number;
  dueDate: string;
  paidCount: number;
  totalCount: number;
  paidAmount: number;
  totalAmount: number;
}

export interface DashboardTransaction {
  id: number;
  date: string;
  type: string;
  description: string;
  amount: number;
  isCredit: boolean;
  credit?: boolean;  // Alternative field name from backend
}

export interface ApprovalInfo {
  id: number;
  type: string;
  title: string;
  memberName: string;
  amount: number;
  status: string;
  currentLevel: number;
}
