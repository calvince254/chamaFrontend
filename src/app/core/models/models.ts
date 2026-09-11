/* ==========================================================================
   Shared domain models.
   These interfaces are the "contract" the backend should satisfy — field
   names here should map 1:1 to the JSON the Spring Boot API returns so that
   swapping MockDataService for a real HttpClient service is a drop-in change.
   ========================================================================== */

export interface Tenant {
  id: number;
  name: string;              // e.g. "Pentagon Welfare Association"
  code: string;              // short slug used for subdomain / login, e.g. "pentagon"
  contactEmail: string;
  contactPhone: string;
  memberCount: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  plan: 'FREE' | 'STANDARD' | 'PREMIUM';
  createdAt: string;
}

export interface TenantSettings {
  tenantId: number;
  name: string;
  registrationFee: number;
  minMembers: number;
  maxMembers: number;
  signaturesRequired: number;
}

export interface Permission {
  module: string;   // e.g. "members", "loans"
  view: boolean;
  create: boolean;
  edit: boolean;
  approve: boolean;
  delete: boolean;
}

export interface Role {
  id: number;
  name: string;          // "Admin", "Treasurer", "Member"
  isSystemDefault: boolean; // true for the built-in Admin role (always full rights)
  permissions: Permission[];
  permissionCodes?: string[]; // New granular permission codes (e.g., VIEW_MEMBERS, DISBURSE_LOAN)
  memberCount: number;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  tenantId: number;
  tenantName: string;
  roleName: string;
  isSuperAdmin: boolean;
  avatarInitials: string;
  // Permission codes are stored separately in SessionService
}

export interface Member {
  id: number;
  name: string;
  phone: string;
  email: string;
  memberNo: string;
  joinDate: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXITED';
  role: string;
  totalSavings: number;
  totalShares: number;
  outstandingLoan: number;
  arrearsMonths: number;
}

export interface Meeting {
  id: number;
  date: string;
  venue: string;
  type: 'REGULAR' | 'AGM' | 'SPECIAL';
  inviteAll?: boolean;
  attendeesCount: number;
  totalMembers: number;
  quorumMet: boolean;
  finesCollected: number;
  minutesStatus: 'DRAFT' | 'CONFIRMED';
  agenda?: string;
  minutes?: string;
  // Minutes file fields
  minutesFilePath?: string;
  minutesFileName?: string;
  minutesUploadedAt?: string;
  hasMinutesFile?: boolean;
  // RSVP summary
  rsvpAttending?: number;
  rsvpNotAttending?: number;
  rsvpPending?: number;
  // Fines summary (for dashboard)
  totalFinesImposed?: number;
  totalFinesPaid?: number;
  totalFinesUnpaid?: number;
  finesCount?: number;
  // Invited member IDs (for selective invites)
  invitedMemberIds?: number[];
}

export interface MeetingAttendee {
  id: number;
  memberId: number;
  memberName: string;
  memberNo: string;
  rsvpStatus: 'PENDING' | 'ATTENDING' | 'NOT_ATTENDING';
  declineReason?: string;
  respondedAt?: string;
  attended: boolean;
  markedAt?: string;
}

export interface RsvpRequest {
  attending: boolean;
  declineReason?: string;
}

export interface Contribution {
  id: number;
  memberName: string;
  memberNo?: string;
  memberId?: number;
  month: string;
  amountDue: number;
  amountPaid: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'DEFAULTED';
  penalty: number;
  paidOn: string | null;
  dueDate?: string;
  penaltyApplied?: boolean;
  contributionTypeId?: number;
  contributionTypeName?: string;
}

export interface Loan {
  id: number;
  memberName: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  balanceOutstanding: number;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'DEFAULTED' | 'CLEARED' | 'REJECTED';
  guarantors: string[];
  disbursedOn: string | null;
  nextDueDate: string | null;
}

export interface MerryGoRoundRound {
  id: number;
  cycleName: string;
  recipientName: string;
  payoutDate: string;
  amount: number;
  status: 'PENDING' | 'PAID';
  position: number;
}

