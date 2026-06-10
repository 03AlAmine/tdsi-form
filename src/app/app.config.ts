import { ApplicationConfig } from '@angular/core';
import { provideRouter, NoPreloading, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { loadingInterceptor } from './core/interceptor/loading.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // NoPreloading : les lazy modules ne sont chargés qu'à la navigation.
    // Les utilisateurs standard (membres) ne téléchargent jamais le bundle admin.
    // Si tu veux pré-charger uniquement certaines routes critiques (ex: workshops),
    // remplace NoPreloading par une stratégie personnalisée (voir commentaire bas de fichier).
    provideRouter(routes, withPreloading(NoPreloading)),
    provideHttpClient(withInterceptors([loadingInterceptor]))
  ]
};

/*
 * Stratégie de préchargement sélectif (optionnel, pour plus tard) :
 *
 * import { PreloadingStrategy, Route } from '@angular/router';
 * import { Observable, of } from 'rxjs';
 *
 * export class SelectivePreload implements PreloadingStrategy {
 *   preload(route: Route, load: () => Observable<any>): Observable<any> {
 *     return route.data?.['preload'] ? load() : of(null);
 *   }
 * }
 *
 * Puis dans les routes : { path: 'workshops', data: { preload: true }, loadComponent: ... }
 * Et ici : withPreloading(SelectivePreload)
 */
