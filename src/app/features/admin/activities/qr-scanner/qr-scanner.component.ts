/**
 * QrScannerComponent
 *
 * Scanner QR de check-in pour l'admin.
 * Utilise html5-qrcode pour lire la caméra en temps réel.
 *
 * Installation :
 *   npm install html5-qrcode
 */

import {
  Component, inject, signal, OnDestroy,
  ElementRef, ViewChild, AfterViewInit, Input, Output, EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityService } from '../../../../core/services/activity.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ActivityRegistration } from '../../../../core/model/activity.model';

// Import typé pour html5-qrcode
type Html5QrcodeScanner = import('html5-qrcode').Html5QrcodeScanner;
type QrcodeSuccessCallback = import('html5-qrcode').QrcodeSuccessCallback;

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scanner-wrap">

      <!-- ── Contrôles ──────────────────────────────────────── -->
      <div class="scanner-controls">
        @if (!scanning()) {
          <button class="btn btn--primary" (click)="startScanner()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="4" height="4"/>
            </svg>
            Démarrer le scanner
          </button>
        } @else {
          <button class="btn btn--ghost" (click)="stopScanner()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
            Arrêter
          </button>
        }
      </div>

      <!-- ── Viewfinder ─────────────────────────────────────── -->
      <div class="scanner-viewfinder" [class.active]="scanning()">
        <div id="qr-scanner-reader" #readerEl></div>
        @if (!scanning()) {
          <div class="scanner-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="4" height="4"/>
            </svg>
            <p>Cliquez sur "Démarrer" pour activer la caméra</p>
          </div>
        }
        @if (scanning()) {
          <div class="scanner-overlay">
            <div class="scanner-frame">
              <div class="corner corner--tl"></div>
              <div class="corner corner--tr"></div>
              <div class="corner corner--bl"></div>
              <div class="corner corner--br"></div>
              <div class="scan-line"></div>
            </div>
          </div>
        }
      </div>

      <!-- ── Dernier scan ────────────────────────────────────── -->
      @if (lastResult()) {
        <div class="scan-result" [class.scan-result--success]="lastResult()!.success"
                                 [class.scan-result--error]="!lastResult()!.success">
          <div class="scan-result__icon">
            @if (lastResult()!.success) {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            } @else {
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            }
          </div>
          <div class="scan-result__info">
            <div class="scan-result__name">{{ lastResult()!.name }}</div>
            <div class="scan-result__msg">{{ lastResult()!.message }}</div>
          </div>
          @if (lastResult()!.checkedInAt) {
            <div class="scan-result__time">
              {{ lastResult()!.checkedInAt | date:'HH:mm:ss' }}
            </div>
          }
        </div>
      }

      <!-- ── Mode manuel (fallback sans caméra) ─────────────── -->
      @if (showManual()) {
        <div class="manual-checkin">
          <div class="manual-checkin__header">
            <span>Check-in manuel</span>
            <button class="btn-text" (click)="showManual.set(false)">Masquer</button>
          </div>
          <div class="manual-checkin__body">
            <input
              type="text"
              class="form-input"
              placeholder="ID d'inscription..."
              #manualInput
            />
            <button class="btn btn--primary btn--sm"
              (click)="checkInManual(manualInput.value); manualInput.value = ''">
              Valider
            </button>
          </div>
        </div>
      } @else {
        <button class="btn-text btn-text--muted" (click)="showManual.set(true)">
          Pas de caméra ? Check-in manuel
        </button>
      }

    </div>
  `,
  styles: [`
    .scanner-wrap {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .scanner-controls {
      display: flex;
      justify-content: center;
    }

    .scanner-viewfinder {
      position: relative;
      background: #0f172a;
      border-radius: var(--radius-xl);
      overflow: hidden;
      min-height: 280px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-default);

      &.active { border-color: var(--accent-primary); }

      // Override les styles injectés par html5-qrcode
      ::ng-deep #qr-scanner-reader {
        width: 100% !important;
        border: none !important;

        video { width: 100% !important; border-radius: 0 !important; }
        img   { display: none; }

        #qr-shaded-region { border: none !important; box-shadow: none !important; }
      }
    }

    .scanner-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem;
      color: #475569;
      text-align: center;

      svg { opacity: .35; }
      p   { font-size: .875rem; margin: 0; }
    }

    .scanner-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .scanner-frame {
      position: relative;
      width: 200px;
      height: 200px;
    }

    .corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: #3b82f6;
      border-style: solid;

      &--tl { top: 0;    left: 0;  border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
      &--tr { top: 0;    right: 0; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
      &--bl { bottom: 0; left: 0;  border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
      &--br { bottom: 0; right: 0; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }
    }

    .scan-line {
      position: absolute;
      left: 4px; right: 4px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #3b82f6, transparent);
      animation: scan-move 2s ease-in-out infinite;
      top: 0;
    }

    @keyframes scan-move {
      0%   { top: 4px; }
      50%  { top: calc(100% - 6px); }
      100% { top: 4px; }
    }

    // ── Résultat scan ────────────────────────────────────
    .scan-result {
      display: flex;
      align-items: center;
      gap: .875rem;
      padding: 1rem 1.25rem;
      border-radius: var(--radius-lg);
      border: 1px solid;
      animation: slide-in .2s ease-out;

      &--success { background: rgba(34,197,94,.08);  border-color: rgba(34,197,94,.3); }
      &--error   { background: rgba(239,68,68,.08);  border-color: rgba(239,68,68,.3); }

      &__icon {
        width: 36px; height: 36px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }

      &--success &__icon { background: rgba(34,197,94,.15); color: #22c55e; }
      &--error   &__icon { background: rgba(239,68,68,.15); color: #f87171; }

      &__info { flex: 1; }
      &__name { font-size: .9375rem; font-weight: 600; color: var(--text-primary); }
      &__msg  { font-size: .8125rem; color: var(--text-secondary); margin-top: .125rem; }
      &__time { font-size: .875rem; color: var(--text-secondary); font-family: var(--font-mono); flex-shrink: 0; }
    }

    // ── Check-in manuel ───────────────────────────────────
    .manual-checkin {
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: .875rem 1rem;

      &__header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: .625rem;
        font-size: .875rem; font-weight: 500; color: var(--text-secondary);
      }

      &__body { display: flex; gap: .625rem; }
    }

    .form-input {
      flex: 1;
      background: var(--bg-input);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: .4rem .75rem;
      color: var(--text-primary);
      font-size: .875rem;
      &:focus { outline: none; border-color: var(--accent-primary); }
    }

    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: .5rem; padding: .5rem 1.125rem;
      border-radius: var(--radius-md); font-size: .875rem; font-weight: 500;
      cursor: pointer; transition: all .15s; border: none;

      &--primary { background: var(--accent-primary); color: #fff; &:hover { filter: brightness(1.1); } }
      &--ghost   { background: transparent; color: var(--text-secondary); border: 1px solid var(--border-default); &:hover { border-color: var(--accent-primary); } }
      &--sm      { padding: .375rem .875rem; font-size: .8125rem; }
    }

    .btn-text {
      background: transparent; border: none; color: var(--accent-primary);
      font-size: .8125rem; cursor: pointer; text-decoration: underline;
      &--muted { color: var(--text-tertiary); text-decoration: none; text-align: center; width: 100%; }
    }

    @keyframes slide-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  `]
})
export class QrScannerComponent implements OnDestroy {
  @Input() activityId!: string;
  @Output() checkedIn = new EventEmitter<ActivityRegistration>();

  private activityService = inject(ActivityService);
  private toast           = inject(ToastService);

  scanning    = signal(false);
  showManual  = signal(false);
  lastResult  = signal<{
    success: boolean;
    name: string;
    message: string;
    checkedInAt?: Date;
  } | null>(null);

  private scannerInstance: Html5QrcodeScanner | null = null;
  private lastScannedToken = '';
  private cooldownMs = 3000; // éviter les double-scans

  // ── Démarrer ──────────────────────────────────────────────

  async startScanner(): Promise<void> {
    const { Html5QrcodeScanner } = await import('html5-qrcode');

    this.scannerInstance = new Html5QrcodeScanner(
      'qr-scanner-reader',
      {
        fps:          10,
        qrbox:        { width: 200, height: 200 },
        aspectRatio:  1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported:  true,
      },
      false // verbose
    );

    const onSuccess: QrcodeSuccessCallback = async (decodedText) => {
      await this.handleScan(decodedText);
    };

    const onError = () => { /* silencieux */ };

    this.scannerInstance.render(onSuccess, onError);
    this.scanning.set(true);
  }

  // ── Arrêter ───────────────────────────────────────────────

  async stopScanner(): Promise<void> {
    if (this.scannerInstance) {
      try {
        await this.scannerInstance.clear();
      } catch {
        // ignore cleanup errors
      }
      this.scannerInstance = null;
    }
    this.scanning.set(false);
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  // ── Traitement du QR scanné ───────────────────────────────

  private async handleScan(rawText: string): Promise<void> {
    // Anti-double-scan
    if (rawText === this.lastScannedToken) return;
    this.lastScannedToken = rawText;
    setTimeout(() => { this.lastScannedToken = ''; }, this.cooldownMs);

    // Tenter de parser le token
    let registrationId: string | null = null;

    try {
      // Format attendu : JSON { registrationId, activityId, ... }
      const parsed = JSON.parse(rawText);
      registrationId = parsed.registrationId ?? parsed.id ?? null;
    } catch {
      // Format simple : juste l'ID d'inscription
      registrationId = rawText.trim();
    }

    if (!registrationId) {
      this.lastResult.set({
        success: false,
        name:    'QR invalide',
        message: 'Ce QR code n\'est pas reconnu',
      });
      return;
    }

    await this.processCheckIn(registrationId);
  }

  private async processCheckIn(registrationId: string): Promise<void> {
    try {
      await this.activityService.checkInGuest(registrationId);

      const now = new Date();
      this.lastResult.set({
        success:     true,
        name:        'Présence confirmée',
        message:     `ID : ${registrationId.slice(0, 12)}...`,
        checkedInAt: now,
      });

      this.toast.success('✓ Check-in validé');

    } catch (e: any) {
      const isAlready = e?.message?.includes('Déjà');
      this.lastResult.set({
        success: false,
        name:    isAlready ? 'Déjà checké' : 'Erreur check-in',
        message: e?.message ?? 'Impossible de valider la présence',
      });

      if (!isAlready) this.toast.error(e?.message ?? 'Erreur check-in');
    }
  }

  // ── Check-in manuel (fallback) ────────────────────────────

  async checkInManual(value: string): Promise<void> {
    if (!value.trim()) return;
    await this.processCheckIn(value.trim());
  }
}
