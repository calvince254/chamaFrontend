import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { WelfareEvent, WelfareContribution, Member } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-welfare',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './welfare.component.html',
})
export class WelfareComponent implements OnInit {
  events: WelfareEvent[] = [];
  members: Member[] = [];
  loading = signal(false);
  saving = signal(false);
  showForm = false;
  editing: any = {};

  // Payment tracking modal
  showPaymentsModal = false;
  selectedEvent: WelfareEvent | null = null;
  contributions: WelfareContribution[] = [];
  loadingContributions = signal(false);
  updatingPayment = signal(false);

  constructor(private api: ApiService, public session: SessionService) {}

  ngOnInit() {
    this.loadEvents();
    this.loadMembers();
  }

  loadEvents() {
    this.loading.set(true);
    this.api.getWelfareEvents().subscribe({
      next: (e) => {
        this.events = e;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          console.error('Failed to load welfare events:', err);
        }
      }
    });
  }

  loadMembers() {
    this.api.getMembers().subscribe({
      next: (m) => this.members = m,
      error: () => this.members = []
    });
  }

  progress(e: WelfareEvent) { 
    return e.totalExpected > 0 ? Math.round((e.totalCollected / e.totalExpected) * 100) : 0; 
  }

  paymentProgress(e: WelfareEvent) {
    return e.totalInvolved && e.totalInvolved > 0 ? Math.round(((e.paidCount || 0) / e.totalInvolved) * 100) : 0;
  }

  openNew() {
    this.editing = { 
      eventType: 'BEREAVEMENT',
      status: 'OPEN',
      dateReported: new Date().toISOString().split('T')[0],
      allMembersInvolved: true,
      involvedMemberIds: []
    };
    this.showForm = true;
  }

  toggleAllMembers() {
    if (this.editing.allMembersInvolved) {
      this.editing.involvedMemberIds = [];
    }
  }

  toggleMemberSelection(memberId: number) {
    if (!this.editing.involvedMemberIds) {
      this.editing.involvedMemberIds = [];
    }
    const idx = this.editing.involvedMemberIds.indexOf(memberId);
    if (idx === -1) {
      this.editing.involvedMemberIds.push(memberId);
    } else {
      this.editing.involvedMemberIds.splice(idx, 1);
    }
  }

  isMemberSelected(memberId: number): boolean {
    return this.editing.involvedMemberIds?.includes(memberId) || false;
  }

  save() {
    if (!this.editing.memberId || !this.editing.eventType) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate member selection
    if (!this.editing.allMembersInvolved && (!this.editing.involvedMemberIds || this.editing.involvedMemberIds.length === 0)) {
      alert('Please select at least one member to contribute');
      return;
    }

    this.saving.set(true);
    this.api.createWelfareEvent(this.editing).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.loadEvents();
      },
      error: (err) => {
        this.saving.set(false);
        alert('Failed to create welfare event: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  close() {
    this.showForm = false;
  }

  // ==================== PAYMENT TRACKING ====================

  openPaymentsModal(event: WelfareEvent) {
    this.selectedEvent = event;
    this.showPaymentsModal = true;
    this.loadContributions(event.id);
  }

  closePaymentsModal() {
    this.showPaymentsModal = false;
    this.selectedEvent = null;
    this.contributions = [];
  }

  loadContributions(eventId: number) {
    this.loadingContributions.set(true);
    this.api.getWelfareContributions(eventId).subscribe({
      next: (c) => {
        this.contributions = c;
        this.loadingContributions.set(false);
      },
      error: (err) => {
        this.loadingContributions.set(false);
        console.error('Failed to load contributions:', err);
      }
    });
  }

  togglePayment(contribution: WelfareContribution) {
    if (!this.selectedEvent) return;
    
    this.updatingPayment.set(true);
    this.api.updateWelfareContributionPayment(this.selectedEvent.id, contribution.memberId, !contribution.paid).subscribe({
      next: (updated) => {
        // Update in list
        const idx = this.contributions.findIndex(c => c.id === updated.id);
        if (idx !== -1) {
          this.contributions[idx] = updated;
        }
        this.updatingPayment.set(false);
        // Refresh events list to update totals
        this.loadEvents();
      },
      error: (err) => {
        this.updatingPayment.set(false);
        alert('Failed to update payment: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  markAllPaid() {
    if (!this.selectedEvent) return;
    if (!confirm('Mark all members as paid for this welfare event?')) return;

    this.updatingPayment.set(true);
    this.api.markAllWelfareContributionsPaid(this.selectedEvent.id).subscribe({
      next: () => {
        this.updatingPayment.set(false);
        this.loadContributions(this.selectedEvent!.id);
        this.loadEvents();
      },
      error: (err) => {
        this.updatingPayment.set(false);
        alert('Failed to mark all as paid: ' + (err.error?.message || 'Unknown error'));
      }
    });
  }

  get paidContributions(): WelfareContribution[] {
    return this.contributions.filter(c => c.paid);
  }

  get unpaidContributions(): WelfareContribution[] {
    return this.contributions.filter(c => !c.paid);
  }
}
