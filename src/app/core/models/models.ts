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
  registrationFeeRequired: boolean;
  minMembers: number;
  maxMembers: number;
  signaturesRequired: number;
  sessionTimeoutMinutes?: number;
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
  roleId?: number;
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
  hasPendingClaim?: boolean; // True if there's a payment claim awaiting admin confirmation
  payableId?: number; // ID of the Payable record for confirming payments
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
  hasPendingClaim?: boolean;
  payableId?: number; // ID of the Payable record for confirming payments
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
  // Contribution fund payment fields
  paidFromContribution?: boolean;
  sourceContributionTypeId?: number;
  sourceContributionTypeName?: string;
  sourceContributionId?: number;
  paymentMethod?: 'CASH' | 'CONTRIBUTION_FUND';
  // Payment tracking
  hasPendingClaim?: boolean;
  payableId?: number; // ID of the Payable record for confirming payments
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
  // Partial sale tracking
  totalUnits?: number;
  remainingUnits?: number;
  totalAmountSold?: number;
  totalPrincipalSold?: number;
  realizedGain?: number;
  unrealizedGain?: number;
  remainingPrincipal?: number;
  soldPercentage?: number;
  hasPartialSales?: boolean;
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
  type: 'CONTRIBUTION' | 'LOAN_DISBURSEMENT' | 'LOAN_REPAYMENT' | 'WELFARE' | 'FINE' | 'PENALTY' | 'INVESTMENT' | 'INVESTMENT_RETURN' | 'REGISTRATION_FEE' | 'EXPENSE' | 'LOAN_INTEREST' | 'PROCESSING_FEE';
  description: string;
  amount: number;
  direction: 'IN' | 'OUT';
  memberName?: string;
  memberId?: number;
}

// ==================== Registration Fee ====================

export interface RegistrationFeePayment {
  id?: number;
  memberId: number;
  memberName?: string;
  memberNo?: string;
  amount: number;
  referenceNumber?: string;
  status: 'PENDING' | 'AWAITING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  paidAt?: string;
  verifiedAt?: string;
  verifiedByName?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedByName?: string;
  // Payment tracking (for unified payment flow)
  hasPendingClaim?: boolean;
  payableId?: number;
}

export interface RegistrationFeeInfo {
  amount: number;
  required: boolean;
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
  hasPendingClaim?: boolean; // True if there's a payment claim awaiting admin confirmation
  payableId?: number; // ID of the Payable record for confirming payments
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
  penaltyType: 'MEETING_ABSENT' | 'MEETING_LATE_ARRIVAL' | 'CONTRIBUTION_LATE_PAYMENT' | 'LATE_PAYMENT';
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
  hasPendingClaim?: boolean; // True if there's a payment claim awaiting admin confirmation
  payableId?: number; // ID of the Payable record for confirming payments
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
  // Processing fee fields
  processingFeeEnabled?: boolean;
  processingFeeType?: 'FIXED' | 'PERCENTAGE';
  processingFeeValue?: number;
  processingFeeDeduction?: 'UPFRONT' | 'ON_REPAYMENT';
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
  hasPendingClaim?: boolean; // True if there's a payment claim awaiting admin confirmation
  payableId?: number; // ID of the Payable record for confirming payments
}

// ==================== Loan Eligibility ====================

export interface LoanEligibility {
  applicantContributions: number;
  guarantorContributions: number;
  totalContributions: number;
  loanAmount: number;
  eligible: boolean;
  shortfall: number;
  loanHistory?: LoanHistorySummary;
  creditScore?: CreditScore;
  eligibilityNotes?: string[];
}

export interface LoanHistorySummary {
  totalLoansCount: number;
  completedLoansCount: number;
  activeLoansCount: number;
  defaultedLoansCount: number;
  totalBorrowed: number;
  totalRepaid: number;
  currentOutstanding: number;
  hasActiveLoans: boolean;
  onTimePaymentsCount: number;
  latePaymentsCount: number;
  missedPaymentsCount: number;
  repaymentRate: number;
}

export interface CreditScore {
  score: number;           // 0-100
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'VERY_POOR' | 'NO_HISTORY';
  ratingColor: string;     // green, blue, yellow, orange, red, gray
  description: string;
  factors: string[];
}

// Standalone credit score response for /my-credit-score endpoint
export interface CreditScoreResponse {
  creditScore: CreditScore;
  loanHistory: LoanHistorySummary;
  memberName: string;
  totalContributions: number;
}

// ==================== Loan Income ====================

export interface LoanIncomeSummary {
  totalInterestCollected: number;
  totalProcessingFeesCollected: number;
  totalLoanIncome: number;
  periodInterest: number;
  periodFees: number;
  periodTotal: number;
}

export interface LoanIncomeTransaction {
  id: number;
  date: string;
  type: 'LOAN_INTEREST' | 'PROCESSING_FEE';
  description: string;
  amount: number;
  direction: 'IN' | 'OUT';
  memberName?: string;
  referenceId?: number;
  referenceType?: string;
}

// ==================== Loan Payments ====================