export interface ShareEntry {
  id: number;
  memberName: string;
  sharesOwned: number;
  shareValue: number;
  totalValue: number;
  lastPurchaseDate: string;
}

export interface WelfareEvent {
  id: number;
  memberId?: number;
  memberName: string;
  eventType: 'BEREAVEMENT' | 'ILLNESS' | 'MARRIAGE' | 'OTHER';
  relation: string;
  dateReported: string;
  amountPerMember: number;
  totalExpected: number;
  totalCollected: number;
  status: 'OPEN' | 'CLOSED';
  description?: string;
  // New fields for member selection
  allMembersInvolved?: boolean;
  involvedMemberIds?: number[];
  // Stats
  totalInvolved?: number;
  paidCount?: number;
}

export interface WelfareContribution {
  id: number;
  welfareEventId: number;
  memberId: number;
  memberName: string;
  memberNo?: string;
  amountExpected: number;
  amountPaid: number;
  paid: boolean;
  paidDate?: string;
  paymentReference?: string;
}

export interface Investment {
  id: number;
  name: string;
  category: 'REAL_ESTATE' | 'STOCKS' | 'BONDS' | 'MONEY_MARKET' | 'FIXED_DEPOSIT' | 'SACCO_SHARES' | 'LAND' | 'BUSINESS' | 'AGRICULTURE' | 'OTHER';
  amountInvested: number;
  currentValue: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: 'ACTIVE' | 'SOLD' | 'WRITTEN_OFF';
  dateInvested: string;
  description?: string;
  // Computed fields
  netGain?: number;
  returnPercentage?: number;
  // Multi-approver fields
  requiresApproval?: boolean;
  approverIds?: number[];
  approvals?: InvestmentApproval[];
  requiredApprovals?: number;
  approvalCount?: number;
  rejectionCount?: number;
  pendingCount?: number;
  createdByMemberId?: number;
  createdByMemberName?: string;
  // Approval tracking
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  // Sell tracking
  soldDate?: string;
  soldAmount?: number;
  soldBy?: string;
  soldNotes?: string;
  finalGain?: number;
}

export interface InvestmentApproval {
  id: number;
  investmentId: number;
  investmentName?: string;
  approverId: number;
  approverName: string;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedAt?: string;
  comments?: string;
}

export interface InvestmentValueHistory {
  id: number;
  investmentId: number;
  valueDate: string;
  recordedValue: number;
  previousValue?: number;
  valueChange?: number;
  percentageChange?: number;
  notes?: string;
  recordedBy?: string;
}

export interface FinanceSummary {
  totalSavings: number;
  totalLoansOutstanding: number;
  welfareFundBalance: number;
  investmentValue: number;
  incomeThisMonth: number;
  expenditureThisMonth: number;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'CONTRIBUTION' | 'LOAN_DISBURSEMENT' | 'LOAN_REPAYMENT' | 'WELFARE' | 'FINE' | 'INVESTMENT' | 'EXPENSE';
  description: string;
  amount: number;
  direction: 'IN' | 'OUT';
}


// ==================== Fine Types & Fines ====================

export interface FineType {
  id: number;
  name: string;
  description?: string;
  amount: number;
  active: boolean;
  automatic: boolean;
  triggerType?: 'MEETING_ABSENT' | 'LATE_PAYMENT';
}

export interface Fine {
  id: number;
  meetingId: number;
  memberId: number;
  memberName: string;
  memberNo: string;
  fineTypeId: number;
  fineTypeName: string;
  amount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
  notes?: string;
  imposedAt: string;
  imposedByName?: string;
  paidAt?: string;
  paidAmount?: number;
}

export interface ImposeFineRequest {
  memberId: number;
  fineTypeId: number;
  notes?: string;
}


// ==================== Contribution Types ====================

export interface ContributionType {
  id: number;
  name: string;
  description?: string;
  amount: number;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  dueDay?: number;
  active: boolean;
  lateFineEnabled: boolean;
  lateFineAmount?: number;
  gracePeriodDays?: number;
}

