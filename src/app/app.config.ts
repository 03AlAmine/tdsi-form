import { ApplicationConfig } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { loadingInterceptor } from './core/interceptor/loading.interceptor';
import { SelectivePreloadStrategy } from './core/strategy/selective-preload.strategy';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // ✅ Préchargement sélectif : seules les routes marquées
    // `data: { preload: true }` (thematiques, workshops) sont
    // téléchargées en arrière-plan après le chargement initial.
    // Le bundle admin et les pages membre peu fréquentes restent
    // en lazy-load pur (chargées uniquement à la navigation), donc
    // les visiteurs anonymes et les membres standard ne téléchargent
    // jamais le code admin. Voir core/strategy/selective-preload.strategy.ts.
    provideRouter(routes, withPreloading(SelectivePreloadStrategy)),
    provideHttpClient(withInterceptors([loadingInterceptor]))
  ]
};
