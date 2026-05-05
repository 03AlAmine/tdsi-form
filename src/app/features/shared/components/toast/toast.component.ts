import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent {
  toastService = inject(ToastService);
  exiting = new Set<string>();

  removeToast(id: string) {
    this.exiting.add(id);
    setTimeout(() => {
      this.toastService.dismiss(id);
      this.exiting.delete(id);
    }, 300);
  }
}
