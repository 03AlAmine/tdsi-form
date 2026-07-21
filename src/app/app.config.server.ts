// app.config.server.ts
// ─────────────────────────────────────────────────────────────────────
// Configuration de l'app pendant le PRERENDERING (build time).
// Fusionne la config navigateur (app.config.ts) avec le rendu serveur.
// Aucun serveur Node en production : le résultat est 100% statique,
// compatible Firebase Hosting plan Spark.
// ─────────────────────────────────────────────────────────────────────

import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    // Les animations (@angular/animations, utilisées par la navbar)
    // sont désactivées au prerender — elles rejouent côté client.
    provideNoopAnimations(),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
