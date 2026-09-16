import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Meeting, MeetingAttendee, Member, PageResponse } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './meetings.component.html',
})
export class MeetingsComponent implements OnInit {
  meetings: Meeting[] = [];
  loading = signal(false);
  saving = signal(false);
  showForm = false;
  editing: Partial<Meeting> & { inviteAll?: boolean; invitedMemberIds?: number[] } = {};
  search = '';

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;
  Math = Math;

  // Member selection for meeting creation
  allMembers: Member[] = [];
  loadingMembers = signal(false);
  memberSearch = '';

  // RSVP
  selectedMeeting: Meeting | null = null;
  showRsvpModal = false;
  attendees: MeetingAttendee[] = [];
  loadingAttendees = signal(false);
  myRsvp: MeetingAttendee | null = null;
  
  // Decline reason modal
  showDeclineModal = false;
  declineReason = '';
  submittingRsvp = signal(false);

  constructor(
    private api: ApiService, 
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadMeetings();
  }

  loadMeetings() {
    this.loading.set(true);
    const searchTerm = this.search.trim() || undefined;
    
    this.api.getMeetingsPaginated(this.currentPage, this.pageSize, searchTerm).subscribe({
      next: (response: PageResponse<Meeting>) => {
        this.meetings = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          this.toast.error('Failed to load meetings', 'Please try again.');
          console.error('Failed to load meetings:', err);
        }
      }
    });
  }

  onFilterChange() {
    this.currentPage = 0;
    this.loadMeetings();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadMeetings();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadMeetings();
    }
  }

  prevPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadMeetings();
    }
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  loadMembers() {
    this.loadingMembers.set(true);
    this.api.getMembers().subscribe({
      next: (members) => {
        this.allMembers = members.filter(m => m.status === 'ACTIVE');
        this.loadingMembers.set(false);
      },
      error: () => {
        this.loadingMembers.set(false);
      }
    });
  }

  openNew() {
    this.editing = {
      type: 'REGULAR',
      minutesStatus: 'DRAFT',
      date: new Date().toISOString().split('T')[0],
      inviteAll: true,
      invitedMemberIds: []
    };
    this.memberSearch = '';
    this.showForm = true;
    this.loadMembers();
  }

  get filteredMembers(): Member[] {
    if (!this.memberSearch.trim()) return this.allMembers;
    const search = this.memberSearch.toLowerCase();
    return this.allMembers.filter(m => 
      m.name.toLowerCase().includes(search) || 
      m.memberNo.toLowerCase().includes(search)
    );
  }

  isMemberSelected(memberId: number): boolean {
    return this.editing.invitedMemberIds?.includes(memberId) || false;
  }

  toggleMemberSelection(memberId: number) {
    if (!this.editing.invitedMemberIds) {
      this.editing.invitedMemberIds = [];
    }
    
    const index = this.editing.invitedMemberIds.indexOf(memberId);
    if (index === -1) {
      this.editing.invitedMemberIds.push(memberId);
    } else {
      this.editing.invitedMemberIds.splice(index, 1);
    }
  }

  selectAllMembers() {
    this.editing.invitedMemberIds = this.allMembers.map(m => m.id);
  }

  clearMemberSelection() {
    this.editing.invitedMemberIds = [];
  }

  get selectedMembersCount(): number {
    return this.editing.invitedMemberIds?.length || 0;
  }

  save() {
    if (!this.editing.date || !this.editing.venue) {
      this.toast.warning('Missing fields', 'Please fill in date and venue');
      return;
    }

    // Validate member selection if not inviting all
    if (!this.editing.inviteAll && (!this.editing.invitedMemberIds || this.editing.invitedMemberIds.length === 0)) {
      this.toast.warning('No members selected', 'Please select at least one member to invite');
      return;
    }

    this.saving.set(true);
    this.api.createMeeting(this.editing).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        const msg = this.editing.inviteAll 
          ? 'All members have been notified to RSVP.'
          : `${this.selectedMembersCount} members have been invited.`;
        this.toast.success('Meeting scheduled', msg);
        this.loadMeetings();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Failed to create meeting', err.error?.message || 'Unknown error');
      }
    });
  }

  close() {
    this.showForm = false;
  }

  // Navigate to meeting dashboard
  viewMeeting(meeting: Meeting) {
    this.router.navigate(['/app/meetings', meeting.id]);
  }

  // ==================== RSVP Methods ====================

  openRsvpModal(meeting: Meeting) {
    this.selectedMeeting = meeting;
    this.showRsvpModal = true;
    this.loadAttendees(meeting.id);
    this.loadMyRsvp(meeting.id);
  }

  closeRsvpModal() {
    this.showRsvpModal = false;
    this.selectedMeeting = null;
    this.attendees = [];
    this.myRsvp = null;
  }

  loadAttendees(meetingId: number) {
    this.loadingAttendees.set(true);
    this.api.getMeetingAttendees(meetingId).subscribe({
      next: (data) => {
        this.attendees = data;
        this.loadingAttendees.set(false);
      },
      error: () => {
        this.loadingAttendees.set(false);
        this.toast.error('Failed to load attendees', 'Please try again.');
      }
    });
  }

  loadMyRsvp(meetingId: number) {
    this.api.getMyRsvp(meetingId).subscribe({
      next: (data) => {
        this.myRsvp = data;
      },
      error: () => {
        // Ignore - might not have RSVP yet
      }
    });
  }

  confirmAttending() {
    if (!this.selectedMeeting) return;
    
    this.submittingRsvp.set(true);
    this.api.submitRsvp(this.selectedMeeting.id, { attending: true }).subscribe({
      next: (data) => {
        this.myRsvp = data;
        this.submittingRsvp.set(false);
        this.toast.success('RSVP confirmed', 'You have confirmed your attendance.');
        this.loadAttendees(this.selectedMeeting!.id);
        this.loadMeetings(); // Refresh counts
      },
      error: (err) => {
        this.submittingRsvp.set(false);
        this.toast.error('Failed to submit RSVP', err.error?.message || 'Please try again.');
      }
    });
  }

  openDeclineModal() {
    this.declineReason = '';
    this.showDeclineModal = true;
  }

  closeDeclineModal() {
    this.showDeclineModal = false;
    this.declineReason = '';
  }

  submitDecline() {
    if (!this.selectedMeeting) return;
    
    if (!this.declineReason.trim()) {
      this.toast.warning('Reason required', 'Please provide a reason for not attending.');
      return;
    }

    this.submittingRsvp.set(true);
    this.api.submitRsvp(this.selectedMeeting.id, { 
      attending: false, 
      declineReason: this.declineReason 
    }).subscribe({
      next: (data) => {
        this.myRsvp = data;
        this.submittingRsvp.set(false);
        this.showDeclineModal = false;
        this.toast.info('RSVP submitted', 'Your response has been recorded.');
        this.loadAttendees(this.selectedMeeting!.id);
        this.loadMeetings(); // Refresh counts
      },
      error: (err) => {
        this.submittingRsvp.set(false);
        this.toast.error('Failed to submit RSVP', err.error?.message || 'Please try again.');
      }
    });
  }

  // Admin: Mark actual attendance
  async toggleAttendance(attendee: MeetingAttendee) {
    if (!this.selectedMeeting) return;
    if (!this.session.hasPermission('meetings', 'edit')) return;

    const newStatus = !attendee.attended;
    this.api.markAttendance(this.selectedMeeting.id, attendee.memberId, newStatus).subscribe({
      next: () => {
        attendee.attended = newStatus;
        this.toast.success('Attendance updated', `${attendee.memberName} marked as ${newStatus ? 'present' : 'absent'}.`);
        this.loadMeetings(); // Refresh counts
      },
      error: (err) => {
        this.toast.error('Failed to update attendance', err.error?.message || 'Please try again.');
      }
    });
  }

  // Helper methods
  get attendingCount(): number {
    return this.attendees.filter(a => a.rsvpStatus === 'ATTENDING').length;
  }

  get notAttendingCount(): number {
    return this.attendees.filter(a => a.rsvpStatus === 'NOT_ATTENDING').length;
  }

  get pendingCount(): number {
    return this.attendees.filter(a => a.rsvpStatus === 'PENDING').length;
  }

  getRsvpBadgeClass(status: string): string {
    switch (status) {
      case 'ATTENDING': return 'badge-success';
      case 'NOT_ATTENDING': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  getRsvpStatusLabel(status: string): string {
    switch (status) {
      case 'ATTENDING': return 'Attending';
      case 'NOT_ATTENDING': return 'Not Attending';
      default: return 'Pending';
    }
  }

  isFutureMeeting(meeting: Meeting): boolean {
    return new Date(meeting.date) >= new Date(new Date().toDateString());
  }
}