export interface LoanPayment {
  id: number;
  loanId: number;
  memberId: number;
  memberName: string;
  memberNo?: string;
  loanProductName?: string;
  loanPrincipal: number;
  loanBalance: number;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  transactionReference?: string;
  notes?: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  recordedById?: number;
  recordedByName?: string;
  recordedAt?: string;
  verifiedById?: number;
  verifiedByName?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  rejectedAt?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  paymentMethod?: string;
  transactionReference?: string;
  notes?: string;
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
  status: 'DRAFT' | 'PENDING' | 'PENDING_GUARANTORS' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'OVERDUE' | 'DEFAULTED' | 'CLEARED' | 'REJECTED';
  // Guarantor tracking (Phase 1 - parallel)
  requiredGuarantors?: number;
  guarantorsApprovedCount?: number;
  pendingGuarantorNames?: string[];
  // Approver tracking (Phase 2 - sequential)
  currentApprovalLevel?: number;
  requiredApprovalLevels?: number;
  pendingApprovalRole?: string;
  // Combined tracking
  pendingApprovalType?: 'GUARANTOR' | 'APPROVER'; // What type of approval is next
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
  // Processing fee fields
  processingFee?: number;
  processingFeePaid?: number;
  netDisbursementAmount?: number;
  processingFeeDeductionType?: 'UPFRONT' | 'ON_REPAYMENT';
  hasPendingClaim?: boolean;
  payableId?: number; // ID of the Payable record for confirming payments
  pendingPaymentAmount?: number; // Amount awaiting confirmation
}

export interface LoanApprovalHistory {
  level?: number;
  levelName: string;
  approverName: string;
  approverRole?: string;
  approvalType?: 'GUARANTOR' | 'APPROVER';
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
  includeProcessingFees: boolean;
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
  poolProcessingFees: number;
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

export interface GuarantorLiability {
  loanId: number;
  borrowerName: string;
  loanAmount: number;
  balanceOutstanding: number;
  memberLiability: number; // This member's share of the outstanding balance
  guarantorCount: number;
  loanStatus: string;
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
  useOwnershipDistribution?: boolean;
  distributionPercentage?: number;
}

export interface PayoutPreviewRequest {
  payoutType: 'FULL_DISTRIBUTION' | 'PARTIAL_DIVIDEND' | 'INDIVIDUAL_WITHDRAWAL';
  amount?: number;
  memberId?: number;
  useOwnershipDistribution?: boolean;
  distributionPercentage?: number;
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

// ==================== PAGINATION ====================

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
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


// ==================== Resources ====================

export interface Resource {
  id: number;
  name: string;
  description?: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  contentType: string;
  fileExtension: string;
  uploadedById?: number;
  uploadedByName?: string;
  downloadCount: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ==================== Audit Logs ====================

export interface AuditLog {
  id: number;
  tenantId?: number;
  tenantName?: string;
  memberId?: number;
  memberName?: string;
  memberEmail?: string;
  module: string;
  action: string;
  httpMethod?: string;
  endpoint?: string;
  entityType?: string;
  entityId?: number;
  description?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  responseStatus?: number;
  executionTimeMs?: number;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
}

// ==================== Contribution Top-Up ====================

export interface ContributionTopUp {
  id: number;
  memberId: number;
  memberName: string;
  memberNo?: string;
  contributionTypeId: number;
  contributionTypeName: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestDate: string;
  approvalDate?: string;
  approvedById?: number;
  approvedByName?: string;
  rejectionReason?: string;
  paymentReference?: string;
  notes?: string;
  targetMonth?: string;  // Format: YYYY-MM
  description?: string;  // Description for the top-up
}

// ==================== Contribution Balance (for welfare fund payment) ====================

export interface ContributionBalance {
  contributionTypeId: number;
  contributionTypeName: string;
  balance: number;
}


// ==================== Payment Settings ====================

export type PaymentMethod = 'IN_APP_SMS' | 'STK_PUSH' | 'MANUAL';

export interface PaymentSettings {
  id?: number;
  tenantId?: number;
  
  // Payment method toggles
  inAppSmsEnabled: boolean;
  stkPushEnabled: boolean;
  manualEnabled: boolean;
  
  // STK Push (Daraja) Configuration
  darajaConsumerKey?: string;
  darajaConsumerSecret?: string;
  businessShortCode?: string;
  lipaNaMpesaPasskey?: string;
  accountReference?: string;
  transactionDesc?: string;
  callbackUrl?: string;
  
  // In-App SMS Configuration
  treasurerPhone?: string;
  treasurerName?: string;
  claimExpiryMinutes: number;
  fallbackMatchWindowMinutes: number;
  
  // General Settings
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  defaultPaymentMethod?: PaymentMethod;
}

export interface EnabledPaymentMethods {
  inAppSmsEnabled: boolean;
  stkPushEnabled: boolean;
  manualEnabled: boolean;
  treasurerPhone?: string;
  treasurerName?: string;
  defaultMethod?: PaymentMethod;
}

export interface TreasurerDevice {
  id: number;
  tenantId: number;
  memberId: number;
  memberName?: string;
  deviceId?: string;
  deviceName?: string;
  phoneNumber?: string;
  isActive: boolean;
  registeredAt: string;
  lastActiveAt?: string;
  lastSeenAt?: string;
  revokedAt?: string;
  revocationReason?: string;
}

// ==================== Unified Payment ====================

export interface InitiatePaymentRequest {
  payableId?: number;
  paymentType?: 'REGISTRATION_FEE' | 'MEETING_FINE' | 'MGR_FINE' | 'PENALTY' | 'LOAN_PENALTY' | 'CONTRIBUTION' | 'LOAN_REPAYMENT' | 'MGR_CONTRIBUTION' | 'WELFARE_DUE';
  referenceId?: number;
  payerMemberId?: number;
  paymentMethod: PaymentMethod;
  phoneNumber?: string;
  referenceCode?: string;
  amount?: number;
}

export interface InitiatePaymentResponse {
  payableId: number;
  claimId: number;
  paymentMethod: string;
  status: string;
  statusMessage: string;
  amount: number;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  awaitingVerification: boolean;
  referenceCode?: string;
  expiresInSeconds: number;
}

export interface PaymentMethodOption {
  code: PaymentMethod;
  name: string;
  description: string;
  icon: string;
  requiresPhone: boolean;
  requiresReference: boolean;
}
