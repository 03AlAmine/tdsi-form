// core/services/devtools-protection.service.ts
// ─────────────────────────────────────────────────────────────────────
// Protection anti-inspection en production.
// Bloque :
//   • F12, Ctrl+Shift+I/J/C/U, Cmd+Opt+I/J (Mac)
//   • Clic droit (menu contextuel)
//   • Détection DevTools ouverts (dimension trick, desktop uniquement)
//   • console.* remis à vide (log, warn, info, debug, table, dir…)
//   • Sélection de texte désactivée (anti-copie source)
//
// Actif UNIQUEMENT si environment.production === true.
// En dev : zéro effet, tout reste normal.
//
// CORRECTIF (vs version précédente) :
//   Le hack "checkTiming" (régex.toString() passée à console.log pour
//   détecter un panneau DevTools ouvert) a été supprimé. Sur de
//   nombreux navigateurs/versions, le toString() est évalué même sans
//   DevTools ouverts → faux positif permanent → le shield s'affichait
//   et se masquait en boucle, bloquant toute navigation en prod.
//   La détection par dimension est conservée mais :
//     - désactivée sur mobile/tactile (la barre d'adresse qui se
//       replie/déplie fausse complètement le calcul innerHeight)
//     - exige plusieurs ticks consécutifs avant d'afficher le shield,
//       pour ignorer les variations transitoires de taille de fenêtre
//
// NOTE : pas de implements OnDestroy — les services providedIn:'root'
// ne sont jamais détruits pendant la vie de l'app. Le cleanup()
// est exposé publiquement pour être appelé si besoin.
// ─────────────────────────────────────────────────────────────────────

