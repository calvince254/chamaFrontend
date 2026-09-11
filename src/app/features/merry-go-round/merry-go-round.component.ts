import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Member } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

interface MgrCycle {
  id: number;
  name: string;
  contributionAmount: number;
  startDate: string;
  endDate: string;
  status: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  weekOfMonth?: number;
  dayOfWeekInMonth?: number;
  latePaymentFineAmount?: number;
  autoImposeFine: boolean;
  gracePeriodDays: number;
  isRecurring: boolean;
  numberOfCycles: number;
  currentCycleNumber: number;
  participantCount: number;
  completedRounds: number;
  totalRounds: number;
  totalContributed: number;
  totalPaidOut: number;
  totalFinesCollected: number;
  totalFinesPending: number;
  currentRound?: MgrRound;
  participants?: MgrParticipant[];
  rounds?: MgrRound[];
}

interface MgrRound {
  id: number;
  cycleId: number;
  cycleName: string;
  recipientId: number;
  recipientName: string;
  payoutDate: string;
  expectedAmount: number;
  collectedAmount: number;
  paidAmount: number;
  payoutBalance: number;
  status: string; // PENDING, PARTIAL, COMPLETED
  position: number;
  paidContributions: number;
  totalContributions: number;
}

interface MgrParticipant {
  id: number;
  memberId: number;
  memberName: string;
  payoutOrder: number;
  status: string;
  totalContributed: number;
  totalOwed: number;
  totalFines: number;
  hasReceivedPayout: boolean;
}

interface MgrContribution {
  id: number;
  roundId: number;
  roundPosition: number;        // Which round (1, 2, 3, etc.)
  roundRecipientName: string;   // Who receives payout for this round
  memberId: number;
  memberName: string;           // Who is contributing
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: string;
  isOverdue: boolean;
  hasFine: boolean;
}

interface MgrFine {
  id: number;
  memberId: number;
  memberName: string;
  reason: string;
  amount: number;
  imposedDate: string;
  paidDate?: string;
  status: string;
  autoImposed: boolean;
}

interface MgrSummary {
  totalCycles: number;
  activeCycles: number;
  completedCycles: number;
  totalContributions: number;
  totalPayouts: number;
  totalFinesCollected: number;
  totalFinesPending: number;
  currentBalance: number;
}

@Component({
  selector: 'app-merry-go-round',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './merry-go-round.component.html',
})
export class MerryGoRoundComponent implements OnInit {
  // Data
  cycles: MgrCycle[] = [];
  members: Member[] = [];
  selectedCycle: MgrCycle | null = null;
  selectedRound: MgrRound | null = null;
  contributions: MgrContribution[] = [];
  fines: MgrFine[] = [];
  summary: MgrSummary | null = null;

  // UI State
  loading = true;
  loadError: string | null = null;
  activeTab: 'cycles' | 'details' | 'contributions' | 'fines' = 'cycles';
  showSummary = true;

  // Create Cycle Modal
  showCreateModal = false;
  saving = false;
  formData = {
    name: '',
    contributionAmount: 0,
    startDate: new Date().toISOString().split('T')[0],
    frequency: 'MONTHLY',
    dayOfWeek: 1,
    dayOfMonth: 1,
    weekOfMonth: 1,
    dayOfWeekInMonth: 1,
    monthlyType: 'specific', // 'specific' or 'weekday'
    cycleType: 'fixed', // 'fixed' or 'recurring'
    numberOfCycles: 1,
    latePaymentFineAmount: 0,
    autoImposeFine: false,
    gracePeriodDays: 0,
    participantSelection: 'ALL',
    participantIds: [] as number[],
    orderingMode: 'sequential' as 'sequential' | 'random' | 'custom', // How to order participants
    orderedParticipants: [] as { id: number; name: string }[] // For custom ordering
  };

