// jitsi-meet.component.ts - Version avec bouton bloc-notes amélioré

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkshopService } from '../../core/services/workshop.service';
import { ToastService } from '../../core/services/toast.service';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase.config';

declare var JitsiMeetExternalAPI: any;

@Component({
  selector: 'app-jitsi-meet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jitsi-meet.component.html',
  styleUrls: ['./jitsi-meet.component.scss'],
})
export class JitsiMeetComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private workshopService = inject(WorkshopService);
  private toastService = inject(ToastService);

  private api: any = null;
  private workshopId: string | null = null;
  private statusUpdated = false;
  private autoSaveTimer: any = null;

  // Bloc-notes
  showNotes = false;
  isMinimized = false;
  meetingNotes = '';
  isSaving = false;
  workshopTitle = '';

  async ngOnInit(): Promise<void> {
    this.workshopId = this.route.snapshot.paramMap.get('id');
    const user = this.authService.currentUser;

    if (!user) {
      this.router.navigate(['/connexion']);
      return;
    }

    // Récupérer les infos du workshop
    const workshop = await this.workshopService.getWorkshopById(this.workshopId!);
    this.workshopTitle = workshop?.themeTitle || 'Workshop';

    if (!workshop) {
      this.toastService.error('Workshop introuvable');
      this.router.navigate(['/workshops']);
      return;
    }

    if (!workshop.meetLink) {
      console.error('Aucun lien de réunion trouvé');
      this.toastService.error('Lien de réunion non disponible');
      this.router.navigate(['/workshops']);
      return;
    }

    // ✅ On ne peut rejoindre le meet que pendant la fenêtre horaire du
    // workshop (entre date de début et date de fin calculée à partir de
    // la durée). Empêche l'accès anticipé même via un lien direct.
    const now = new Date();
    const startDate = new Date(workshop.date);
    const duration = workshop.duration || 90;
    const endDate = workshop.endDate
      ? new Date(workshop.endDate)
      : new Date(startDate.getTime() + duration * 60000);

    if (workshop.status === 'annulé') {
      this.toastService.error('Ce workshop a été annulé');
      this.router.navigate(['/workshops']);
      return;
    }

    if (now < startDate) {
      this.toastService.error(
        `Le meet n'est pas encore ouvert. Rendez-vous le ${startDate.toLocaleDateString('fr-FR')} à ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`,
      );
      this.router.navigate(['/workshops']);
      return;
    }

    if (now > endDate) {
      this.toastService.error('Ce workshop est terminé.');
      this.router.navigate(['/workshops']);
      return;
    }

    // Charger les notes existantes
    await this.loadNotes();

    // Mettre à jour le statut du workshop
    await this.updateWorkshopStatus();

    // Extraire le nom de la salle depuis l'URL Jitsi
    const urlParts = workshop.meetLink.split('/');
    const roomName = urlParts[urlParts.length - 1];

    // Charger le SDK Jitsi
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.onload = () => this.initJitsi(roomName, user);
    document.head.appendChild(script);
  }

  // Charger les notes depuis Firestore
  private async loadNotes(): Promise<void> {
    if (!this.authService.currentUser?.uid || !this.workshopId) return;

    try {
      const docRef = doc(db, 'workshop_notes', `${this.authService.currentUser.uid}_${this.workshopId}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        this.meetingNotes = docSnap.data()['content'] || '';
      }
    } catch (error) {
      console.error('Erreur chargement notes:', error);
    }
  }

  // Sauvegarde automatique (debounced)
  autoSaveNotes(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.saveNotes(false);
    }, 2000);
  }

  // Sauvegarder les notes
  async saveNotes(showToast: boolean = true): Promise<void> {
    if (!this.authService.currentUser?.uid || !this.workshopId) {
      if (showToast) this.toastService.error('Impossible de sauvegarder');
      return;
    }

    this.isSaving = true;
    try {
      const docRef = doc(db, 'workshop_notes', `${this.authService.currentUser.uid}_${this.workshopId}`);
      await setDoc(docRef, {
        content: this.meetingNotes,
        workshopId: this.workshopId,
        workshopTitle: this.workshopTitle,
        userId: this.authService.currentUser.uid,
        updatedAt: new Date()
      });
      if (showToast) {
        this.toastService.success('Notes sauvegardées 📝');
      }
    } catch (error) {
      console.error('Erreur sauvegarde notes:', error);
      if (showToast) this.toastService.error('Erreur lors de la sauvegarde');
    } finally {
      this.isSaving = false;
    }
  }

  // Effacer toutes les notes
  clearNotes(): void {
    if (confirm('Voulez-vous vraiment effacer toutes vos notes ?')) {
      this.meetingNotes = '';
      this.saveNotes(true);
    }
  }

  // Copier les notes
  copyNotes(): void {
    navigator.clipboard.writeText(this.meetingNotes).then(() => {
      this.toastService.success('Notes copiées dans le presse-papier 📋');
    }).catch(() => {
      this.toastService.error('Impossible de copier');
    });
  }

  // Compter les mots
  wordCount(): number {
    if (!this.meetingNotes.trim()) return 0;
    return this.meetingNotes.trim().split(/\s+/).length;
  }

  toggleNotes(): void {
    this.showNotes = !this.showNotes;
    if (this.showNotes) {
      this.isMinimized = false;
    }
  }

  minimizeNotes(): void {
    this.isMinimized = true;
  }

  restoreNotes(): void {
    this.isMinimized = false;
  }

  private async updateWorkshopStatus(): Promise<void> {
    if (!this.workshopId || this.statusUpdated) return;

    try {
      const workshop = await this.workshopService.getWorkshopById(this.workshopId);

      if (workshop && workshop.status !== 'en cours') {
        await this.workshopService.updateWorkshop(this.workshopId, {
          status: 'en cours'
        });
        this.statusUpdated = true;
        console.log('✅ Workshop status mis à jour: en cours');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
    }
  }

  private initJitsi(roomName: string, user: any): void {
    const domain = 'meet.jit.si';
    const options = {
      roomName: roomName,
      parentNode: document.getElementById('jitsi-container'),
      userInfo: {
        displayName: user.displayName || user.email,
        email: user.email
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        startWithAudioMuted: true,
        startWithVideoMuted: true
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'chat', 'raisehand',
          'tileview', 'fullscreen', 'hangup'
        ]
      }
    };

    this.api = new JitsiMeetExternalAPI(domain, options);

    this.api.addEventListener('videoConferenceJoined', () => {
      console.log('🎥 Conférence Jitsi démarrée');
    });

    this.api.addEventListener('readyToClose', () => {
      this.handleConferenceEnd();
    });

    this.api.addEventListener('videoConferenceLeft', () => {
      this.handleConferenceEnd();
    });
  }

  private async handleConferenceEnd(): Promise<void> {
    // Sauvegarder les notes avant de quitter
    if (this.meetingNotes) {
      await this.saveNotes(true);
    }
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.router.navigate(['/workshops']);
  }

  ngOnDestroy(): void {
    if (this.meetingNotes) {
      this.saveNotes(false);
    }
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.api?.dispose();
  }
}
