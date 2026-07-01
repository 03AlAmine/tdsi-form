// core/strategy/selective-preload.strategy.ts
import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

// ─────────────────────────────────────────────────────────────
// Précharge en arrière-plan uniquement les routes marquées
// `data: { preload: true }` dans app.routes.ts, une fois le bundle
// initial chargé et le navigateur inactif (idle).
//
// Pourquoi pas NoPreloading : les modules ne se chargent qu'à la
// navigation, donc même un clic sur "Thématiques" ou "Workshops"
// — les deux pages publiques les plus visitées — attend le
// téléchargement du chunk avant de s'afficher.
//
// Pourquoi pas PreloadAllModules : ça téléchargerait aussi le
// bundle admin (dashboard, gestion utilisateurs, analytics...)
// pour 100% des visiteurs anonymes et membres, qui ne l'utiliseront
// jamais. Inutile et coûteux en données mobiles.
//
// Cette stratégie ne précharge que ce qui est explicitement
// marqué, donc le bundle admin reste exclu par défaut.
// ─────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class SelectivePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data?.['preload']) {
      return of(null);
    }

    // requestIdleCallback : on attend que le navigateur soit inactif avant de
    // télécharger le chunk, pour ne jamais entrer en concurrence avec le
    // rendu de la page courante. Fallback setTimeout si l'API n'existe pas
    // (anciens navigateurs / Safari).
    return new Observable((subscriber) => {
      const start = () => {
        load().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      };

      if (typeof (window as any).requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(start, { timeout: 3000 });
      } else {
        setTimeout(start, 200);
      }
    });
  }
}
