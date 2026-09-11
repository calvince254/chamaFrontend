import { Injectable, signal, computed } from '@angular/core';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: 'primary' | 'danger' | 'warning' | 'info';
  type?: 'primary' | 'danger' | 'warning' | 'info'; // Alias for confirmClass
  showInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private _visible = signal(false);
  private _config = signal<ConfirmDialogConfig>({
    title: 'Confirm',
    message: 'Are you sure?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmClass: 'primary',
    showInput: false
  });
  private _inputValue = signal('');
  private _resolver: ((value: string | boolean | null) => void) | null = null;

  visible = computed(() => this._visible());
  config = computed(() => this._config());
  inputValue = computed(() => this._inputValue());

  setInputValue(value: string) {
    this._inputValue.set(value);
  }

  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    // Support both 'type' and 'confirmClass' (type is alias)
    const confirmClass = config.confirmClass || config.type || 'primary';
    
    this._config.set({
      title: config.title,
      message: config.message,
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      confirmClass: confirmClass,
      showInput: false
    });
    this._visible.set(true);

    return new Promise<boolean>(resolve => {
      this._resolver = resolve as (value: string | boolean | null) => void;
    });
  }

  prompt(config: Omit<ConfirmDialogConfig, 'showInput'> & { inputLabel?: string; inputPlaceholder?: string }): Promise<string | null> {
    // Support both 'type' and 'confirmClass' (type is alias)
    const confirmClass = config.confirmClass || config.type || 'primary';
    
    this._config.set({
      title: config.title,
      message: config.message,
      confirmText: config.confirmText || 'Submit',
      cancelText: config.cancelText || 'Cancel',
      confirmClass: confirmClass,
      showInput: true,
      inputLabel: config.inputLabel,
      inputPlaceholder: config.inputPlaceholder
    });
    this._inputValue.set('');
    this._visible.set(true);

    return new Promise<string | null>(resolve => {
      this._resolver = resolve as (value: string | boolean | null) => void;
    });
  }

  // Shorthand methods
  delete(itemName: string): Promise<boolean> {
    return this.confirm({
      title: 'Delete',
      message: `Are you sure you want to delete "${itemName}"? This cannot be undone.`,
      confirmText: 'Delete',
      confirmClass: 'danger'
    });
  }

  action(title: string, message: string): Promise<boolean> {
    return this.confirm({
      title,
      message,
      confirmText: 'Yes',
      confirmClass: 'primary'
    });
  }

  resolve(result: boolean) {
    this._visible.set(false);
    if (this._resolver) {
      if (this._config().showInput) {
        this._resolver(result ? this._inputValue() : null);
      } else {
        this._resolver(result);
      }
      this._resolver = null;
    }
  }
}
