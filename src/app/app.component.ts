// app.component.ts
import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet, NavigationStart, NavigationEnd } from '@angular/router';
import { ToastComponent } from './features/shared/components/toast/toast.component';
import { GlobalLoaderComponent } from './features/shared/components/global-loader/global-loader.component';
import { CommandPaletteComponent } from './features/shared/components/command-palette/command-palette.component';
import { CustomCursorComponent } from './features/shared/components/custom-cursor/custom-cursor.component';
import { MobileBlurService } from './core/services/mobile-blur.service';
import { DevtoolsProtectionService } from './core/services/devtools-protection.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, GlobalLoaderComponent, CommandPaletteComponent, CustomCursorComponent],
  template: `
    <router-outlet />
    <app-toast />
    <app-global-loader />
    <app-command-palette />
    <app-custom-cursor />
  `,
})
export class AppComponent implements OnInit {
  private readonly mobileBlur  = inject(MobileBlurService);
  private readonly devtools    = inject(DevtoolsProtectionService);
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly isBrowser   = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
  //  this.devtools.init();
    if (this.isBrowser) this.signalAppReadyOnceStable();
  }

  // ─────────────────────────────────────────────────────────────
  // Prévient l'écran de boot (index.html) que l'état d'authentification
  // est résolu ET que la navigation s'est stabilisée — pour qu'il puisse
  // révéler l'app sans flash (voir le bloc "déjà booté" dans index.html,
  // qui attend l'événement 'tdsi:app-ready' au lieu de révéler l'app
  // instantanément après un rechargement).
  //
  // Un rechargement sur une page protégée est d'abord rendu côté serveur
  // comme "non connecté" (voir AuthService, section SSR-safe) → guard
  // redirige vers /connexion dans le HTML envoyé au navigateur. Une fois
  // l'hydratation faite et Firebase Auth réellement résolu, AuthService
  // se corrige tout seul et renavigue vers la bonne page (voir
  // onAuthStateChanged / isInitialCheck). On attend cette éventuelle
  // seconde navigation avant de révéler quoi que ce soit, sinon on
  // laisserait transparaître le flash qu'on cherche justement à masquer.
  // ─────────────────────────────────────────────────────────────
  private signalAppReadyOnceStable(): void {
    this.authService.waitForAuthReady().subscribe(() => {
      let redirecting = false;
      let settled = false;

      const sub = this.router.events.subscribe((event) => {
        if (event instanceof NavigationStart) redirecting = true;
        if (event instanceof NavigationEnd && redirecting && !settled) {
          settled = true;
          sub.unsubscribe();
          this.dispatchAppReady();
        }
      });

      // Filet de sécurité : si aucune navigation supplémentaire ne se
      // déclenche (cas normal, pas de redirection nécessaire), on révèle
      // après une courte fenêtre d'observation plutôt que d'attendre
      // indéfiniment un événement qui ne viendra pas.
      setTimeout(() => {
        if (!settled) {
          settled = true;
          sub.unsubscribe();
          this.dispatchAppReady();
        }
      }, 350);
    });
  }

  private dispatchAppReady(): void {
    window.dispatchEvent(new Event('tdsi:app-ready'));
  }
}
