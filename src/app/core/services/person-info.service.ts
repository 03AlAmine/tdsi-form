// core/services/person-info.service.ts
import { Injectable, signal } from '@angular/core';

// ─────────────────────────────────────────────────────────────
// PersonInfoService — pilote la fiche "Voir la personne" (auteur
// d'une soumission ou d'une thématique). Suit le même patron que
// ConfirmService : un signal global consommé par un unique
// <app-person-info-modal /> monté dans les layouts (membre + admin),
// déclenché depuis n'importe quel composant via `show(...)`.
// ─────────────────────────────────────────────────────────────
export interface PersonInfoBasic {
  uid?: string;
  name: string;
  email?: string;
  promo?: string;
  aiAssisted?: boolean;
  // Contexte optionnel affiché en en-tête (ex: titre de la thématique proposée)
  context?: string;
}

@Injectable({ providedIn: 'root' })
export class PersonInfoService {
  current = signal<PersonInfoBasic | null>(null);

  show(person: PersonInfoBasic): void {
    this.current.set(person);
  }

  close(): void {
    this.current.set(null);
  }
}
