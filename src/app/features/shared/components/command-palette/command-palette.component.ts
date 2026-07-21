// command-palette.component.ts
// ─────────────────────────────────────────────────────────────────────
// Palette de commandes façon Cmd+K (Linear, Vercel, Raycast...). Ouverte
// globalement depuis n'importe quelle page (montée une fois dans
// AppComponent), elle permet de naviguer et de rechercher parmi les
// thématiques/workshops sans quitter le clavier.
//
// Pas de lib externe (Fuse.js etc.) : un scoring "fuzzy" maison suffit
// largement pour le volume de données de ce club (quelques dizaines
// d'items), et ça évite une dépendance/bundle supplémentaire pour un
// gain marginal.
// ─────────────────────────────────────────────────────────────────────

import {
  Component,
  HostListener,
  inject,
  signal,
  computed,
  effect,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { ThemeService } from '../../../../core/services/theme.service';
import { WorkshopService } from '../../../../core/services/workshop.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CommandPaletteService } from '../../../../core/services/command-palette.service';
import { buildSlug } from '../../../../core/utils/slug.util';

type ResultKind = 'action' | 'theme' | 'workshop';

interface PaletteResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  score: number;
  run: () => void;
}

interface CachedTheme {
  id: string;
  title: string;
  category: string;
}

interface CachedWorkshop {
  id: string;
  title: string;
  date: Date;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.scss'],
})
export class CommandPaletteComponent {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly workshopService = inject(WorkshopService);
  private readonly authService = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly commandPaletteService = inject(CommandPaletteService);

  isOpen = signal(false);
  query = signal('');
  activeIndex = signal(0);

  private dataLoaded = false;
  private themesCache: CachedTheme[] = [];
  private workshopsCache: CachedWorkshop[] = [];
  private sub?: Subscription;

  isLoggedIn = () => this.authService.isLoggedIn;

  constructor() {
    // ✅ Ouverture externe (ex: bouton "⌘K" dans la navbar) — on ignore
    // volontairement la toute première exécution de l'effect (valeur
    // initiale du signal), sinon la palette s'ouvrirait au chargement
    // de l'app.
    let firstRun = true;
    effect(() => {
      this.commandPaletteService.openRequests();
      if (firstRun) {
        firstRun = false;
        return;
      }
      this.open();
    });
  }

  // ── Actions de navigation, dépendantes du rôle courant ──
  private actions = computed<PaletteResult[]>(() => {
    const list: PaletteResult[] = [
      {
        kind: 'action',
        id: 'nav-themes',
        title: 'Voir les thématiques',
        subtitle: 'Catalogue complet',
        icon: 'fa-layer-group',
        score: 0,
        run: () => this.navigate(['/thematiques']),
      },
      {
        kind: 'action',
        id: 'nav-workshops',
        title: 'Voir les workshops',
        subtitle: 'Sessions à venir',
        icon: 'fa-chalkboard-user',
        score: 0,
        run: () => this.navigate(['/workshops']),
      },
    ];

    if (this.isLoggedIn()) {
      list.push(
        {
          kind: 'action',
          id: 'nav-dashboard',
          title: 'Mon espace membre',
          subtitle: 'Tableau de bord',
          icon: 'fa-gauge',
          score: 0,
          run: () => this.navigate(['/espace-membre']),
        },
        {
          kind: 'action',
          id: 'nav-propose',
          title: 'Proposer une thématique',
          subtitle: 'Nouvelle idée de workshop',
          icon: 'fa-lightbulb',
          score: 0,
          run: () => this.navigate(['/espace-membre/proposer']),
        },
        {
          kind: 'action',
          id: 'nav-submissions',
          title: 'Mes soumissions',
          subtitle: 'Suivre mes propositions',
          icon: 'fa-file-lines',
          score: 0,
          run: () => this.navigate(['/espace-membre/mes-soumissions']),
        },
        {
          kind: 'action',
          id: 'nav-profile',
          title: 'Mon profil',
          subtitle: 'Paramètres du compte',
          icon: 'fa-user',
          score: 0,
          run: () => this.navigate(['/espace-membre/profil']),
        },
      );
    } else {
      list.push(
        {
          kind: 'action',
          id: 'nav-login',
          title: 'Se connecter',
          icon: 'fa-sign-in-alt',
          score: 0,
          run: () => this.navigate(['/connexion']),
        },
        {
          kind: 'action',
          id: 'nav-signup',
          title: 'Créer un compte',
          icon: 'fa-user-plus',
          score: 0,
          run: () => this.navigate(['/inscription']),
        },
      );
    }

    if (this.authService.isAdmin) {
      list.push({
        kind: 'action',
        id: 'nav-admin',
        title: 'Administration',
        subtitle: 'Tableau de bord admin',
        icon: 'fa-user-shield',
        score: 0,
        run: () => this.navigate(['/admin']),
      });
    }

    return list;
  });

