import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Meeting, MeetingAttendee, Member, Fine, FineType } from '../../core/models/models';
import { SessionService } from '../../core/services/session.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

@Component({
  selector: 'app-meeting-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './meeting-dashboard.component.html',
  styleUrl: './meeting-dashboard.component.css'
})
export class MeetingDashboardComponent implements OnInit {
  @ViewChild('minutesFileInput') minutesFileInput!: ElementRef<HTMLInputElement>;
  
  meetingId!: number;
  meeting: Meeting | null = null;
  loading = signal(false);

  // Tabs
  activeTab: 'attendees' | 'fines' | 'minutes' = 'attendees';

  // Attendees
  attendees: MeetingAttendee[] = [];
  loadingAttendees = signal(false);

  // Add member modal
  showAddMemberModal = false;
  uninvitedMembers: Member[] = [];
  loadingUninvited = signal(false);
  memberSearch = '';
  addingMember = signal(false);

  // My RSVP
  myRsvp: MeetingAttendee | null = null;
  showDeclineModal = false;
  declineReason = '';
  submittingRsvp = signal(false);

  // Fines
  fines: Fine[] = [];
  loadingFines = signal(false);
  fineTypes: FineType[] = [];

  // Impose fine modal
  showImposeFineModal = false;
  selectedMemberForFine: MeetingAttendee | null = null;
  selectedFineTypeId: number | null = null;
  fineNotes = '';
  imposingFine = signal(false);

  // Payment modal
  showPaymentModal = false;
  selectedFineForPayment: Fine | null = null;
  paymentAmount: number = 0;
  recordingPayment = signal(false);

