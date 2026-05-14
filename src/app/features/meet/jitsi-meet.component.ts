// jitsi-meet.component.ts - Version améliorée

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { WorkshopService } from '../../core/services/workshop.service';

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

  private api: any = null;
  private workshopId: string | null = null;

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
      this.router.navigate(['/workshops']);
      return;
    }

    // Extraire le nom de la salle depuis l'URL Jitsi
    const urlParts = workshop.meetLink.split('/');
    const roomName = urlParts[urlParts.length - 1];

    // Charger le SDK Jitsi
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.onload = () => this.initJitsi(roomName, user);
    document.head.appendChild(script);
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

    this.api.addEventListener('readyToClose', () => {
      this.router.navigate(['/workshops']);
    });

    this.api.addEventListener('videoConferenceLeft', () => {
      this.router.navigate(['/workshops']);
    });
  }

  ngOnDestroy(): void {
    this.api?.dispose();
  }
}
