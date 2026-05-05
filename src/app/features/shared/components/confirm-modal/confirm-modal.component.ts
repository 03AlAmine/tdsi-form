import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-modal.component.html',
  styleUrls: ['./confirm-modal.component.scss']
})
export class ConfirmModalComponent {
  confirmService = inject(ConfirmService);

  onConfirm(): void {
    this.confirmService.confirmAction();
  }

  onCancel(): void {
    this.confirmService.cancel();
  }
}
