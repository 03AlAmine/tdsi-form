// core/services/app-settings.service.ts
import { Injectable } from '@angular/core';
import {
  doc, getDoc, setDoc, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { Observable, shareReplay, finalize } from 'rxjs';
import { db } from '../../../firebase.config';
import { AppSettings } from '../model/models';

// ─────────────────────────────────────────────────────────────
// Document Firestore unique : settings/app
// Réglages globaux configurables depuis /admin/configuration.
// Tant qu'aucun admin n'a encore sauvegardé, le document n'existe
// pas — DEFAULT_SETTINGS sert de repli pour que le reste de l'app
// (formulaires de création thème/atelier) continue de fonctionner
// normalement.
// ─────────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
  defaultThemeMaxParticipants: 30,
  defaultWorkshopDuration: 90,
  defaultWorkshopMaxParticipants: 30,
  defaultWorkshopLocation: 'en ligne',
  defaultWorkshopTime: '14:00',
  interestNotificationThreshold: 10,
  updatedAt: new Date(),
  updatedBy: '',
};

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private settings$: Observable<AppSettings> | null = null;

  // Lecture temps réel — un seul listener partagé entre tous les
  // composants qui s'abonnent (formulaire création atelier, page
  // configuration, etc.), comme pour ThemeService.getThemes().
  getSettings(): Observable<AppSettings> {
    if (!this.settings$) {
      this.settings$ = new Observable<AppSettings>((observer) => {
        const ref = doc(db, 'settings', 'app');
        const unsubscribe = onSnapshot(
          ref,
          (snap) => {
            if (!snap.exists()) {
              observer.next(DEFAULT_SETTINGS);
              return;
            }
            const d: any = snap.data();
            observer.next({
              ...DEFAULT_SETTINGS,
              ...d,
              updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
            } as AppSettings);
          },
          (err) => observer.error(err),
        );
        return () => unsubscribe();
      }).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => { this.settings$ = null; }),
      );
    }
    return this.settings$;
  }

  // Lecture ponctuelle (ex: pré-remplissage d'un formulaire à l'ouverture)
  async getSettingsOnce(): Promise<AppSettings> {
    const snap = await getDoc(doc(db, 'settings', 'app'));
    if (!snap.exists()) return DEFAULT_SETTINGS;
    const d: any = snap.data();
    return {
      ...DEFAULT_SETTINGS,
      ...d,
      updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
    };
  }

  async saveSettings(
    data: Omit<AppSettings, 'updatedAt' | 'updatedBy'>,
    adminUid: string,
  ): Promise<void> {
    await setDoc(doc(db, 'settings', 'app'), {
      ...data,
      updatedAt: Timestamp.fromDate(new Date()),
      updatedBy: adminUid,
    });
  }
}