  // Fine Modal
  showFineModal = false;
  fineData = {
    reason: '',
    amount: 0,
    memberIds: [] as number[]
  };

  // Day names for display
  dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  weekNames = ['', 'First', 'Second', 'Third', 'Fourth', 'Last'];

  // Inject services
  private api = inject(ApiService);
  session = inject(SessionService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmDialogService);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.loadError = null;
    
    // Load summary
    this.api.getMgrSummary().subscribe({
      next: (summary) => {
        this.summary = summary;
      },
      error: () => {
        this.summary = null;
      }
    });
    
    this.api.getMerryGoRoundCycles().subscribe({
      next: (cycles) => {
        this.cycles = cycles;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 403) {
          this.loadError = 'Access denied. You don\'t have permission to view Merry-Go-Round.';
        } else {
          this.loadError = 'Failed to load data. Please try again.';
        }
      }
    });

    this.api.getMembers().subscribe({
      next: (m) => this.members = m.filter(mem => mem.status === 'ACTIVE'),
      error: () => this.members = []
    });
  }

  // ==================== CYCLE MANAGEMENT ====================

  openCreateModal() {
    this.formData = {
      name: '',
      contributionAmount: 0,
      startDate: new Date().toISOString().split('T')[0],
      frequency: 'MONTHLY',
      dayOfWeek: 1,
      dayOfMonth: 1,
      weekOfMonth: 1,
      dayOfWeekInMonth: 1,
      monthlyType: 'specific',
      cycleType: 'fixed',
      numberOfCycles: 1,
      latePaymentFineAmount: 0,
      autoImposeFine: false,
      gracePeriodDays: 0,
      participantSelection: 'ALL',
      participantIds: [],
      orderingMode: 'sequential',
      orderedParticipants: []
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  toggleParticipant(memberId: number) {
    const idx = this.formData.participantIds.indexOf(memberId);
    if (idx > -1) {
      this.formData.participantIds.splice(idx, 1);
      // Also remove from ordered list
      this.formData.orderedParticipants = this.formData.orderedParticipants.filter(p => p.id !== memberId);
    } else {
      this.formData.participantIds.push(memberId);
      // Add to ordered list
      const member = this.members.find(m => m.id === memberId);
      if (member) {
        this.formData.orderedParticipants.push({ id: member.id, name: member.name });
      }
    }
  }

  isParticipant(memberId: number): boolean {
    return this.formData.participantIds.includes(memberId);
  }

  selectAllParticipants() {
    this.formData.participantIds = this.members.map(m => m.id);
    // Update ordered list
    this.formData.orderedParticipants = this.members.map(m => ({ id: m.id, name: m.name }));
  }

  deselectAllParticipants() {
    this.formData.participantIds = [];
    this.formData.orderedParticipants = [];
  }

  // Shuffle array randomly (Fisher-Yates algorithm)
  shuffleParticipants() {
    const arr = [...this.formData.orderedParticipants];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.formData.orderedParticipants = arr;
  }

  // Build ordered participants list based on current selection
  buildOrderedParticipants() {
    if (this.formData.participantSelection === 'ALL') {
      this.formData.orderedParticipants = this.members.map(m => ({ id: m.id, name: m.name }));
    } else {
      this.formData.orderedParticipants = this.formData.participantIds
        .map(id => this.members.find(m => m.id === id))
        .filter(m => m !== undefined)
        .map(m => ({ id: m!.id, name: m!.name }));
    }
    
    if (this.formData.orderingMode === 'random') {
      this.shuffleParticipants();
    }
  }

  // Drag and drop for reordering
  draggedIndex: number | null = null;

  onDragStart(index: number) {
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
      const item = this.formData.orderedParticipants[this.draggedIndex];
      this.formData.orderedParticipants.splice(this.draggedIndex, 1);
      this.formData.orderedParticipants.splice(dropIndex, 0, item);
    }
    this.draggedIndex = null;
  }

  onDragEnd() {
    this.draggedIndex = null;
  }

  moveParticipantUp(index: number) {
    if (index > 0) {
      const temp = this.formData.orderedParticipants[index];
      this.formData.orderedParticipants[index] = this.formData.orderedParticipants[index - 1];
      this.formData.orderedParticipants[index - 1] = temp;
    }
  }

  moveParticipantDown(index: number) {
    if (index < this.formData.orderedParticipants.length - 1) {
      const temp = this.formData.orderedParticipants[index];
      this.formData.orderedParticipants[index] = this.formData.orderedParticipants[index + 1];
      this.formData.orderedParticipants[index + 1] = temp;
    }
  }

  saveCycle() {
    // Comprehensive validation
    const errors: string[] = [];
    
    if (!this.formData.name?.trim()) {
      errors.push('Cycle name is required');
    }
    
    if (!this.formData.contributionAmount || this.formData.contributionAmount <= 0) {
      errors.push('Contribution amount must be greater than 0');
    }
    
    if (!this.formData.startDate) {
      errors.push('Start date is required');
    }
    
    if (!this.formData.frequency) {
      errors.push('Frequency is required');
    }
    
    if (this.formData.frequency === 'WEEKLY' && !this.formData.dayOfWeek) {
      errors.push('Day of week is required for weekly frequency');
    }
    
    if (this.formData.frequency === 'MONTHLY') {
      if (this.formData.monthlyType === 'specific' && !this.formData.dayOfMonth) {
        errors.push('Day of month is required');
      } else if (this.formData.monthlyType === 'weekday' && (!this.formData.weekOfMonth || !this.formData.dayOfWeekInMonth)) {
        errors.push('Week and day selection required for weekday schedule');
      }
    }
    
    if (this.formData.cycleType === 'fixed' && (!this.formData.numberOfCycles || this.formData.numberOfCycles < 1)) {
      errors.push('Number of cycles must be at least 1');
    }
    
    if (this.formData.participantSelection === 'SPECIFIC' && this.formData.participantIds.length < 2) {
      errors.push('Select at least 2 participants');
    }
    
    if (this.formData.participantSelection === 'ALL' && this.members.length < 2) {
      errors.push('Need at least 2 active members to start a cycle');
    }

    // Validate ordered participants if custom ordering is used
    if (this.formData.orderingMode === 'custom' && this.formData.orderedParticipants.length < 2) {
      errors.push('Set the payout order for participants');
    }

    if (errors.length > 0) {
      this.toast.warning('Validation Error', errors.join('. '));
      return;
    }

    this.saving = true;

    // Build the ordered participant IDs based on ordering mode
    let orderedIds: number[] | null = null;
    if (this.formData.orderingMode === 'custom' || this.formData.orderingMode === 'random') {
      // Always send ordered IDs when custom/random ordering is used
      orderedIds = this.formData.orderedParticipants.map(p => p.id);
    } else if (this.formData.participantSelection === 'SPECIFIC') {
      orderedIds = this.formData.participantIds;
    }
    // For 'sequential' with 'ALL', backend uses default order (orderedIds stays null)

    const request: any = {
      name: this.formData.name.trim(),
      contributionAmount: this.formData.contributionAmount,
      startDate: this.formData.startDate,
      frequency: this.formData.frequency,
      isRecurring: this.formData.cycleType === 'recurring',
      numberOfCycles: this.formData.cycleType === 'fixed' ? this.formData.numberOfCycles : 1,
      latePaymentFineAmount: this.formData.latePaymentFineAmount || null,
      autoImposeFine: this.formData.autoImposeFine,
      gracePeriodDays: this.formData.gracePeriodDays || 0,
      participantSelection: this.formData.participantSelection,
      participantIds: orderedIds // Now this is ordered!
    };

    // Add frequency-specific fields
    if (this.formData.frequency === 'WEEKLY') {
      request.dayOfWeek = this.formData.dayOfWeek;
    } else if (this.formData.frequency === 'MONTHLY') {
      if (this.formData.monthlyType === 'specific') {
        request.dayOfMonth = this.formData.dayOfMonth;
      } else {
        request.weekOfMonth = this.formData.weekOfMonth === 5 ? -1 : this.formData.weekOfMonth;
        request.dayOfWeekInMonth = this.formData.dayOfWeekInMonth;
      }
    }

    this.api.createMerryGoRoundCycle(request).subscribe({
      next: (cycle) => {
        this.saving = false;
        this.showCreateModal = false;
        this.toast.success('Cycle Created', `"${cycle.name}" has been created successfully.`);
        this.loadData();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error('Failed to create cycle', err.error?.message || 'An error occurred');
      }
    });
  }

  viewCycleDetails(cycle: MgrCycle) {
    this.selectedCycle = cycle;
    this.activeTab = 'details';
    this.loadCycleDetails(cycle.id);
  }

  loadCycleDetails(cycleId: number) {
    this.api.getMerryGoRoundCycle(cycleId).subscribe({
      next: (cycle) => {
        this.selectedCycle = cycle;
      },
      error: () => this.toast.error('Error', 'Failed to load cycle details')
    });

    this.api.getMgrContributionsByCycle(cycleId).subscribe({
      next: (contributions) => {
        // Sort by round position, then by member name
        this.contributions = contributions.sort((a, b) => {
          if (a.roundPosition !== b.roundPosition) {
            return a.roundPosition - b.roundPosition;
          }
          return a.memberName.localeCompare(b.memberName);
        });
      },
      error: () => this.contributions = []
    });

    this.api.getMgrFinesByCycle(cycleId).subscribe({
      next: (fines) => this.fines = fines,
      error: () => this.fines = []
    });
  }

  backToCycles() {
    this.selectedCycle = null;
    this.activeTab = 'cycles';
  }

  async deleteCycle(cycle: MgrCycle) {
    const confirmed = await this.confirm.delete(cycle.name);
    if (!confirmed) return;

    this.api.deleteMerryGoRoundCycle(cycle.id).subscribe({
      next: () => {
        this.toast.success('Deleted', 'Cycle has been deleted.');
        this.loadData();
        if (this.selectedCycle?.id === cycle.id) {
          this.backToCycles();
        }
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to delete cycle')
    });
  }

  // ==================== ROUND MANAGEMENT ====================

  viewRound(round: MgrRound) {
    this.selectedRound = round;
    this.api.getMgrContributionsByRound(round.id).subscribe({
      next: (contributions) => this.contributions = contributions,
      error: () => this.contributions = []
    });
  }

  async markRoundPaid(round: MgrRound) {
    // Check if there's any balance available to pay
    if (round.payoutBalance <= 0) {
      this.toast.warning('No Funds Available', `No collected funds available to pay out. Collected: KES ${round.collectedAmount.toLocaleString()}, Already Paid: KES ${round.paidAmount.toLocaleString()}`);
      return;
    }

    const message = round.paidAmount > 0 
      ? `Pay remaining KES ${round.payoutBalance.toLocaleString()} to ${round.recipientName}? (Already paid: KES ${round.paidAmount.toLocaleString()})`
      : `Pay KES ${round.payoutBalance.toLocaleString()} to ${round.recipientName}? (Expected: KES ${round.expectedAmount.toLocaleString()})`;

    const confirmed = await this.confirm.action('Make Payout', message);
    if (!confirmed) return;

    this.api.makeMgrRoundPayout(round.id).subscribe({
      next: () => {
        this.toast.success('Payout Complete', `KES ${round.payoutBalance.toLocaleString()} has been paid to ${round.recipientName}.`);
        if (this.selectedCycle) {
          this.loadCycleDetails(this.selectedCycle.id);
        }
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to make payout')
    });
  }

  // ==================== CONTRIBUTION MANAGEMENT ====================

  markContributionPaid(contribution: MgrContribution) {
    this.api.markMgrContributionPaid(contribution.id).subscribe({
      next: () => {
        this.toast.success('Paid', `${contribution.memberName}'s contribution has been recorded.`);
        if (this.selectedCycle) {
          this.loadCycleDetails(this.selectedCycle.id);
        } else if (this.selectedRound) {
          this.viewRound(this.selectedRound);
        }
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to record payment')
    });
  }

  async markSelectedContributionsPaid() {
    const pendingIds = this.contributions
      .filter(c => c.status === 'PENDING')
      .map(c => c.id);

    if (pendingIds.length === 0) {
      this.toast.warning('No Pending', 'All contributions are already paid.');
      return;
    }

    const confirmed = await this.confirm.action(
      'Record Payments',
      `Mark ${pendingIds.length} contribution(s) as paid?`
    );
    if (!confirmed) return;

    this.api.markMultipleMgrContributionsPaid(pendingIds).subscribe({
      next: () => {
        this.toast.success('Paid', `${pendingIds.length} contributions marked as paid.`);
        if (this.selectedCycle) {
          this.loadCycleDetails(this.selectedCycle.id);
        }
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to record payments')
    });
  }

  async imposeFineForContribution(contribution: MgrContribution) {
    if (contribution.hasFine) {
      this.toast.warning('Fine Already Imposed', 'A fine has already been imposed for this contribution.');
      return;
    }

    const defaultAmount = this.selectedCycle?.latePaymentFineAmount || 0;
    const confirmed = await this.confirm.action(
      'Impose Late Payment Fine',
      `Impose a fine of KES ${defaultAmount.toLocaleString()} on ${contribution.memberName} for late payment?`
    );
    if (!confirmed) return;

    this.api.imposeMgrFineForContribution(contribution.id, 'Late payment - manually imposed', defaultAmount).subscribe({
      next: () => {
        this.toast.success('Fine Imposed', `Fine has been imposed on ${contribution.memberName}.`);
        if (this.selectedCycle) {
          this.loadCycleDetails(this.selectedCycle.id);
        }
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to impose fine')
    });
  }

  // ==================== FINE MANAGEMENT ====================

  openFineModal() {
    this.fineData = {
      reason: '',
      amount: this.selectedCycle?.latePaymentFineAmount || 0,
      memberIds: []
    };
    this.showFineModal = true;
  }

  closeFineModal() {
    this.showFineModal = false;
  }

  toggleFineMember(memberId: number) {
    const idx = this.fineData.memberIds.indexOf(memberId);
    if (idx > -1) {
      this.fineData.memberIds.splice(idx, 1);
    } else {
      this.fineData.memberIds.push(memberId);
    }
  }

  isFineMember(memberId: number): boolean {
    return this.fineData.memberIds.includes(memberId);
  }

  imposeFine() {
    if (!this.selectedCycle || !this.fineData.reason || this.fineData.amount <= 0 || this.fineData.memberIds.length === 0) {
      this.toast.warning('Validation Error', 'Please fill in all required fields and select at least one member.');
      return;
    }

    this.api.imposeMgrFine({
      cycleId: this.selectedCycle.id,
      reason: this.fineData.reason,
      amount: this.fineData.amount,
      memberIds: this.fineData.memberIds
    }).subscribe({
      next: () => {
        this.toast.success('Fine Imposed', `Fine has been imposed on ${this.fineData.memberIds.length} member(s).`);
        this.showFineModal = false;
        this.loadCycleDetails(this.selectedCycle!.id);
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to impose fine')
    });
  }

  payFine(fine: MgrFine) {
    this.api.payMgrFine(fine.id).subscribe({
      next: () => {
        this.toast.success('Fine Paid', `${fine.memberName}'s fine has been paid.`);
        if (this.selectedCycle) {
          this.loadCycleDetails(this.selectedCycle.id);
        }
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to record payment')
    });
  }

  async waiveFine(fine: MgrFine) {
    const reason = await this.confirm.prompt({
      title: 'Waive Fine',
      message: `Waive ${fine.memberName}'s fine of KES ${fine.amount.toLocaleString()}?`,
      inputLabel: 'Reason for waiving',
      inputPlaceholder: 'Enter reason...',
      confirmText: 'Waive Fine',
      confirmClass: 'warning'
    });
    
    if (!reason) return;

    this.api.waiveMgrFine(fine.id, reason).subscribe({
      next: () => {
        this.toast.success('Fine Waived', `${fine.memberName}'s fine has been waived.`);
        if (this.selectedCycle) {
          this.loadCycleDetails(this.selectedCycle.id);
        }
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to waive fine')
    });
  }

  // ==================== HELPERS ====================

  getFrequencyLabel(cycle: MgrCycle): string {
    if (cycle.frequency === 'DAILY') return 'Daily';
    if (cycle.frequency === 'WEEKLY') {
      return `Every ${this.dayNames[cycle.dayOfWeek || 1]}`;
    }
    if (cycle.frequency === 'MONTHLY') {
      if (cycle.dayOfMonth) {
        return `${this.getOrdinal(cycle.dayOfMonth)} of each month`;
      } else if (cycle.weekOfMonth && cycle.dayOfWeekInMonth) {
        const week = cycle.weekOfMonth === -1 ? 'Last' : this.weekNames[cycle.weekOfMonth];
        return `${week} ${this.dayNames[cycle.dayOfWeekInMonth]} of each month`;
      }
    }
    return cycle.frequency;
  }

  getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'badge-success';
      case 'COMPLETED': return 'badge-success';
      case 'CANCELLED': return 'badge-danger';
      case 'PAID': return 'badge-success';
      case 'PENDING': return 'badge-warning';
      case 'PARTIAL': return 'badge-info';
      case 'LATE': return 'badge-danger';
      case 'WAIVED': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  }

  getParticipantsForCycle(): MgrParticipant[] {
    return this.selectedCycle?.participants || [];
  }

  getPendingContributionsCount(): number {
    return this.contributions.filter(c => c.status === 'PENDING').length;
  }

  getPendingFinesCount(): number {
    return this.fines.filter(f => f.status === 'PENDING').length;
  }

  // Group contributions by round for display
  getGroupedContributions(): {
    roundId: number;
    roundPosition: number;
    roundRecipientName: string;
    dueDate: string;
    expectedAmount: number;
    collectedAmount: number;
    paidCount: number;
    totalCount: number;
    contributions: MgrContribution[];
  }[] {
    const groups = new Map<number, {
      roundId: number;
      roundPosition: number;
      roundRecipientName: string;
      dueDate: string;
      contributions: MgrContribution[];
    }>();

    for (const contrib of this.contributions) {
      if (!groups.has(contrib.roundId)) {
        groups.set(contrib.roundId, {
          roundId: contrib.roundId,
          roundPosition: contrib.roundPosition,
          roundRecipientName: contrib.roundRecipientName,
          dueDate: contrib.dueDate,
          contributions: []
        });
      }
      groups.get(contrib.roundId)!.contributions.push(contrib);
    }

    // Convert to array and calculate stats
    return Array.from(groups.values())
      .sort((a, b) => a.roundPosition - b.roundPosition)
      .map(group => {
        const paidContribs = group.contributions.filter(c => c.status === 'PAID');
        const collectedAmount = paidContribs.reduce((sum, c) => sum + c.amount, 0);
        const expectedAmount = group.contributions.reduce((sum, c) => sum + c.amount, 0);
        return {
          ...group,
          expectedAmount,
          collectedAmount,
          paidCount: paidContribs.length,
          totalCount: group.contributions.length
        };
      });
  }
}
