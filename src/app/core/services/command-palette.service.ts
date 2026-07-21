// core/services/command-palette.service.ts
// ─────────────────────────────────────────────────────────────────────
// Pont minimal entre un déclencheur externe (ex: bouton "⌘K" dans la
// navbar) et CommandPaletteComponent, monté une seule fois dans
// AppComponent. On ne veut pas que la navbar dépende directement du
// composant (import croisé, cycle de vie...) : un simple signal suffit,
// CommandPaletteComponent l'observe via effect() et s'ouvre en réaction.
// ─────────────────────────────────────────────────────────────────────

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  // Incrémenté à chaque demande d'ouverture externe. La valeur elle-même
  // n'a pas de sens, seul le changement compte (permet de déclencher
  // plusieurs ouvertures d'affilée même si le composant s'est refermé
  // entre-temps sans qu'on ait besoin d'un booléen à réinitialiser).
  readonly openRequests = signal(0);

  // ✅ Vrai dès la première ouverture, peu importe le déclencheur (clic
  // navbar ou raccourci clavier). Sert à masquer l'astuce de
  // découvrabilité "Essayez ⌘K" une fois que la personne a compris.
  readonly hasBeenOpened = signal(false);

  requestOpen(): void {
    this.openRequests.update((n) => n + 1);
  }

  markOpened(): void {
    this.hasBeenOpened.set(true);
  }
}
