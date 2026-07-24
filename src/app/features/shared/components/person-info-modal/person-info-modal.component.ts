// person-info-modal.component.ts
import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonInfoService } from '../../../../core/services/person-info.service';
import { UserService } from '../../../../core/services/user.service';
import { User } from '../../../../core/model/models';

// ─────────────────────────────────────────────────────────────
// Fiche "auteur" — affichée en modal au-dessus de tout le reste
// (submissions admin, thématiques admin, drawer thématique membre).
// Affiche immédiatement les infos déjà connues (nom, promo, email
// éventuel) puis complète en tâche de fond avec le profil complet
// (établissement, filière, bio, réseaux) si un uid est disponible
// et lisible (auto-lecture si c'est soi-même, ou lecture admin).
// Un échec de lecture du profil complet (ex: membre non-admin qui
// consulte une fiche d'un autre uid, interdit par les règles
// Firestore) est silencieux : on garde l'affichage minimal.
// ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-person-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './person-info-modal.component.html',
  styleUrls: ['./person-info-modal.component.scss'],
})
export class PersonInfoModalComponent {
  personInfoService = inject(PersonInfoService);
  private userService = inject(UserService);

  fullProfile = signal<User | null>(null);
  profileLoading = signal(false);
  profileError = signal(false);

  constructor() {
    effect(() => {
      const person = this.personInfoService.current();
      this.fullProfile.set(null);
      this.profileError.set(false);
      if (person?.uid) {
        this.profileLoading.set(true);
        this.userService
          .getProfile(person.uid)
          .then((profile) => this.fullProfile.set(profile))
          .catch(() => this.profileError.set(true))
          .finally(() => this.profileLoading.set(false));
      }
    }, { allowSignalWrites: true });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.personInfoService.current()) this.personInfoService.close();
  }

  close(): void {
    this.personInfoService.close();
  }

  initialOf(name: string): string {
    return name?.trim()?.charAt(0)?.toUpperCase() || '?';
  }
}