  // Meeting Minutes
  uploadingMinutes = signal(false);
  deletingMinutes = signal(false);
  generatingMinutes = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.meetingId = +params['id'];
      this.loadMeetingDetails();
      this.loadAttendees();
      this.loadFines();
      this.loadMyRsvp();
      this.loadFineTypes();
    });
  }

  goBack() {
    this.router.navigate(['/app/meetings']);
  }

  loadMeetingDetails() {
    this.loading.set(true);
    this.api.getMeetingDetails(this.meetingId).subscribe({
      next: (meeting) => {
        this.meeting = meeting;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Failed to load meeting', err.error?.message || 'Please try again.');
        this.goBack();
      }
    });
  }

  loadAttendees() {
    this.loadingAttendees.set(true);
    this.api.getMeetingAttendees(this.meetingId).subscribe({
      next: (attendees) => {
        this.attendees = attendees;
        this.loadingAttendees.set(false);
      },
      error: () => {
        this.loadingAttendees.set(false);
      }
    });
  }

  loadMyRsvp() {
    this.api.getMyRsvp(this.meetingId).subscribe({
      next: (data) => {
        this.myRsvp = data;
      },
      error: () => {}
    });
  }

  loadFines() {
    this.loadingFines.set(true);
    this.api.getMeetingFines(this.meetingId).subscribe({
      next: (fines) => {
        this.fines = fines;
        this.loadingFines.set(false);
      },
      error: () => {
        this.loadingFines.set(false);
      }
    });
  }

  loadFineTypes() {
    this.api.getActiveFineTypes().subscribe({
      next: (types) => {
        this.fineTypes = types;
      },
      error: () => {}
    });
  }

  // ==================== RSVP ====================

  confirmAttending() {
    this.submittingRsvp.set(true);
    this.api.submitRsvp(this.meetingId, { attending: true }).subscribe({
      next: (data) => {
        this.myRsvp = data;
        this.submittingRsvp.set(false);
        this.toast.success('RSVP confirmed', 'You have confirmed your attendance.');
        this.loadAttendees();
        this.loadMeetingDetails();
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
  }

  submitDecline() {
    if (!this.declineReason.trim()) {
      this.toast.warning('Reason required', 'Please provide a reason.');
      return;
    }

    this.submittingRsvp.set(true);
    this.api.submitRsvp(this.meetingId, { attending: false, declineReason: this.declineReason }).subscribe({
      next: (data) => {
        this.myRsvp = data;
        this.submittingRsvp.set(false);
        this.showDeclineModal = false;
        this.toast.info('RSVP submitted', 'Your response has been recorded.');
        this.loadAttendees();
        this.loadMeetingDetails();
      },
      error: (err) => {
        this.submittingRsvp.set(false);
        this.toast.error('Failed to submit RSVP', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Attendance Management ====================

  toggleAttendance(attendee: MeetingAttendee) {
    // Simple toggle - present to absent or absent to present
    const newStatus = !attendee.attended;
    const statusText = newStatus ? 'present' : 'absent';
    
    this.api.markAttendance(this.meetingId, attendee.memberId, newStatus).subscribe({
      next: () => {
        attendee.attended = newStatus;
        this.toast.success('Attendance updated', `${attendee.memberName} marked as ${statusText}.`);
        this.loadMeetingDetails();
        this.loadFines();
      },
      error: (err) => {
        this.toast.error('Failed to update', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Add/Remove Members ====================

  openAddMemberModal() {
    this.showAddMemberModal = true;
    this.memberSearch = '';
    this.loadUninvitedMembers();
  }

  closeAddMemberModal() {
    this.showAddMemberModal = false;
  }

  loadUninvitedMembers() {
    this.loadingUninvited.set(true);
    this.api.getUninvitedMembers(this.meetingId).subscribe({
      next: (members) => {
        this.uninvitedMembers = members;
        this.loadingUninvited.set(false);
      },
      error: () => {
        this.loadingUninvited.set(false);
      }
    });
  }

  get filteredUninvited(): Member[] {
    if (!this.memberSearch.trim()) return this.uninvitedMembers;
    const search = this.memberSearch.toLowerCase();
    return this.uninvitedMembers.filter(m => 
      m.name.toLowerCase().includes(search) || 
      m.memberNo.toLowerCase().includes(search)
    );
  }

  addMember(member: Member) {
    this.addingMember.set(true);
    this.api.addMemberToMeeting(this.meetingId, member.id).subscribe({
      next: () => {
        this.addingMember.set(false);
        this.toast.success('Member added', `${member.name} has been invited.`);
        this.loadAttendees();
        this.loadMeetingDetails();
        this.loadUninvitedMembers();
      },
      error: (err) => {
        this.addingMember.set(false);
        this.toast.error('Failed to add member', err.error?.message || 'Please try again.');
      }
    });
  }

  async removeMember(attendee: MeetingAttendee) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove from meeting?',
      message: `Remove ${attendee.memberName} from this meeting?`,
      confirmText: 'Remove',
      type: 'danger'
    });

    if (confirmed) {
      this.api.removeMemberFromMeeting(this.meetingId, attendee.memberId).subscribe({
        next: () => {
          this.toast.success('Member removed', `${attendee.memberName} has been removed.`);
          this.loadAttendees();
          this.loadMeetingDetails();
        },
        error: (err) => {
          this.toast.error('Failed to remove', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  // ==================== Fines ====================

  // Get fines for selected member in modal
  get selectedMemberFines(): Fine[] {
    if (!this.selectedMemberForFine) return [];
    return this.fines.filter(f => f.memberId === this.selectedMemberForFine!.memberId);
  }

  openImposeFineModal(attendee: MeetingAttendee) {
    this.selectedMemberForFine = attendee;
    this.selectedFineTypeId = null;
    this.fineNotes = '';
    this.showImposeFineModal = true;
  }

  closeImposeFineModal() {
    this.showImposeFineModal = false;
    this.selectedMemberForFine = null;
  }

  imposeFine() {
    if (!this.selectedMemberForFine || !this.selectedFineTypeId) {
      this.toast.warning('Select fine type', 'Please select a fine type to impose.');
      return;
    }

    this.imposingFine.set(true);
    this.api.imposeFine(this.meetingId, {
      memberId: this.selectedMemberForFine.memberId,
      fineTypeId: this.selectedFineTypeId,
      notes: this.fineNotes || undefined
    }).subscribe({
      next: () => {
        this.imposingFine.set(false);
        this.selectedFineTypeId = null;
        this.fineNotes = '';
        this.toast.success('Fine imposed', `Fine has been added.`);
        this.loadFines();
        this.loadMeetingDetails();
      },
      error: (err) => {
        this.imposingFine.set(false);
        this.toast.error('Failed to impose fine', err.error?.message || 'Please try again.');
      }
    });
  }

  // ==================== Payment ====================

  openPaymentModal(fine: Fine) {
    this.selectedFineForPayment = fine;
    this.paymentAmount = fine.amount - (fine.paidAmount || 0); // Default to full balance
    this.showPaymentModal = true;
    // Close impose modal if open
    this.showImposeFineModal = false;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedFineForPayment = null;
    this.paymentAmount = 0;
  }

  recordPayment() {
    if (!this.selectedFineForPayment || !this.paymentAmount || this.paymentAmount <= 0) {
      this.toast.warning('Invalid amount', 'Please enter a valid payment amount.');
      return;
    }

    const balance = this.selectedFineForPayment.amount - (this.selectedFineForPayment.paidAmount || 0);
    if (this.paymentAmount > balance) {
      this.toast.warning('Amount too high', 'Payment amount cannot exceed the balance.');
      return;
    }

    this.recordingPayment.set(true);
    this.api.recordFinePayment(this.meetingId, this.selectedFineForPayment.id, this.paymentAmount).subscribe({
      next: () => {
        this.recordingPayment.set(false);
        this.toast.success('Payment recorded', `KES ${this.paymentAmount} payment recorded.`);
        this.closePaymentModal();
        this.loadFines();
        this.loadMeetingDetails();
      },
      error: (err) => {
        this.recordingPayment.set(false);
        this.toast.error('Failed to record payment', err.error?.message || 'Please try again.');
      }
    });
  }

  async deleteFine(fine: Fine) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete fine?',
      message: `Delete this fine for ${fine.memberName}?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      this.api.deleteFine(this.meetingId, fine.id).subscribe({
        next: () => {
          this.toast.success('Fine deleted', '');
          this.loadFines();
          this.loadMeetingDetails();
        },
        error: (err) => {
          this.toast.error('Failed to delete', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  // ==================== Computed Values ====================

  get totalFinesAmount(): number {
    return this.fines.reduce((sum, f) => sum + f.amount, 0);
  }

  get totalFinesPaid(): number {
    return this.fines.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
  }

  get totalFinesBalance(): number {
    return this.totalFinesAmount - this.totalFinesPaid;
  }

  // ==================== Helpers ====================

  isFutureMeeting(): boolean {
    if (!this.meeting) return false;
    return new Date(this.meeting.date) >= new Date(new Date().toDateString());
  }

  get attendingCount(): number {
    return this.attendees.filter(a => a.rsvpStatus === 'ATTENDING').length;
  }

  get notAttendingCount(): number {
    return this.attendees.filter(a => a.rsvpStatus === 'NOT_ATTENDING').length;
  }

  get pendingCount(): number {
    return this.attendees.filter(a => a.rsvpStatus === 'PENDING').length;
  }

  get actualAttendanceCount(): number {
    return this.attendees.filter(a => a.attended).length;
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

  getFineBadgeClass(status: string): string {
    switch (status) {
      case 'PAID': return 'badge-success';
      case 'PARTIAL': return 'badge-warning';
      case 'WAIVED': return 'badge-neutral';
      default: return 'badge-danger';
    }
  }

  getMemberFines(memberId: number): Fine[] {
    return this.fines.filter(f => f.memberId === memberId);
  }

  getMemberFinesTotal(memberId: number): number {
    return this.getMemberFines(memberId).reduce((sum, f) => sum + f.amount, 0);
  }

  // ==================== Meeting Minutes ====================

  triggerMinutesUpload() {
    this.minutesFileInput?.nativeElement?.click();
  }

  onMinutesFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    
    // Validate file type - only DOC allowed
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.doc')) {
      this.toast.error('Invalid file type', 'Please upload a DOC file.');
      input.value = '';
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      this.toast.error('File too large', 'Maximum file size is 10MB.');
      input.value = '';
      return;
    }

    this.uploadMinutes(file);
    input.value = '';
  }

  uploadMinutes(file: File) {
    this.uploadingMinutes.set(true);
    this.api.uploadMeetingMinutes(this.meetingId, file).subscribe({
      next: (meeting) => {
        this.meeting = meeting;
        this.uploadingMinutes.set(false);
        this.toast.success('Minutes uploaded', `${file.name} has been uploaded successfully.`);
      },
      error: (err) => {
        this.uploadingMinutes.set(false);
        this.toast.error('Upload failed', err.error?.message || 'Please try again.');
      }
    });
  }

  downloadMinutes() {
    if (!this.meeting?.hasMinutesFile) return;

    this.api.downloadMeetingMinutes(this.meetingId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.meeting?.minutesFileName || 'meeting-minutes';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.toast.error('Download failed', err.error?.message || 'Please try again.');
      }
    });
  }

  async deleteMinutes() {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete meeting minutes?',
      message: `Delete the uploaded minutes file "${this.meeting?.minutesFileName}"?`,
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      this.deletingMinutes.set(true);
      this.api.deleteMeetingMinutes(this.meetingId).subscribe({
        next: (meeting) => {
          this.meeting = meeting;
          this.deletingMinutes.set(false);
          this.toast.success('Minutes deleted', 'The meeting minutes have been deleted.');
        },
        error: (err) => {
          this.deletingMinutes.set(false);
          this.toast.error('Delete failed', err.error?.message || 'Please try again.');
        }
      });
    }
  }

  getFileIcon(fileName: string | undefined): string {
    if (!fileName) return 'file';
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'file-pdf';
      case 'doc':
      case 'docx': return 'file-doc';
      case 'xls':
      case 'xlsx': return 'file-xls';
      default: return 'file';
    }
  }

  /**
   * Generate meeting minutes document with real data from the system
   * Downloads as .doc file that can be opened in Word
   */
  generateMinutes() {
    this.generatingMinutes.set(true);
    this.api.generateMeetingMinutes(this.meetingId).subscribe({
      next: (blob) => {
        this.generatingMinutes.set(false);
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Generate filename with meeting date
        const date = this.meeting?.date ? new Date(this.meeting.date).toISOString().split('T')[0] : 'meeting';
        a.download = `meeting-minutes-${date}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.success('Minutes generated', 'Document downloaded. Fill it in and upload.');
      },
      error: (err) => {
        this.generatingMinutes.set(false);
        this.toast.error('Generation failed', err.error?.message || 'Please try again.');
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
