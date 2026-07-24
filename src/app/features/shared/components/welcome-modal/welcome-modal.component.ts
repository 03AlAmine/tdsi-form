// welcome-modal.component.ts
import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

// ─────────────────────────────────────────────────────────────
// WelcomeModalComponent — modale affichée une seule fois, juste
// après une inscription réussie (voir AuthService.consumeJustRegistered()
// et MemberDashboardComponent qui la déclenche). Purement présentationnel :
// aucun accès Firestore/Auth ici, tout est passé en @Input.
//
// Le z-index (au-dessus de la navbar) et le verrouillage du scroll de la
// page pendant l'affichage sont gérés en CSS via `body:has(.welcome-overlay)`
// dans src/styles/_layout.scss — pas besoin d'y toucher ici.
// ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-welcome-modal',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome-modal.component.html',
  styleUrls: ['./welcome-modal.component.scss'],
})
export class WelcomeModalComponent {
  @Input() displayName = '';
  @Input() email = '';
  @Output() closed = new EventEmitter<void>();

  get firstName(): string {
    return this.displayName.split(' ')[0] || this.displayName;
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