// ==================== Penalties (Auto-Fines) ====================

export interface Penalty {
  id: number;
  memberId: number;
  memberName: string;
  memberNo: string;
  penaltyType: 'MEETING_ABSENT' | 'LATE_PAYMENT';
  reason: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
  meetingId?: number;
  meetingDate?: string;
  contributionTypeId?: number;
  contributionTypeName?: string;
  periodMonth?: string;
  imposedAt: string;
  paidAt?: string;
}

// ==================== Loan Products & Approval Levels ====================

export interface LoanApprovalLevel {
  id?: number;
  level: number;  // 1, 2, or 3
  roleId?: number;
  roleName?: string;
  memberId?: number;  // Specific member as approver
  memberName?: string;
  levelName: string; // e.g. "First Approver", "Treasurer Approval"
  canReject: boolean;
}

export interface LoanProduct {
  id: number;
  name: string;
  description?: string;
  interestRate: number;
  interestType: 'FLAT' | 'REDUCING_BALANCE';
  maxAmount?: number;
  minAmount?: number;
  maxMultiplier?: number;
  repaymentPeriod: number;
  repaymentPeriodType: 'DAYS' | 'MONTHS';
  requiredGuarantors: number;
  penaltyEnabled: boolean;
  penaltyRate?: number;
  penaltyType?: 'PERCENTAGE_OF_PRINCIPAL' | 'PERCENTAGE_OF_OUTSTANDING' | 'FIXED_AMOUNT';
  penaltyFrequency?: 'FLAT' | 'PER_PERIOD';
  gracePeriodDays: number;
  requiresApproval: boolean;
  approvalLevels: number;
  active: boolean;
  approvalLevelConfig?: LoanApprovalLevel[];  // Matches backend DTO field name
}

// ==================== Loan Penalties ====================

export interface LoanPenalty {
  id: number;
  loanId: number;
  memberId: number;
  memberName: string;
  memberNo: string;
  loanProductName?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
  reason: string;
  dueDate?: string;
  periodNumber?: number;
  daysOverdue?: number;
  autoGenerated: boolean;
  imposedAt: string;
  paidAt?: string;
  waivedAt?: string;
  waivedByName?: string;
  waiveReason?: string;
}

// ==================== Extended Loan Interface ====================

export interface LoanExtended {
  id: number;
  memberId: number;
  memberName: string;
  memberNo?: string;
  loanProductId?: number;
  loanProductName?: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  totalInterest?: number;
  totalAmount?: number;
  monthlyPayment?: number;
  balanceOutstanding: number;
  totalPaid?: number;
  totalPenalties?: number;
  status: 'DRAFT' | 'PENDING' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'OVERDUE' | 'DEFAULTED' | 'CLEARED' | 'REJECTED';
  currentApprovalLevel?: number;
  requiredApprovalLevels?: number;
  pendingApprovalRole?: string;
  approvalHistory?: LoanApprovalHistory[];
  guarantorIds?: number[];
  guarantorNames?: string[];
  guarantors?: string[];
  appliedById?: number;
  appliedByName?: string;
  applicationDate?: string;
  purpose?: string;
  approvedDate?: string;
  disbursedOn?: string;
  expectedCompletionDate?: string;
  nextDueDate?: string;
  lastPaymentDate?: string;
  clearedDate?: string;
  rejectionReason?: string;
  rejectedByName?: string;
  rejectedAt?: string;
}

export interface LoanApprovalHistory {
  level: number;
  levelName: string;
  approverName: string;
  approverRole?: string;
  action: 'APPROVED' | 'REJECTED' | 'RETURNED';
  comments?: string;
  actionDate: string;
}

// ==================== Share Settings & Calculations ====================

export interface ShareSettings {
  id?: number;
  shareContributionTypeIds: number[];
  poolContributionTypeIds: number[];
  includeFines: boolean;
  includeLoanInterest: boolean;
  includeInvestmentReturns: boolean;
  includePenalties: boolean;
  lastCalculatedAt?: string;
}

