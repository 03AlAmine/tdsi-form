// thematiques.component.ts - Version complète et corrigée

import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  HostListener,
  ElementRef,
  ApplicationRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { combineLatest, Subscription, firstValueFrom } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { WorkshopService } from '../../core/services/workshop.service';
import { AuthService } from '../../core/services/auth.service';
import { AiService, ThemeRecommendation } from '../../core/services/ai.service';
import { EnrichmentService } from '../../core/services/enrichment.service';
import { SeoService } from '../../core/services/seo.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { TiltSpotlightDirective } from '../../core/directives/tilt-spotlight.directive';
import { RevealDirective } from '../../core/directives/reveal.directive';
import { Theme, ThemeCategory, Workshop } from '../../core/model/models';
import { buildSlug } from '../../core/utils/slug.util';
import {
  getWorkshopStatusClass as sharedWorkshopStatusClass,
  getWorkshopStatusIcon as sharedWorkshopStatusIcon,
  getLocationIcon as sharedLocationIcon,
  getLocationText as sharedLocationText,
  formatDuration as sharedFormatDuration,
  getEndTime as sharedGetEndTime,
} from '../../core/utils/workshop-display.util';

interface ThemeWithWorkshop extends Theme {
  linkedWorkshop?: Workshop;
}

interface RecommendedTheme extends ThemeWithWorkshop {
  aiScore: number;
  aiReason: string;
}

const CATEGORIES: ThemeCategory[] = [
  'Sécurité Réseau',
  'Cryptographie',
  'Transmission de Données',
  'Intelligence Artificielle',
  'Développement Web',
  'Cloud & DevOps',
  'Autre',
];

