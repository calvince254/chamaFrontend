import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from './confirm-dialog.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (dialog.visible()) {
      <div class="confirm-backdrop" (click)="dialog.resolve(false)">
        <div class="confirm-modal" (click)="$event.stopPropagation()">
          <div class="confirm-header">
            <h3>{{ dialog.config().title }}</h3>
            <button class="icon-btn" (click)="dialog.resolve(false)">
              <app-icon name="close"></app-icon>
            </button>
          </div>
          <div class="confirm-body">
            <p>{{ dialog.config().message }}</p>
            @if (dialog.config().showInput) {
              <div class="confirm-input">
                @if (dialog.config().inputLabel) {
                  <label>{{ dialog.config().inputLabel }}</label>
                }
                <input 
                  type="text" 
                  [value]="dialog.inputValue()"
                  (input)="onInput($event)"
                  [placeholder]="dialog.config().inputPlaceholder || ''"
                  autofocus>
              </div>
            }
          </div>
          <div class="confirm-footer">
            <button class="btn btn-ghost" (click)="dialog.resolve(false)">
              {{ dialog.config().cancelText }}
            </button>
            <button 
              class="btn" 
              [class.btn-primary]="dialog.config().confirmClass === 'primary'"
              [class.btn-danger]="dialog.config().confirmClass === 'danger'"
              [class.btn-warning]="dialog.config().confirmClass === 'warning'"
              [class.btn-info]="dialog.config().confirmClass === 'info'"
              [disabled]="dialog.config().showInput && !dialog.inputValue()"
              (click)="dialog.resolve(true)">
              {{ dialog.config().confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.15s ease;
    }

    .confirm-modal {
      background: var(--color-surface);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      min-width: 320px;
      max-width: 420px;
      animation: slideUp 0.2s ease;
    }

    .confirm-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
    }

    .confirm-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }

    .confirm-body {
      padding: 16px;
    }

    .confirm-body p {
      margin: 0;
      font-size: 12px;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .confirm-input {
      margin-top: 12px;
    }

    .confirm-input label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .confirm-input input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      font-size: 12px;
    }

    .confirm-input input:focus {
      outline: none;
      border-color: var(--color-primary);
    }

    .confirm-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--color-border);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(10px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class ConfirmDialogComponent {
  dialog = inject(ConfirmDialogService);

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.dialog.setInputValue(input.value);
  }
}
