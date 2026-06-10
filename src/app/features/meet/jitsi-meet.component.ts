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
  template: `
    <div class="meet-container">
      <!-- Bouton flottant pour ouvrir le bloc-notes -->
      <button class="floating-notes-btn" (click)="toggleNotes()" [class.active]="showNotes">
        <i class="fas fa-pen-fancy"></i>
        <span class="btn-label">Notes</span>
      </button>

      <!-- Panneau du bloc-notes -->
      @if (showNotes) {
        <div class="notes-panel" [class.minimized]="isMinimized">
          <div class="notes-header">
            <div class="notes-header-left">
              <i class="fas fa-pen-fancy"></i>
              <h3>Bloc-notes</h3>
              <span class="workshop-badge">{{ workshopTitle }}</span>
            </div>
            <div class="notes-header-actions">
              <button (click)="minimizeNotes()" class="header-btn" title="Réduire">
                <i class="fas fa-window-minimize"></i>
              </button>
              <button (click)="toggleNotes()" class="header-btn" title="Fermer">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          @if (!isMinimized) {
            <div class="notes-body">
              <textarea
                [(ngModel)]="meetingNotes"
                placeholder="✍️ Prenez vos notes pendant le workshop...

• Points clés à retenir
• Questions à poser aux intervenants
• Idées à explorer plus tard
• Liens et ressources partagés"
                class="notes-textarea"
                (keydown)="autoSaveNotes()"
              ></textarea>

              <div class="notes-toolbar">
                <div class="note-stats">
                  <span><i class="fas fa-keyboard"></i> {{ meetingNotes.length }} caractères</span>
                  <span><i class="fas fa-paragraph"></i> {{ wordCount() }} mots</span>
                </div>
                <div class="toolbar-actions">
                  <button (click)="clearNotes()" class="clear-btn" title="Effacer tout">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                  <button (click)="copyNotes()" class="copy-btn" title="Copier">
                    <i class="fas fa-copy"></i>
                  </button>
                  <button (click)="saveNotes()" class="save-notes-btn" [disabled]="isSaving">
                    @if (isSaving) {
                      <div class="btn-spinner"></div>
                    } @else {
                      <i class="fas fa-save"></i>
                    }
                    <span>{{ isSaving ? 'Sauvegarde...' : 'Sauvegarder' }}</span>
                  </button>
                </div>
              </div>
            </div>
          }

          @if (isMinimized) {
            <div class="notes-minimized-preview" (click)="restoreNotes()">
              <i class="fas fa-pen-fancy"></i>
              <span class="preview-text">{{ meetingNotes.slice(0, 60) || 'Cliquez pour écrire vos notes...' }}</span>
              <i class="fas fa-chevron-up expand-icon"></i>
            </div>
          }
        </div>
      }

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

    /* ============================================================
       BOUTON FLOTTANT PRINCIPAL
       ============================================================ */
    .floating-notes-btn {
      position: absolute;
      bottom: 80px;
      right: 20px;
      z-index: 1001;
      background: linear-gradient(135deg, #00d4ff, #0a0e27);
      border: 1px solid rgba(0, 212, 255, 0.4);
      border-radius: 50px;
      padding: 10px 20px;
      color: white;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);

      i {
        font-size: 16px;
      }

      .btn-label {
        @media (max-width: 640px) {
          display: none;
        }
      }

      &:hover {
        transform: translateY(-3px) scale(1.05);
        box-shadow: 0 8px 30px rgba(0, 212, 255, 0.5);
        border-color: rgba(0, 212, 255, 0.8);
      }

      &.active {
        background: linear-gradient(135deg, #ef4444, #0a0e27);
        box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);

        &:hover {
          box-shadow: 0 8px 30px rgba(239, 68, 68, 0.5);
        }
      }
    }

    /* ============================================================
       PANEL BLOC-NOTES
       ============================================================ */
    .notes-panel {
      position: absolute;
      top: 80px;
      right: 20px;
      width: 380px;
      background: linear-gradient(135deg, #0f1235cc, #0a0e27cc);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 212, 255, 0.25);
      border-radius: 20px;
      z-index: 1002;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 212, 255, 0.1) inset;
      transition: all 0.3s ease;
      animation: slideInRight 0.3s ease-out;

      &.minimized {
        width: auto;
        min-width: 280px;
      }

      .notes-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0, 212, 255, 0.15);
        background: rgba(0, 0, 0, 0.3);
        border-radius: 20px 20px 0 0;

        .notes-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;

          i {
            color: #00d4ff;
            font-size: 14px;
          }

          h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: white;
          }

          .workshop-badge {
            font-size: 10px;
            background: rgba(0, 212, 255, 0.15);
            padding: 2px 8px;
            border-radius: 12px;
            color: #00d4ff;
            font-family: monospace;
          }
        }

        .notes-header-actions {
          display: flex;
          gap: 8px;

          .header-btn {
            background: rgba(255, 255, 255, 0.05);
            border: none;
            color: #94a3b8;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 8px;
            transition: all 0.2s;
            font-size: 12px;

            &:hover {
              background: rgba(0, 212, 255, 0.15);
              color: #00d4ff;
            }
          }
        }
      }

      .notes-body {
        display: flex;
        flex-direction: column;
      }

      .notes-textarea {
        width: 100%;
        min-height: 320px;
        padding: 16px;
        background: rgba(0, 0, 0, 0.4);
        border: none;
        color: #e2e8f0;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        resize: vertical;
        line-height: 1.6;
        border-bottom: 1px solid rgba(0, 212, 255, 0.1);

        &:focus {
          outline: none;
          background: rgba(0, 0, 0, 0.5);
        }

        &::placeholder {
          color: #475569;
          font-style: italic;
        }
      }

      .notes-toolbar {
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .note-stats {
          display: flex;
          gap: 12px;
          font-size: 10px;
          color: #64748b;
          font-family: monospace;

          i {
            margin-right: 4px;
          }
        }

        .toolbar-actions {
          display: flex;
          gap: 8px;
        }

        .clear-btn, .copy-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 6px 10px;
          border-radius: 8px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            background: rgba(239, 68, 68, 0.15);
            border-color: #ef4444;
            color: #ef4444;
          }
        }

        .copy-btn:hover {
          background: rgba(0, 212, 255, 0.15);
          border-color: #00d4ff;
          color: #00d4ff;
        }

        .save-notes-btn {
          background: linear-gradient(135deg, #00d4ff, #0ea5e9);
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;

          &:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
          }

          &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-spinner {
            width: 12px;
            height: 12px;
            border: 2px solid white;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
          }
        }
      }
    }

    /* Mode minimisé */
    .notes-minimized-preview {
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.2s;

      i:first-child {
        color: #00d4ff;
        font-size: 12px;
      }

      .preview-text {
        flex: 1;
        font-size: 12px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-style: italic;
      }

      .expand-icon {
        font-size: 10px;
        color: #64748b;
      }

      &:hover {
        background: rgba(0, 212, 255, 0.05);
        .preview-text { color: white; }
      }
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .notes-panel {
        top: 70px;
        right: 10px;
        left: 10px;
        width: auto;
      }

      .floating-notes-btn {
        bottom: 70px;
        right: 10px;
        padding: 8px 12px;

        i {
          font-size: 14px;
        }
      }
    }

    @media (max-width: 480px) {
      .notes-panel {
        .notes-textarea {
          min-height: 240px;
        }

        .notes-toolbar {
          flex-direction: column;
          align-items: stretch;

          .toolbar-actions {
            justify-content: flex-end;
          }
        }
      }
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

    // Charger les notes existantes
    await this.loadNotes();

    if (!workshop?.meetLink) {
      console.error('Aucun lien de réunion trouvé');
      this.toastService.error('Lien de réunion non disponible');
      this.router.navigate(['/workshops']);
      return;
    }

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