export interface MemberShare {
  memberId: number;
  memberName: string;
  memberNo?: string;
  contributionAmount: number;
  sharePercentage: number;
  memberValue: number;
  totalPaidOut?: number;
  status: string;
}

export interface ShareCalculation {
  isConfigured: boolean;
  totalShareContributions: number;
  poolContributions: number;
  poolFines: number;
  poolLoanInterest: number;
  poolInvestmentReturns: number;
  poolPenalties: number;
  totalPaidOut?: number;
  totalPoolValue: number;
  memberShares: MemberShare[];
  calculatedAt: string;
}

// ==================== PAYOUTS ====================

export interface Liquidity {
  totalPoolValue: number;
  liquidCash: number;
  lockedInInvestments: number;
  outstandingLoans: number;
  totalPaidOut: number;
  hasActivePayout: boolean;
  calculatedAt: string;
}

export interface PayoutMemberPreview {
  memberId: number;
  memberName: string;
  sharePercentage: number;
  contributionAmount: number;
  payoutAmount: number;
}

export interface PayoutPreview {
  payoutType: string;
  totalAmount: number;
  memberCount: number;
  memberPreviews: PayoutMemberPreview[];
  liquidity: Liquidity;
  canProceed: boolean;
  warning?: string;
}

export interface PayoutMember {
  id: number;
  memberId: number;
  memberName: string;
  memberNo?: string;
  sharePercentage: number;
  contributionAmount: number;
  payoutAmount: number;
  status: string;
  paidAt?: string;
  paymentReference?: string;
}

export interface Payout {
  id: number;
  payoutType: string;
  status: string;
  description?: string;
  totalPoolValue: number;
  liquidCash: number;
  lockedInInvestments: number;
  outstandingLoans: number;
  payoutAmount: number;
  initiatedByName?: string;
  initiatedAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  memberCount: number;
  paidCount: number;
  memberPayouts: PayoutMember[];
  createdAt?: string;
}

export interface CreatePayoutRequest {
  payoutType: 'FULL_DISTRIBUTION' | 'PARTIAL_DIVIDEND' | 'INDIVIDUAL_WITHDRAWAL';
  amount: number;
  description?: string;
  memberId?: number;
}

export interface PayoutPreviewRequest {
  payoutType: 'FULL_DISTRIBUTION' | 'PARTIAL_DIVIDEND' | 'INDIVIDUAL_WITHDRAWAL';
  amount?: number;
  memberId?: number;
}


// ==================== MEMBER FINANCIAL SUMMARY ====================

export interface ContributionSummary {
  contributionTypeId: number;
  contributionTypeName: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  monthsCount: number;
}

export interface MemberFinancialSummary {
  // Member Info
  memberId: number;
  memberName: string;
  memberNo: string;
  email: string;
  phone: string;
  status: string;
  joinDate: string;

  // Share Ownership
  originalContributions: number;
  adjustedContributions: number;
  sharePercentage: number;
  currentShareValue: number;
  totalPaidOut: number;

  // Contribution Summary
  totalContributionsDue: number;
  totalContributionsPaid: number;
  contributionsBalance: number;
  contributionMonthsCount: number;
  contributionsPaidCount: number;
  contributionsPendingCount: number;
  contributionsByType: ContributionSummary[];

  // Loan Summary
  totalLoansBorrowed: number;
  totalLoansRepaid: number;
  outstandingLoanBalance: number;
  activeLoansCount: number;
  clearedLoansCount: number;

  // Fines & Penalties
  totalFinesImposed: number;
  totalFinesPaid: number;
  finesBalance: number;
  totalPenaltiesPaid: number;

  // Welfare
  totalWelfareContributed: number;
  totalWelfareReceived: number;

  // Merry-Go-Round
  totalMgrContributed: number;
  totalMgrReceived: number;

  // Recent Transactions
  recentTransactions: Transaction[];

  // Payout History
  payoutHistory: PayoutMember[];

  // Net Position
  netPosition: number;
}
