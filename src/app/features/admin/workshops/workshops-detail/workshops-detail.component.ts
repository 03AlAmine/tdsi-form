// workshops-detail.component.ts - Version améliorée
import { Component, Output, EventEmitter, signal, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Workshop } from '../../../../core/model/models';
import { GuestRegistration } from '../../../../core/model/guest-registration.model';
import { db } from '../../../../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { PublicRegistrationService } from '../../../../core/services/public-registration.service';
import {
  getAdminLocationIcon as sharedAdminLocationIcon,
  formatDuration as sharedFormatDuration,
} from '../../../../core/utils/workshop-display.util';

interface ParticipantInfo {
  uid: string;
  displayName: string;
  email: string;
  promo: string;
}

@Component({
  selector: 'app-workshop-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './workshops-detail.component.html',
  styleUrls: ['./workshops-detail.component.scss'],
})
export class WorkshopDetailComponent {
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Workshop>();
  @Output() delete = new EventEmitter<Workshop>();

  private publicRegistrationService = inject(PublicRegistrationService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private lastFocusedTrigger: HTMLElement | null = null;

  workshop: Workshop | null = null;
  isOpen = signal(false);
  participants = signal<ParticipantInfo[]>([]);
  guestRegistrations = signal<GuestRegistration[]>([]);
  loadingParticipants = signal(false);
  loadingGuests = signal(false);
  selectedParticipant = signal<ParticipantInfo | null>(null);
  selectedGuest = signal<GuestRegistration | null>(null);
  showParticipantModal = signal(false);
  showGuestModal = signal(false);

  // Ferme le modal le plus "au-dessus" en premier (invité > participant >
  // détail principal), comme un empilement de calques standard.
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showGuestModal()) {
      this.closeGuestModal();
    } else if (this.showParticipantModal()) {
      this.closeParticipantModal();
    } else if (this.isOpen()) {
      this.closeModal();
    }
  }

  async open(workshop: Workshop): Promise<void> {
    this.workshop = workshop;
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.lastFocusedTrigger = document.activeElement as HTMLElement;
    setTimeout(() => {
      (this.host.nativeElement.querySelector('.modal-close') as HTMLElement | null)?.focus();
    });

    await Promise.all([
      this.loadParticipantsInfo(),
      this.loadGuestRegistrations(),
    ]);
  }

  closeModal(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
    this.lastFocusedTrigger?.focus();
    this.lastFocusedTrigger = null;
    this.close.emit();
  }

  async loadParticipantsInfo(): Promise<void> {
    if (!this.workshop?.registrations?.length) {
      this.participants.set([]);
      return;
    }

    this.loadingParticipants.set(true);
    try {
      const snaps = await Promise.all(
        this.workshop.registrations.map((uid) => getDoc(doc(db, 'users', uid))),
      );

      const participantsList: ParticipantInfo[] = snaps.map((userSnap, i) => {
        const uid = this.workshop!.registrations[i];
        if (userSnap.exists()) {
          const data = userSnap.data();
          return {
            uid,
            displayName: data['displayName'] || 'Inconnu',
            email: data['email'] || 'Non disponible',
            promo: data['promo'] || 'Non spécifié',
          };
        }
        return {
          uid,
          displayName: 'Utilisateur inconnu',
          email: 'Non disponible',
          promo: 'Non spécifié',
        };
      });

      this.participants.set(participantsList);
    } catch {
      this.participants.set([]);
    } finally {
      this.loadingParticipants.set(false);
    }
  }

  async loadGuestRegistrations(): Promise<void> {
    if (!this.workshop?.id) {
      this.guestRegistrations.set([]);
      return;
    }

    this.loadingGuests.set(true);
    try {
      const guests =
        await this.publicRegistrationService.getRegistrationsByWorkshop(
          this.workshop.id,
        );
      this.guestRegistrations.set(guests);
    } catch {
      this.guestRegistrations.set([]);
    } finally {
      this.loadingGuests.set(false);
    }
  }

  getAvailablePlaces(): number {
    if (!this.workshop?.maxParticipants) return 0;
    const total =
      (this.workshop.registrations?.length || 0) +
      this.guestRegistrations().length;
    return Math.max(0, this.workshop.maxParticipants - total);
  }

  getFieldIcon(type: string): string {
    const icons: Record<string, string> = {
      text: 'fa-font',
      email: 'fa-envelope',
      number: 'fa-hashtag',
      textarea: 'fa-align-left',
      select: 'fa-caret-down',
      checkbox: 'fa-check-square',
    };
    return icons[type] || 'fa-pen';
  }

  openParticipantProfile(participant: ParticipantInfo, event: Event): void {
    event.stopPropagation();
    this.selectedParticipant.set(participant);
    this.showParticipantModal.set(true);
  }

  closeParticipantModal(): void {
    this.showParticipantModal.set(false);
    setTimeout(() => this.selectedParticipant.set(null), 300);
  }

  openGuestProfile(guest: GuestRegistration, event: Event): void {
    event.stopPropagation();
    this.selectedGuest.set(guest);
    this.showGuestModal.set(true);
  }

  closeGuestModal(): void {
    this.showGuestModal.set(false);
    setTimeout(() => this.selectedGuest.set(null), 300);
  }

  async checkInGuest(guestId: string): Promise<void> {
    await this.publicRegistrationService.checkIn(guestId);
    await this.loadGuestRegistrations();
    this.closeGuestModal();
  }

  onEdit(): void {
    if (this.workshop) {
      this.edit.emit(this.workshop);
      this.closeModal();
    }
  }

  onDelete(): void {
    if (this.workshop) {
      this.delete.emit(this.workshop);
      this.closeModal();
    }
  }

  getStatusInfo(status: string): {
    label: string;
    icon: string;
    color: string;
  } {
    const map: Record<string, { label: string; icon: string; color: string }> =
      {
        planifié: { label: 'Planifié', icon: 'fa-clock', color: 'info' },
        'en cours': {
          label: 'En cours',
          icon: 'fa-play-circle',
          color: 'primary',
        },
        terminé: {
          label: 'Terminé',
          icon: 'fa-check-circle',
          color: 'success',
        },
        annulé: { label: 'Annulé', icon: 'fa-ban', color: 'danger' },
      };
    return (
      map[status] || { label: status, icon: 'fa-circle', color: 'neutral' }
    );
  }

  getLocationInfo(location: string): { icon: string; label: string } {
    const labels: Record<string, string> = {
      'en ligne': 'En ligne',
      présentiel: 'Présentiel',
      hybride: 'Hybride',
    };
    return {
      icon: sharedAdminLocationIcon(location),
      label: labels[location] || location,
    };
  }

  getLocationIconClass(location: string): string {
    return this.getLocationInfo(location).icon;
  }

  formatDuration(minutes: number): string {
    return sharedFormatDuration(minutes);
  }
}
