import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────────────────────
// LoggerService — remplace tous les console.* dispersés.
// En production : seuls les .error() sont transmis.
// En développement : tout s'affiche normalement.
//
// Utilisation :
//   private logger = inject(LoggerService);
//   this.logger.log('[WorkshopService] chargé', workshops);
//   this.logger.error('[Auth] login échoué', err);
// ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly isProd = environment.production;

  /** Logs de debug — silencieux en prod */
  log(...args: unknown[]): void {
    if (!this.isProd) console.log(...args);
  }

  /** Avertissements — silencieux en prod */
  warn(...args: unknown[]): void {
    if (!this.isProd) console.warn(...args);
  }

  /** Infos — silencieux en prod */
  info(...args: unknown[]): void {
    if (!this.isProd) console.info(...args);
  }

  /** Erreurs — toujours transmises (monitoring prod) */
  error(...args: unknown[]): void {
    console.error(...args);
    // Ici tu peux brancher Sentry / Firebase Crashlytics :
    // if (this.isProd) Sentry.captureException(args[0]);
  }
}
