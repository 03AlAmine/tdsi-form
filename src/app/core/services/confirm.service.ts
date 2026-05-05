import { Injectable, signal } from '@angular/core';

export interface ConfirmConfig {
  title: string;
  message: string;
  type: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  config = signal<ConfirmConfig | null>(null);

  confirm(config: Omit<ConfirmConfig, 'onConfirm' | 'onCancel'> & {
    onConfirm: () => void;
    onCancel?: () => void;
  }): void {
    this.config.set(config as ConfirmConfig);
  }

  confirmAction(): void {
    const current = this.config();
    if (current) {
      current.onConfirm();
      this.clear();
    }
  }

  cancel(): void {
    const current = this.config();
    if (current?.onCancel) {
      current.onCancel();
    }
    this.clear();
  }

  private clear(): void {
    this.config.set(null);
  }
}
