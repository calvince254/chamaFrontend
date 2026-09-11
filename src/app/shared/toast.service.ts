import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  toasts = signal<Toast[]>([]);

  show(type: Toast['type'], title: string, message?: string, duration = 4000) {
    const id = this.nextId++;
    const toast: Toast = { id, type, title, message, duration };
    
    this.toasts.update(current => [...current, toast]);
    
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    
    return id;
  }

  success(title: string, message?: string) {
    return this.show('success', title, message);
  }

  error(title: string, message?: string) {
    return this.show('error', title, message, 6000);
  }

  warning(title: string, message?: string) {
    return this.show('warning', title, message);
  }

  info(title: string, message?: string) {
    return this.show('info', title, message);
  }

  dismiss(id: number) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }

  dismissAll() {
    this.toasts.set([]);
  }
}
