import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../shared/toast.service';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { IconComponent } from '../../shared/icon.component';
import { Resource, PageResponse } from '../../core/models/models';
import {
  ListRowCardComponent,
  ListRowSecondaryDirective,
  ListRowFooterDirective,
  LabelValueComponent,
  PaginationBarComponent
} from '../../shared/components';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ListRowCardComponent, ListRowSecondaryDirective, ListRowFooterDirective, LabelValueComponent, PaginationBarComponent],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.css',
})
export class ResourcesComponent implements OnInit {
  Math = Math;  // Expose Math for template
  resources: Resource[] = [];
  search = '';
  loading = signal(false);
  
  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  isFirst = true;
  isLast = true;

  // Upload form
  showUploadForm = false;
  uploadName = '';
  uploadDescription = '';
  selectedFile: File | null = null;
  uploading = signal(false);

  // Edit form
  showEditForm = false;
  editingResource: Resource | null = null;
  editName = '';
  editDescription = '';
  saving = signal(false);

  // Detail view
  showDetailModal = false;
  selectedResource: Resource | null = null;

  constructor(
    private api: ApiService,
    public session: SessionService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    // Only load data if user has permission to view resources
    if (this.session.can('VIEW_RESOURCES') || this.session.can('UPLOAD_RESOURCE')) {
      this.loadResources();
    }
  }

  loadResources() {
    this.loading.set(true);
    const searchTerm = this.search.trim() || undefined;
    
    this.api.getResourcesPaginated(this.currentPage, this.pageSize, searchTerm).subscribe({
      next: (response: PageResponse<Resource>) => {
        this.resources = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.isFirst = response.first;
        this.isLast = response.last;
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status !== 403) {
          this.toast.error('Failed to load resources', 'Please try again.');
        }
      }
    });
  }

  onSearchChange() {
    this.currentPage = 0;
    this.loadResources();
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadResources();
    }
  }

  nextPage() {
    if (!this.isLast) {
      this.currentPage++;
      this.loadResources();
    }
  }

  prevPage() {
    if (!this.isFirst) {
      this.currentPage--;
      this.loadResources();
    }
  }

  // ==================== Upload ====================

  openUploadForm() {
    this.uploadName = '';
    this.uploadDescription = '';
    this.selectedFile = null;
    this.showUploadForm = true;
  }

  closeUploadForm() {
    this.showUploadForm = false;
    this.selectedFile = null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      // Auto-fill name if empty
      if (!this.uploadName && this.selectedFile) {
        this.uploadName = this.selectedFile.name.replace(/\.[^/.]+$/, '');
      }
    }
  }

  uploadResource() {
    if (!this.selectedFile) {
      this.toast.warning('No file selected', 'Please select a file to upload.');
      return;
    }
    if (!this.uploadName.trim()) {
      this.toast.warning('Name required', 'Please enter a name for the resource.');
      return;
    }

    this.uploading.set(true);
    this.api.uploadResource(this.uploadName.trim(), this.uploadDescription.trim(), this.selectedFile).subscribe({
      next: () => {
        this.uploading.set(false);
        this.toast.success('Resource uploaded', 'The file has been uploaded successfully.');
        this.closeUploadForm();
        this.loadResources();
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error('Upload failed', err.error?.message || 'Failed to upload file.');
      }
    });
  }

  // ==================== Edit ====================

  openEditForm(resource: Resource) {
    this.editingResource = resource;
    this.editName = resource.name;
    this.editDescription = resource.description || '';
    this.showEditForm = true;
  }

  closeEditForm() {
    this.showEditForm = false;
    this.editingResource = null;
  }

  saveResource() {
    if (!this.editingResource) return;
    if (!this.editName.trim()) {
      this.toast.warning('Name required', 'Please enter a name.');
      return;
    }

    this.saving.set(true);
    this.api.updateResource(this.editingResource.id, {
      name: this.editName.trim(),
      description: this.editDescription.trim()
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Resource updated', 'Details have been saved.');
        this.closeEditForm();
        this.loadResources();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error('Update failed', err.error?.message || 'Failed to update resource.');
      }
    });
  }

  // ==================== Delete ====================

  async deleteResource(resource: Resource) {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete Resource',
      message: `Are you sure you want to delete "${resource.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      this.api.deleteResource(resource.id).subscribe({
        next: () => {
          this.toast.success('Resource deleted', 'The resource has been removed.');
          this.loadResources();
        },
        error: (err) => {
          this.toast.error('Delete failed', err.error?.message || 'Failed to delete resource.');
        }
      });
    }
  }

  // ==================== Download ====================

  downloadResource(resource: Resource) {
    this.api.downloadResource(resource.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resource.originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toast.success('Download started', `Downloading ${resource.originalFileName}`);
      },
      error: (err) => {
        this.toast.error('Download failed', err.error?.message || 'Failed to download file.');
      }
    });
  }

  // ==================== Detail View ====================

  viewResource(resource: Resource) {
    this.selectedResource = resource;
    this.showDetailModal = true;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedResource = null;
  }

  // ==================== Helpers ====================

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileIcon(extension: string): string {
    const ext = extension?.toLowerCase();
    if (['pdf'].includes(ext)) return 'file-text';
    if (['doc', 'docx'].includes(ext)) return 'file-text';
    if (['xls', 'xlsx'].includes(ext)) return 'file-spreadsheet';
    if (['ppt', 'pptx'].includes(ext)) return 'file';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'avi', 'mov'].includes(ext)) return 'video';
    if (['mp3', 'wav'].includes(ext)) return 'music';
    if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
    return 'file';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  }

  // ==================== Mobile Helpers ====================

  handleMobileResourceAction(resource: Resource) {
    if (this.session.can('DOWNLOAD_RESOURCE')) {
      this.downloadResource(resource);
    } else {
      this.viewResource(resource);
    }
  }

  getMobileResourceActionLabel(resource: Resource): string {
    return this.session.can('DOWNLOAD_RESOURCE') ? 'Download' : 'View';
  }
}