@Component({
  selector: 'app-thematiques',
  standalone: true,
  imports: [CommonModule, RouterLink, TiltSpotlightDirective, RevealDirective],
  templateUrl: './thematiques.component.html',
  styleUrls: ['./thematiques.component.scss'],
})
export class ThematiquesComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private seo = inject(SeoService);
  private enrichmentService = inject(EnrichmentService);
  private settingsService = inject(AppSettingsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);

  private sub!: Subscription;

  // ── View Transitions : morph card → détail ──────────────────────────
  // Id de la thématique en cours de transition. Tant qu'il correspond à
  // une card ET que le drawer est fermé, la card porte le nom de transition ;
  // dès que le drawer s'ouvre, c'est lui qui le porte à la place (voir les
  // bindings [style.view-transition-name] dans le template). Le navigateur
  // anime alors automatiquement position/taille entre les deux snapshots —
  // pas besoin de lib d'animation, la techno est déjà branchée via
  // withViewTransitions() dans app.config.ts.
  transitioningThemeId = signal<string | null>(null);

  private supportsViewTransitions(): boolean {
    return this.isBrowser && typeof (document as any).startViewTransition === 'function';
  }

  // ── Accessibilité : mémorise l'élément qui a ouvert un drawer pour lui
  // rendre le focus à la fermeture (sinon le focus clavier "tombe" sur le body).
  private lastFocusedTrigger: HTMLElement | null = null;

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.drawerOpen()) {
      this.closeDrawer();
    } else if (this.recommendationsDrawerOpen()) {
      this.closeRecommendationsDrawer();
    }
  }

  // Déplace le focus clavier sur le premier élément focusable du drawer
  // (ici le bouton de fermeture) une fois le rendu terminé.
  private focusDrawer(selector: string): void {
    if (!this.isBrowser) return;
    this.lastFocusedTrigger = document.activeElement as HTMLElement;
    setTimeout(() => {
      (this.host.nativeElement.querySelector(selector) as HTMLElement | null)?.focus();
    });
  }

  private returnFocusToTrigger(): void {
    if (!this.isBrowser) return;
    this.lastFocusedTrigger?.focus();
    this.lastFocusedTrigger = null;
  }

  // ── État principal ──
  themes = signal<ThemeWithWorkshop[]>([]);
  loading = signal(true);
  activeCategory = signal<ThemeCategory | null>(null);
  searchTerm = signal('');
  selectedTheme = signal<ThemeWithWorkshop | null>(null);
  drawerOpen = signal(false);
  categories = CATEGORIES;

  initComplete = signal(false);

  // ── Deep-linking des filtres (?categorie=...&q=...) ─────────────────
  // Permet de partager un lien déjà filtré et de revenir en arrière au
  // clavier/souris sans perdre le filtre en cours. Synchro à double
  // sens, gardée par `syncingFromUrl` pour éviter la boucle
  // URL → signal → URL → signal...
  private filtersInitialized = false;
  private syncingFromUrl = false;
  private filtersRouteSub?: Subscription;

  private readFiltersFromUrl(params: ParamMap): void {
    this.syncingFromUrl = true;
    const cat = params.get('categorie') as ThemeCategory | null;
    const q = params.get('q') ?? '';
    const validCat = cat && this.categories.includes(cat) ? cat : null;

    if (validCat !== this.activeCategory()) this.activeCategory.set(validCat);
    if (q !== this.searchTerm()) this.searchTerm.set(q);
    this.syncingFromUrl = false;
  }

  private writeFiltersToUrl(category: ThemeCategory | null, term: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { categorie: category || null, q: term || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // Effect en initialiseur de champ : tourne automatiquement dans le
  // contexte d'injection du composant, pas besoin d'Injector explicite.
  private readonly filtersUrlSync = effect(() => {
    const category = this.activeCategory();
    const term = this.searchTerm();
    if (!this.filtersInitialized || this.syncingFromUrl) return;
    this.writeFiltersToUrl(category, term);
  });

  // ── Recommandations IA (membres uniquement) ──
  recommendations = signal<RecommendedTheme[]>([]);
  recoLoading = signal(false);
  recoError = signal('');
  showRecommendations = signal(true);
  recommendationsDrawerOpen = signal(false);

  // ── Enrichissement IA drawer ──
  enrichedThemeData = signal<{
    objectives: string[];
    prerequisites: string[];
    materials: string[];
    skills: string[];
  } | null>(null);
  loadingEnriched = signal(false);

  /** True si l'utilisateur est connecté */
  isLoggedIn = () => this.authService.isLoggedIn;

  // ✅ Bouton "intéressé" — visible uniquement tant qu'aucun workshop
  // n'est encore lié à la thématique (voir toggleInterest ci-dessous).
  interestPending = signal<string | null>(null);

  isInterested(theme: ThemeWithWorkshop): boolean {
    const uid = this.authService.currentUser?.uid;
    return !!uid && !!theme.interested?.includes(uid);
  }

  // ✅ On n'affiche le nombre brut qu'à partir d'un seuil : "1 intéressé"
  // ou "2 intéressés" donne une impression négative pour une thématique
  // toute neuve. En dessous du seuil, un message encourageant neutre
  // remplace le chiffre — sans jamais afficher un nombre inventé.
  private static readonly INTEREST_DISPLAY_THRESHOLD = 3;

  showsInterestCount(theme: ThemeWithWorkshop): boolean {
    return (theme.interested?.length ?? 0) >= ThematiquesComponent.INTEREST_DISPLAY_THRESHOLD;
  }

  // ✅ Badge "🔥 forte demande" — réutilise le même seuil que la
  // notification admin (settings/app.interestNotificationThreshold,
  // configurable depuis /admin/configuration), pour rester cohérent :
  // dès qu'un admin est notifié qu'une thématique cartonne, les
  // visiteurs voient le même signal sur la card.
  private hotDemandThreshold = signal(10);
  private settingsSub?: Subscription;

  isHotDemand(theme: ThemeWithWorkshop | null | undefined): boolean {
    return !!theme && (theme.interested?.length ?? 0) >= this.hotDemandThreshold();
  }

  async toggleInterest(theme: ThemeWithWorkshop, event: Event): Promise<void> {
    event.stopPropagation(); // ne pas ouvrir le tiroir de détail
    const uid = this.authService.currentUser?.uid;
    if (!uid || !theme.id) return;

    const wasInterested = this.isInterested(theme);
    const previousList = theme.interested ?? [];
    const optimisticList = wasInterested
      ? previousList.filter((id) => id !== uid)
      : [...previousList, uid];

    // ✅ Mise à jour optimiste immédiate — évite d'attendre l'aller-retour
    // Firestore + le prochain snapshot pour voir le bouton changer d'état.
    // Le listener temps réel (onSnapshot) confirmera/corrigera ensuite.
    this.applyThemeUpdate(theme.id, { interested: optimisticList });

    this.interestPending.set(theme.id);
    try {
      await this.themeService.toggleInterest(theme, uid, wasInterested);
    } catch {
      // Rollback optimiste en cas d'échec réel (le listener aurait de
      // toute façon fini par corriger, mais on ne veut pas laisser un
      // état incorrect affiché pendant ce temps).
      this.applyThemeUpdate(theme.id, { interested: previousList });
    } finally {
      this.interestPending.set(null);
    }
  }

  // ✅ Applique un patch à une thématique à la fois dans la liste
  // affichée et dans le tiroir de détail s'il est ouvert sur cette
  // même thématique — sans ça, `selectedTheme` reste une copie figée
  // prise à l'ouverture et ne reflète pas les changements en direct.
  // ✅ Recale le tiroir de détail (s'il est ouvert) sur la version la
  // plus récente de la thématique venant du listener temps réel —
  // couvre les changements faits ailleurs (autre onglet, admin...).
  private resyncSelectedTheme(): void {
    const current = this.selectedTheme();
    if (!current) return;
    const fresh = this.themes().find((t) => t.id === current.id);
    if (fresh) this.selectedTheme.set(fresh);
  }

  private applyThemeUpdate(themeId: string, patch: Partial<ThemeWithWorkshop>): void {
    this.themes.update((list) =>
      list.map((t) => (t.id === themeId ? { ...t, ...patch } : t)),
    );
    const current = this.selectedTheme();
    if (current?.id === themeId) {
      this.selectedTheme.set({ ...current, ...patch });
    }
  }

  filteredThemes = computed(() => {
    const all = this.themes();
    const category = this.activeCategory();
    const term = this.searchTerm().toLowerCase().trim();

    // Visiteurs : seulement les thèmes ouverts
    const visible = this.isLoggedIn()
      ? all
      : all.filter((t) => t.status === 'ouvert');

    return visible.filter((t) => {
      const matchCategory = !category || t.category === category;
      const matchSearch =
        !term ||
        t.title.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term);
      return matchCategory && matchSearch;
    });
  });

  /** Segment d'URL de la page détail : {slug-du-titre}--{id}. */
  slugOf(theme: ThemeWithWorkshop): string {
    return buildSlug(theme.title, theme.id!);
  }

  ngOnInit(): void {
    // ── SEO du listing ──
    this.seo.setPage({
      title: 'Thématiques — propose et vote pour les prochains workshops',
      description:
        'Sécurité réseau, cryptographie, IA, DevOps… Découvre les thématiques ' +
        'du Club TDSI et manifeste ton intérêt pour les prochains workshops.',
      path: '/thematiques',
    });

    // ✅ SSR-safe : listeners Firestore temps réel uniquement en
    // navigateur (voir workshops.component.ts pour le détail).
    if (!this.isBrowser) {
      // loading reste à true (voir workshops.component.ts).
      return;
    }

    this.settingsSub = this.settingsService.getSettings().subscribe((settings) => {
      this.hotDemandThreshold.set(settings.interestNotificationThreshold);
    });

    // Lit le filtre initial depuis l'URL (lien partagé, retour arrière au
    // premier chargement) puis reste synchronisé sur les changements
    // ultérieurs (navigation avec Précédent/Suivant du navigateur).
    this.readFiltersFromUrl(this.route.snapshot.queryParamMap);
    this.filtersInitialized = true;
    this.filtersRouteSub = this.route.queryParamMap.subscribe((params) => {
      this.readFiltersFromUrl(params);
    });

    if (this.isLoggedIn()) {
      this.initMember();
    } else {
      this.initPublic();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.settingsSub?.unsubscribe();
    this.filtersRouteSub?.unsubscribe();
    if (this.isBrowser) document.body.style.overflow = '';
  }

  // ── Chargement public (visiteurs) ──
  private initPublic(): void {
    this.sub = this.themeService.getThemes().subscribe((themes) => {
      this.themes.set(themes.map((t) => ({ ...t })));
      this.resyncSelectedTheme();
      this.loading.set(false);
      this.initComplete.set(true);
    });
  }

  // ── Chargement membre (auth) ──
  private initMember(): void {
    const user = this.authService.currentUser!;
    this.initComplete.set(false);

    this.sub = combineLatest([
      this.themeService.getThemes(),
      this.workshopService.getWorkshops(),
      this.themeService.getMySubmissions(user.uid),
    ]).subscribe(([themes, workshops, mySubmissions]) => {
      const themesWithWorkshop = themes.map((theme) => ({
        ...theme,
        linkedWorkshop: workshops.find(
          (ws) =>
            ws.themeId === theme.id &&
            (ws.status === 'planifié' || ws.status === 'en cours'),
        ),
      }));

      this.themes.set(themesWithWorkshop);
      this.resyncSelectedTheme();
      this.loading.set(false);
      this.initComplete.set(true);

      if (
        themesWithWorkshop.length > 0 &&
        this.recommendations().length === 0
      ) {
        this.loadRecommendations(
          themesWithWorkshop,
          workshops,
          mySubmissions,
          user,
        );
      }
    });
  }

  // ══ Recommandations personnalisées (membres) ══
  private async loadRecommendations(
    themes: ThemeWithWorkshop[],
    workshops: Workshop[],
    mySubmissions: any[],
    user: any,
  ): Promise<void> {
    this.recoLoading.set(true);
    this.recoError.set('');

    try {
      const registeredWorkshops = workshops.filter((ws) =>
        ws.registrations?.includes(user.uid),
      );
      const registeredCategories = [
        ...new Set(
          registeredWorkshops
            .map(
              (ws) => themes.find((t) => t.id === ws.themeId)?.category ?? '',
            )
            .filter(Boolean),
        ),
      ];
      const submittedCategories = [
        ...new Set(mySubmissions.map((s) => s.category).filter(Boolean)),
      ];
      const attendedThemes = registeredWorkshops
        .map((ws) => themes.find((t) => t.id === ws.themeId)?.title ?? '')
        .filter(Boolean);

      const available = themes
        .filter(
          (t) => t.status === 'ouvert' && !attendedThemes.includes(t.title),
        )
        .map((t) => ({
          id: t.id!,
          title: t.title,
          category: t.category,
          difficulty: t.difficulty,
          description: t.description?.slice(0, 80) ?? '',
        }));

      if (available.length === 0) {
        this.recommendations.set([]);
        return;
      }

      const recos: ThemeRecommendation[] =
        await this.aiService.getPersonalizedRecommendations(
          {
            promo: user.promo ?? '',
            registeredCategories,
            submittedCategories,
            attendedThemes,
          },
          available,
        );

      const enriched: RecommendedTheme[] = recos
        .map((r) => {
          const theme = themes.find((t) => t.id === r.themeId);
          if (!theme) return null;
          return {
            ...theme,
            aiScore: r.score,
            aiReason: r.reason,
          } as RecommendedTheme;
        })
        .filter(Boolean) as RecommendedTheme[];

      this.recommendations.set(enriched);
    } catch {
      this.recoError.set('Recommandations indisponibles pour le moment.');
    } finally {
      this.recoLoading.set(false);
    }
  }

  refreshRecommendations(): void {
    const themes = this.themes();
    const user = this.authService.currentUser!;
    if (!themes.length) return;
    this.recommendations.set([]);
    combineLatest([
      this.workshopService.getWorkshops(),
      this.themeService.getMySubmissions(user.uid),
    ])
      .subscribe(([workshops, subs]) => {
        this.loadRecommendations(themes, workshops, subs, user);
      })
      .unsubscribe();
  }

  // ✅ Ouvrir le drawer des recommandations
  openRecommendationsDrawer(): void {
    this.recommendationsDrawerOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.focusDrawer('.drawer--recommendations .drawer__close');

    // Charger les recommandations si pas déjà fait
    if (this.recommendations().length === 0 && !this.recoLoading()) {
      this.loadRecommendationsFromDrawer();
    }
  }

  // ✅ Fermer le drawer des recommandations
  closeRecommendationsDrawer(): void {
    this.recommendationsDrawerOpen.set(false);
    this.returnFocusToTrigger();
    setTimeout(() => {
      document.body.style.overflow = '';
    }, 300);
  }

  // ✅ Charger les recommandations depuis le drawer (corrigé sans .toPromise())
  async loadRecommendationsFromDrawer(): Promise<void> {
    const user = this.authService.currentUser;
    if (!user) return;

    this.recoLoading.set(true);
    this.recoError.set('');

    try {
      const themes = this.themes();
      const workshops = await firstValueFrom(this.workshopService.getWorkshops());
      const mySubmissions = await firstValueFrom(this.themeService.getMySubmissions(user.uid));

      await this.loadRecommendations(themes, workshops, mySubmissions, user);
    } catch {
      this.recoError.set('Impossible de charger les recommandations');
    } finally {
      this.recoLoading.set(false);
    }
  }

  // ✅ Ouvrir le détail d'une thématique depuis la recommandation
  openThemeDetailFromReco(theme: ThemeWithWorkshop): void {
    this.closeRecommendationsDrawer();
    setTimeout(() => {
      this.openThemeDetail(theme);
    }, 300);
  }

  // ── Drawer ──
  openThemeDetail(theme: ThemeWithWorkshop): void {
    const runOpen = () => {
      this.selectedTheme.set(theme);
      this.enrichedThemeData.set(null);
      this.drawerOpen.set(true);
      document.body.style.overflow = 'hidden';
      this.focusDrawer('.drawer__close');

      if (this.isLoggedIn() && !theme.objectives && !theme.prerequisites) {
        this.enrichThemeWithAI(theme);
      }
    };

    if (!this.supportsViewTransitions() || !theme.id) {
      runOpen();
      return;
    }

    this.transitioningThemeId.set(theme.id);
    this.appRef.tick(); // rend la card "avant" avec son nom de transition

    (document as any).startViewTransition(() => {
      runOpen();
      this.appRef.tick(); // rend le drawer "après" avec le même nom
    });
  }

  closeDrawer(): void {
    const theme = this.selectedTheme();

    if (!this.supportsViewTransitions() || !theme?.id) {
      this.drawerOpen.set(false);
      this.returnFocusToTrigger();
      setTimeout(() => {
        this.selectedTheme.set(null);
        document.body.style.overflow = '';
      }, 300);
      return;
    }

    this.returnFocusToTrigger();
    const transition = (document as any).startViewTransition(() => {
      this.drawerOpen.set(false);
      this.appRef.tick(); // la card "après" reprend le nom de transition
    });

    // On ne démonte la thématique sélectionnée qu'une fois l'animation
    // terminée — sinon le drawer disparaît du DOM avant que le navigateur
    // ait fini de l'animer.
    transition.finished
      .catch(() => {})
      .finally(() => {
        this.transitioningThemeId.set(null);
        this.selectedTheme.set(null);
        document.body.style.overflow = '';
      });
  }

  async enrichThemeWithAI(theme: ThemeWithWorkshop): Promise<void> {
    this.loadingEnriched.set(true);
    try {
      // ⚡ Version persistée servie instantanément si à jour
      const result = await this.enrichmentService.forTheme(theme);
      this.enrichedThemeData.set({
        objectives: result.objectives || [],
        prerequisites: result.prerequisites || [],
        materials: result.materials || [],
        skills: result.skills || [],
      });
    } catch (error) {
      console.error('Erreur enrichissement IA:', error);
    } finally {
      this.loadingEnriched.set(false);
    }
  }

  // ── Helpers ──
  getDifficultyClass(difficulty: string): string {
    const map: Record<string, string> = {
      débutant: 'green',
      intermédiaire: 'amber',
      avancé: 'red',
    };
    return map[difficulty] || 'neutral';
  }

  getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case 'débutant':
        return '#10b981';
      case 'intermédiaire':
        return '#f59e0b';
      case 'avancé':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }

  getDifficultyIcon(difficulty: string): string {
    const icons: Record<string, string> = {
      débutant: 'fa-seedling',
      intermédiaire: 'fa-book',
      avancé: 'fa-bolt',
    };
    return icons[difficulty] || 'fa-circle-question';
  }

  getDifficultyIconClass(difficulty: string): string {
    switch (difficulty) {
      case 'débutant':
        return 'fa-seedling';
      case 'intermédiaire':
        return 'fa-book-open';
      case 'avancé':
        return 'fa-rocket';
      default:
        return 'fa-graduation-cap';
    }
  }

  getWorkshopStatusClass(status: string): string {
    return sharedWorkshopStatusClass(status);
  }

  getWorkshopStatusIcon(status: string): string {
    return sharedWorkshopStatusIcon(status);
  }

getLocationIcon(location: string): string {
  return sharedLocationIcon(location);
}


getLocationText(location: string): string {
  return sharedLocationText(location);
}
  getEndTime(
    date: Date | string | null | undefined,
    duration: number | null | undefined,
  ): string {
    return sharedGetEndTime(date, duration);
  }

  getScoreColor(score: number): string {
    if (score >= 85) return 'high';
    if (score >= 65) return 'mid';
    return 'low';
  }

  formatDuration(minutes: number): string {
    return sharedFormatDuration(minutes);
  }

  totalThemesCount(): number {
    return this.filteredThemes().length;
  }

  workshopsAssociatedCount(): number {
    return this.themes().filter((t) => t.linkedWorkshop).length;
  }

// thematiques.component.ts - Correction des méthodes parse

parseObjectives(objectives: string | undefined | null): string[] {
  if (!objectives || typeof objectives !== 'string') return [];
  return objectives
    .split(/[.;\n]+/)
    .filter((o) => o.trim().length > 0)
    .map((o) => o.trim());
}

parsePrerequisites(prerequisites: string | undefined | null): string[] {
  if (!prerequisites || typeof prerequisites !== 'string') return [];
  return prerequisites
    .split(/[;,.\n]+/)
    .filter((p) => p.trim().length > 0)
    .map((p) => p.trim());
}

parseMaterials(materials: string | undefined | null): string[] {
  if (!materials || typeof materials !== 'string') return [];
  return materials
    .split(/[;,.\n]+/)
    .filter((m) => m.trim().length > 0)
    .map((m) => m.trim());
}


}