  // ── Résultats affichés : actions seules si champ vide, sinon fusion
  //    actions + thématiques + workshops triée par score fuzzy ──
  results = computed<PaletteResult[]>(() => {
    const term = this.query().trim();
    const actions = this.actions();

    if (!term) return actions.slice(0, 6);

    const scored: PaletteResult[] = [];

    for (const a of actions) {
      const score = fuzzyScore(term, `${a.title} ${a.subtitle ?? ''}`);
      if (score > 0) scored.push({ ...a, score });
    }

    for (const t of this.themesCache) {
      const score = fuzzyScore(term, `${t.title} ${t.category}`);
      if (score > 0) {
        scored.push({
          kind: 'theme',
          id: t.id,
          title: t.title,
          subtitle: t.category,
          icon: 'fa-microchip',
          score,
          run: () => this.navigate(['/thematiques', buildSlug(t.title, t.id)]),
        });
      }
    }

    for (const w of this.workshopsCache) {
      const score = fuzzyScore(term, w.title);
      if (score > 0) {
        scored.push({
          kind: 'workshop',
          id: w.id,
          title: w.title,
          subtitle: formatDateShort(w.date),
          icon: 'fa-chalkboard-user',
          score,
          run: () => this.navigate(['/workshops', buildSlug(w.title, w.id)]),
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 8);
  });

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const isShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

    if (isShortcut) {
      event.preventDefault();
      this.toggle();
      return;
    }

    if (!this.isOpen()) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1);
        break;
      case 'Enter':
        event.preventDefault();
        this.selectActive();
        break;
    }
  }

  toggle(): void {
    this.isOpen() ? this.close() : this.open();
  }

  open(): void {
    if (!this.isBrowser) return;
    this.isOpen.set(true);
    this.query.set('');
    this.activeIndex.set(0);
    document.body.style.overflow = 'hidden';
    this.loadData();
    this.commandPaletteService.markOpened();
    setTimeout(() => {
      document.getElementById('command-palette-input')?.focus();
    });
  }

  close(): void {
    this.isOpen.set(false);
    if (this.isBrowser) document.body.style.overflow = '';
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  move(delta: number): void {
    const len = this.results().length;
    if (!len) return;
    this.activeIndex.set((this.activeIndex() + delta + len) % len);
  }

  selectActive(): void {
    this.results()[this.activeIndex()]?.run();
  }

  select(item: PaletteResult): void {
    item.run();
  }

  private navigate(commands: any[]): void {
    this.close();
    this.router.navigate(commands);
  }

  // Chargé une seule fois, à la première ouverture — pas besoin d'un
  // listener temps réel permanent pour une palette de recherche.
  private loadData(): void {
    if (this.dataLoaded) return;
    this.dataLoaded = true;
    this.sub = combineLatest([
      this.themeService.getThemes(),
      this.workshopService.getWorkshops(),
    ]).subscribe(([themes, workshops]) => {
      this.themesCache = themes
        .filter((t) => !!t.id)
        .map((t) => ({ id: t.id!, title: t.title, category: t.category }));
      this.workshopsCache = workshops
        .filter((w) => !!w.id)
        .map((w) => ({ id: w.id!, title: w.themeTitle, date: w.date }));
    });
  }
}

// ── Fuzzy scoring léger (sans dépendance externe) ───────────────────────
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function fuzzyScore(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);
  if (!q) return 0;

  // Sous-chaîne exacte : score fort, meilleur si elle apparaît tôt.
  const idx = t.indexOf(q);
  if (idx >= 0) return 100 - idx;

  // Sinon, correspondance de sous-séquence (lettres de q dans l'ordre
  // dans t, avec bonus pour les caractères consécutifs).
  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatch === ti - 1 ? 3 : 1;
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
