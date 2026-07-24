// features/shared/components/member-card/member-card.component.ts
// ─────────────────────────────────────────────────────────────────────
// Carte membre "badge digital" avec flip 3D au clic. Recto : identité +
// effet holographique qui suit la souris (réutilise
// TiltSpotlightDirective, déjà en place pour les workshop-cards — même
// mécanique, pas de nouvelle logique de calcul de tilt à écrire). Verso :
// motif décoratif façon QR (volontairement NON fonctionnel — aucun
// endpoint de vérification de badge n'existe côté backend, donc on
// n'affiche pas un vrai code scannable qui laisserait croire à une
// fonctionnalité absente) + identifiant membre.
// ─────────────────────────────────────────────────────────────────────

import { Component, Input, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TiltSpotlightDirective } from '../../../../core/directives/tilt-spotlight.directive';
import { User } from '../../../../core/model/models';

@Component({
  selector: 'app-member-card',
  standalone: true,
  imports: [CommonModule, TiltSpotlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-card.component.html',
  styleUrl: './member-card.component.scss',
})
export class MemberCardComponent {
  @Input() user: Partial<User> | null | undefined;
  /** Libellé additionnel affiché sous le nom (ex: "Membre depuis 128 jours"). */
  @Input() memberSinceLabel = '';

  readonly flipped = signal(false);
  /** Grille décorative (verso) — juste un pavage visuel, pas un vrai QR. */
  readonly matrixCells = Array.from({ length: 64 });

  toggleFlip(): void {
    this.flipped.update((v) => !v);
  }

  get initials(): string {
    const name = this.user?.displayName?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('');
  }

  get shortUid(): string {
    const uid = this.user?.uid ?? '';
    return uid ? `TDSI-${uid.slice(0, 6).toUpperCase()}` : 'TDSI-------';
  }

  get issuedYear(): string {
    const date = this.user?.createdAt;
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? '—' : String(d.getFullYear());
  }
}
