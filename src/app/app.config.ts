import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter, withPreloading, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { loadingInterceptor } from './core/interceptor/loading.interceptor';
import { SelectivePreloadStrategy } from './core/strategy/selective-preload.strategy';

import { routes } from './app.routes';

// ✅ Locale française : sans cet enregistrement, tous les pipes `date`
// de l'app rendaient les dates en anglais ("Monday 12 March"). Avec
// LOCALE_ID: 'fr', toutes les dates (listings, drawers, admin, pages
// détail) s'affichent en français sans toucher aux templates.
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'fr' },
    // ✅ Préchargement sélectif : seules les routes marquées
    // `data: { preload: true }` (thematiques, workshops) sont
    // téléchargées en arrière-plan après le chargement initial.
    // Le bundle admin et les pages membre peu fréquentes restent
    // en lazy-load pur (chargées uniquement à la navigation), donc
    // les visiteurs anonymes et les membres standard ne téléchargent
    // jamais le code admin. Voir core/strategy/selective-preload.strategy.ts.
    // ✅ View Transitions API : transitions de page natives et fluides
    // (fondu croisé par défaut). Ignoré proprement par les navigateurs
    // qui ne supportent pas l'API et par prefers-reduced-motion.
    provideRouter(
      routes,
      withPreloading(SelectivePreloadStrategy),
      withViewTransitions(),
    ),
    provideHttpClient(withInterceptors([loadingInterceptor]))
  ]
};