import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DevtoolsProtectionService {

  private readonly isProd = environment.production;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Seuil en pixels. Volontairement plus large que 160 pour absorber
  // les barres d'outils / extensions qui réduisent innerWidth.
  private readonly THRESHOLD = 220;

  // Nombre de ticks consécutifs positifs requis avant d'afficher le
  // shield. Évite qu'un simple redimensionnement ponctuel déclenche
  // un faux positif.
  private readonly REQUIRED_CONSECUTIVE_HITS = 3;
  private consecutiveHits = 0;

  private devtoolsCheckInterval: ReturnType<typeof setInterval> | null = null;
  private boundKeydown!:      (e: KeyboardEvent) => void;
  private boundContextmenu!:  (e: MouseEvent)    => void;
  private boundSelectstart!:  (e: Event)         => void;

  // ── Point d'entrée (appelé depuis AppComponent.ngOnInit) ─────────
  init(): void {
    // ✅ SSR-safe : jamais exécuté pendant le prerender (pas de window).
    if (!this.isBrowser) return;
    if (!this.isProd) return;

    this.silenceConsole();
    this.blockKeyboardShortcuts();
    this.blockContextMenu();
    this.disableTextSelection();

    // La détection par dimension n'a aucun sens fiable sur mobile/
    // tactile (clavier virtuel, barre d'adresse qui se replie...).
    // On ne l'active que sur desktop.
    if (!this.isMobileOrTouch()) {
      this.detectDevTools();
    }
  }

  private isMobileOrTouch(): boolean {
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return Boolean(coarsePointer || mobileUA);
  }

  // ── 1. Silencer console.* ────────────────────────────────────────
  private silenceConsole(): void {
    const noop = (): void => { /* noop prod */ };
    const methods: (keyof Console)[] = [
      'log', 'warn', 'info', 'debug', 'table',
      'dir', 'dirxml', 'group', 'groupEnd',
      'groupCollapsed', 'time', 'timeEnd',
      'count', 'assert', 'clear', 'trace',
    ];
    methods.forEach(m => {
      try { (console as any)[m] = noop; } catch { /* non-configurable */ }
    });
    // console.error intentionnellement préservé → Sentry / monitoring
  }

  // ── 2. Bloquer raccourcis clavier ────────────────────────────────
  private blockKeyboardShortcuts(): void {
    this.boundKeydown = (e: KeyboardEvent): void => {
      const key   = e.key?.toUpperCase();
      const ctrl  = e.ctrlKey || e.metaKey; // metaKey = Cmd Mac
      const shift = e.shiftKey;
      const alt   = e.altKey;

      const blocked =
        key === 'F12'                        ||  // F12 universel
        (ctrl && shift && key === 'I')       ||  // Ctrl+Shift+I
        (ctrl && shift && key === 'J')       ||  // Ctrl+Shift+J (Console)
        (ctrl && shift && key === 'C')       ||  // Ctrl+Shift+C (Inspector)
        (ctrl && shift && key === 'K')       ||  // Firefox Console
        (ctrl && !shift && !alt && key === 'U') || // Ctrl+U (source)
        (ctrl && !shift && !alt && key === 'S') || // Ctrl+S (save)
        (ctrl && !shift && !alt && key === 'P') || // Ctrl+P (print)
        (ctrl && alt && key === 'I')         ||  // Cmd+Opt+I (Mac)
        (ctrl && alt && key === 'J')         ||  // Cmd+Opt+J (Mac)
        (ctrl && alt && key === 'C');            // Cmd+Opt+C (Mac)

      if (blocked) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    document.addEventListener('keydown', this.boundKeydown, true);
  }

  // ── 3. Bloquer clic droit ────────────────────────────────────────
  private blockContextMenu(): void {
    this.boundContextmenu = (e: MouseEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener('contextmenu', this.boundContextmenu, true);
  }

  // ── 4. Désactiver sélection texte ────────────────────────────────
  private disableTextSelection(): void {
    this.boundSelectstart = (e: Event): void => { e.preventDefault(); };
    document.addEventListener('selectstart', this.boundSelectstart, true);

    // CSS injecté dynamiquement — n'impacte pas styles.scss
    if (!document.getElementById('tdsi-no-select')) {
      const style = document.createElement('style');
      style.id = 'tdsi-no-select';
      style.textContent = [
        '* { -webkit-user-select:none!important;',
        '    -moz-user-select:none!important;',
        '    user-select:none!important; }',
        'input,textarea,[contenteditable="true"] {',
        '  -webkit-user-select:text!important;',
        '  user-select:text!important; }',
      ].join('');
      document.head.appendChild(style);
    }
  }

  // ── 5. Détecter DevTools ouverts (desktop uniquement) ────────────
  private detectDevTools(): void {
    const checkDimensions = (): boolean =>
      (window.outerWidth  - window.innerWidth)  > this.THRESHOLD ||
      (window.outerHeight - window.innerHeight) > this.THRESHOLD;

    this.devtoolsCheckInterval = setInterval(() => {
      if (checkDimensions()) {
        this.consecutiveHits++;
        if (this.consecutiveHits >= this.REQUIRED_CONSECUTIVE_HITS) {
          this.showShield();
        }
      } else {
        this.consecutiveHits = 0;
        this.hideShield();
      }
    }, 1500);
  }

  // ── 6. Overlay de blocage ─────────────────────────────────────────
  private showShield(): void {
    if (document.getElementById('tdsi-shield')) return;

    const shield = document.createElement('div');
    shield.id = 'tdsi-shield';
    Object.assign(shield.style, {
      position:       'fixed',
      inset:          '0',
      zIndex:         '999999',
      background:     '#0a0e1a',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '1rem',
      fontFamily:     'monospace',
      color:          '#00d4ff',
    });
    shield.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <path d="M24 4L6 14V26C6 35.3 14 43.7 24 46C34 43.7 42 35.3 42 26V14L24 4Z"
              stroke="#00d4ff" stroke-width="2" stroke-linejoin="round"/>
        <path d="M17 24L22 29L31 19" stroke="#00d4ff" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <p style="font-size:1rem;letter-spacing:.1em;margin:0">ACCÈS RESTREINT</p>
      <p style="font-size:.72rem;color:#475569;letter-spacing:.05em;margin:0">
        L'inspection est désactivée sur cette plateforme.
      </p>`;
    document.body.appendChild(shield);
  }

  private hideShield(): void {
    document.getElementById('tdsi-shield')?.remove();
  }

  // ── Cleanup (optionnel — appelable manuellement si besoin) ────────
  cleanup(): void {
    if (this.boundKeydown)
      document.removeEventListener('keydown', this.boundKeydown, true);
    if (this.boundContextmenu)
      document.removeEventListener('contextmenu', this.boundContextmenu, true);
    if (this.boundSelectstart)
      document.removeEventListener('selectstart', this.boundSelectstart, true);
    if (this.devtoolsCheckInterval)
      clearInterval(this.devtoolsCheckInterval);
    document.getElementById('tdsi-no-select')?.remove();
    document.getElementById('tdsi-shield')?.remove();
  }
}
