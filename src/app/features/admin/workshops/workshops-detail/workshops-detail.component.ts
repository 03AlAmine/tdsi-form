import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Workshop } from '../../../../core/model/models';
import { db } from '../../../../../firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { PublicRegistrationService } from '../../../../core/services/public-registration.service';
import { GuestRegistration } from '../../../../core/model/guest-registration.model';

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
  styleUrls: ['./workshops-detail.component.scss']
})
export class WorkshopDetailComponent {
  @Input() workshop: Workshop | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Workshop>();
  @Output() delete = new EventEmitter<Workshop>();

  private publicRegistrationService = inject(PublicRegistrationService);

  isOpen = signal(false);
  participants = signal<ParticipantInfo[]>([]);
  guestRegistrations = signal<GuestRegistration[]>([]);
  loadingParticipants = signal(false);
  loadingGuests = signal(false);
  selectedParticipant = signal<ParticipantInfo | null>(null);
  selectedGuest = signal<GuestRegistration | null>(null);
  showParticipantModal = signal(false);
  showGuestModal = signal(false);

  async open(workshop: Workshop): Promise<void> {
    this.workshop = workshop;
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';

    // Charger les participants membres
    await this.loadParticipantsInfo();

    // Charger les invités
    await this.loadGuestRegistrations();
  }

  closeModal(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
    this.close.emit();
  }

  async loadParticipantsInfo(): Promise<void> {
    if (!this.workshop?.registrations?.length) {
      this.participants.set([]);
      return;
    }

    this.loadingParticipants.set(true);
    try {
      // Tous les getDoc lancés en parallèle — 1 RTT au lieu de N
      const snaps = await Promise.all(
        this.workshop.registrations.map(uid => getDoc(doc(db, 'users', uid)))
      );

      const participantsList: ParticipantInfo[] = snaps.map((userSnap, i) => {
        const uid = this.workshop!.registrations[i];
        if (userSnap.exists()) {
          const d = userSnap.data();
          return {
            uid,
            displayName: d['displayName'] || 'Inconnu',
            email: d['email'] || 'Non disponible',
            promo: d['promo'] || 'Non spécifié'
          };
        }
        return { uid, displayName: 'Utilisateur inconnu', email: 'Non disponible', promo: 'Non spécifié' };
      });

      this.participants.set(participantsList);
    } catch (error) {
      console.error('Erreur chargement participants:', error);
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
      const guests = await this.publicRegistrationService.getRegistrationsByWorkshop(this.workshop.id);
      this.guestRegistrations.set(guests);
    } catch (error) {
      console.error('Erreur chargement invités:', error);
      this.guestRegistrations.set([]);
    } finally {
      this.loadingGuests.set(false);
    }
  }

  openParticipantProfile(participant: ParticipantInfo, event: Event): void {
    event.stopPropagation();
    this.selectedParticipant.set(participant);
    this.showParticipantModal.set(true);
  }

  closeParticipantModal(): void {
    this.showParticipantModal.set(false);
    setTimeout(() => {
      this.selectedParticipant.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  openGuestProfile(guest: GuestRegistration, event: Event): void {
    event.stopPropagation();
    this.selectedGuest.set(guest);
    this.showGuestModal.set(true);
  }

  closeGuestModal(): void {
    this.showGuestModal.set(false);
    setTimeout(() => {
      this.selectedGuest.set(null);
      document.body.style.overflow = '';
    }, 300);
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
    if (this.workshop && confirm(`Supprimer le workshop "${this.workshop.themeTitle}" ?`)) {
      this.delete.emit(this.workshop);
      this.closeModal();
    }
  }

  getStatusInfo(status: string): { label: string; icon: string; color: string } {
    const map: Record<string, { label: string; icon: string; color: string }> = {
      'planifié': { label: 'Planifié', icon: '📋', color: 'info' },
      'en cours': { label: 'En cours', icon: '▶️', color: 'primary' },
      'terminé': { label: 'Terminé', icon: '✅', color: 'success' },
      'annulé': { label: 'Annulé', icon: '❌', color: 'danger' }
    };
    return map[status] || { label: status, icon: '●', color: 'neutral' };
  }

  getLocationInfo(location: string): { icon: string; label: string } {
    const map: Record<string, { icon: string; label: string }> = {
      'en ligne': { icon: '💻', label: 'En ligne' },
      'présentiel': { icon: '🏛️', label: 'Présentiel' },
      'hybride': { icon: '🔄', label: 'Hybride' }
    };
    return map[location] || { icon: '📍', label: location };
  }

  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${minutes}min`;
  }
}
