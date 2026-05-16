// jitsi-meet.component.ts - Version avec mise à jour du statut

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkshopService } from '../../core/services/workshop.service';
import { ToastService } from '../../core/services/toast.service';

declare var JitsiMeetExternalAPI: any;

@Component({
  selector: 'app-jitsi-meet',
  standalone: true,
  template: `
    <div class="meet-container">
      <div id="jitsi-container" style="height: 100vh; width: 100%;"></div>
    </div>
  `,
  styles: [`
    .meet-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      background: #000;
    }
  `]
})
export class JitsiMeetComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private workshopService = inject(WorkshopService);
  private toastService = inject(ToastService);

  private api: any = null;
  private workshopId: string | null = null;
  private statusUpdated = false; // ✅ Pour éviter les mises à jour multiples

  async ngOnInit(): Promise<void> {
    this.workshopId = this.route.snapshot.paramMap.get('id');
    const user = this.authService.currentUser;

    if (!user) {
      this.router.navigate(['/connexion']);
      return;
    }

    // Récupérer le workshop pour avoir le lien
    const workshop = await this.workshopService.getWorkshopById(this.workshopId!);

    if (!workshop?.meetLink) {
      console.error('Aucun lien de réunion trouvé');
      this.toastService.error('Lien de réunion non disponible');
      this.router.navigate(['/workshops']);
      return;
    }

    // ✅ Mettre à jour le statut du workshop à "en cours"
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

  // ✅ Méthode pour mettre à jour le statut du workshop
  private async updateWorkshopStatus(): Promise<void> {
    if (!this.workshopId || this.statusUpdated) return;

    try {
      const workshop = await this.workshopService.getWorkshopById(this.workshopId);

      // Ne mettre à jour que si le statut n'est pas déjà "en cours"
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
        displayName: user.displayName,
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

    // ✅ Événement quand la conférence est réellement chargée
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

  // ✅ Gérer la fin de la conférence
  private async handleConferenceEnd(): Promise<void> {
    // Optionnel : remettre le statut à "terminé" si vous le souhaitez
    // Ou laisser l'admin le faire manuellement
    this.router.navigate(['/workshops']);
  }

  ngOnDestroy(): void {
    this.api?.dispose();
  }
}
