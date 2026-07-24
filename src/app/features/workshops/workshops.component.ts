// workshops.component.ts - Version complète et corrigée

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
import { WorkshopService } from '../../core/services/workshop.service';
import { AuthService } from '../../core/services/auth.service';
import { AiService } from '../../core/services/ai.service';
import { EnrichmentService } from '../../core/services/enrichment.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';
import { Workshop } from '../../core/model/models';
import { buildSlug } from '../../core/utils/slug.util';
import {
  getWorkshopStatusClass as sharedWorkshopStatusClass,
  getWorkshopStatusIcon as sharedWorkshopStatusIcon,
  getLocationIcon as sharedLocationIcon,
  getLocationText as sharedLocationText,
  formatDuration as sharedFormatDuration,
} from '../../core/utils/workshop-display.util';
import { TiltSpotlightDirective } from '../../core/directives/tilt-spotlight.directive';
import { RevealDirective } from '../../core/directives/reveal.directive';
import { GlowTimelineComponent } from '../shared/components/glow-timeline/glow-timeline.component';
import { TimelineItem } from '../shared/components/glow-timeline/timeline-item.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule, RouterLink, TiltSpotlightDirective, RevealDirective, GlowTimelineComponent],
  templateUrl: './workshops.component.html',
  styleUrls: ['./workshops.component.scss'],
})
export class WorkshopsComponent implements OnInit, OnDestroy {
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private toastService = inject(ToastService);
  private seo = inject(SeoService);
  private enrichmentService = inject(EnrichmentService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);

  // ── View Transitions : morph card → détail (voir ThematiquesComponent
  // pour le détail du mécanisme, identique ici avec un nom dédié). ──
  transitioningWorkshopId = signal<string | null>(null);

  private supportsViewTransitions(): boolean {
    return this.isBrowser && typeof (document as any).startViewTransition === 'function';
  }

  // ── Accessibilité : mémorise l'élément qui a ouvert le drawer pour lui
  // rendre le focus à la fermeture.
  private lastFocusedTrigger: HTMLElement | null = null;

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.drawerOpen()) this.closeDrawer();
  }

  private focusDrawer(): void {
    if (!this.isBrowser) return;
    this.lastFocusedTrigger = document.activeElement as HTMLElement;
    setTimeout(() => {
      (this.host.nativeElement.querySelector('.drawer__close') as HTMLElement | null)?.focus();
    });
  }

  private returnFocusToTrigger(): void {
    if (!this.isBrowser) return;
    this.lastFocusedTrigger?.focus();
    this.lastFocusedTrigger = null;
  }

  workshops = signal<Workshop[]>([]);
  loading = signal(true);
  searchTerm = signal('');
  selectedWorkshop = signal<Workshop | null>(null);
  drawerOpen = signal(false);
  loadingEnriched = signal(false);
  registeringId = signal<string | null>(null);

  // ── Deep-linking de la recherche (?q=...) — même mécanisme que
  // ThematiquesComponent, allégé (pas de filtre catégorie ici). ──
  private filtersInitialized = false;
  private syncingFromUrl = false;
  private filtersRouteSub?: Subscription;

  private readFiltersFromUrl(params: ParamMap): void {
    this.syncingFromUrl = true;
    const q = params.get('q') ?? '';
    if (q !== this.searchTerm()) this.searchTerm.set(q);

    const vue = params.get('vue');
    const mode =
      vue === 'calendrier' ? 'calendar' : vue === 'chronologie' ? 'timeline' : vue === 'liste' ? 'list' : null;
    if (mode && mode !== this.viewMode()) this.viewMode.set(mode);

    this.syncingFromUrl = false;
  }

  private writeFiltersToUrl(term: string, viewMode: 'list' | 'calendar' | 'timeline'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: term || null,
        // Pas de "vue" dans l'URL en mode liste (valeur par défaut) —
        // évite d'alourdir tous les liens partagés pour le cas courant.
        vue: viewMode === 'calendar' ? 'calendrier' : viewMode === 'timeline' ? 'chronologie' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private readonly filtersUrlSync = effect(() => {
    const term = this.searchTerm();
    const mode = this.viewMode();
    if (!this.filtersInitialized || this.syncingFromUrl) return;
    this.writeFiltersToUrl(term, mode);
  });

  // ── Vue Liste / Calendrier / Timeline ────────────────────────────────
  viewMode = signal<'list' | 'calendar' | 'timeline'>('list');
  calendarMonth = signal(startOfMonth(new Date()));
  weekDayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  calendarMonthLabel = computed(() =>
    capitalize(
      this.calendarMonth().toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      }),
    ),
  );

  isCurrentMonth = computed(() => {
    const now = startOfMonth(new Date());
    const shown = this.calendarMonth();
    return now.getFullYear() === shown.getFullYear() && now.getMonth() === shown.getMonth();
  });

  calendarWeeks = computed<CalendarCell[][]>(() => {
    const monthStart = this.calendarMonth();
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Lundi = premier jour de semaine (convention FR). getDay() renvoie
    // 0 (dimanche) à 6 (samedi) → on décale pour que lundi = 0.
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

    const workshopsByDay = new Map<number, Workshop[]>();
    for (const w of this.filteredWorkshops()) {
      const d = new Date(w.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!workshopsByDay.has(day)) workshopsByDay.set(day, []);
        workshopsByDay.get(day)!.push(w);
      }
    }

    const today = new Date();
    const cells: CalendarCell[] = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: null, workshops: [], isToday: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayWorkshops = (workshopsByDay.get(day) || []).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      cells.push({
        date: day,
        workshops: dayWorkshops,
        isToday:
          today.getFullYear() === year &&
          today.getMonth() === month &&
          today.getDate() === day,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, workshops: [], isToday: false });
    }

    const weeks: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  });

  goToPreviousMonth(): void {
    const d = this.calendarMonth();
    this.calendarMonth.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  goToNextMonth(): void {
    const d = this.calendarMonth();
    this.calendarMonth.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  goToCurrentMonth(): void {
    this.calendarMonth.set(startOfMonth(new Date()));
  }

  private subscription: Subscription | null = null;

  defaultObjectives = [
    'Maîtriser les concepts fondamentaux du sujet',
    'Savoir mettre en pratique les techniques apprises',
    'Développer des compétences opérationnelles',
  ];

  isLoggedIn = () => this.authService.isLoggedIn;

  filteredWorkshops = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const all = this.workshops();

    const visible = this.isLoggedIn()
      ? all
      : all.filter((w) => w.status === 'planifié' || w.status === 'en cours');

    if (!term) return visible;
    return visible.filter(
      (w) =>
        w.themeTitle.toLowerCase().includes(term) ||
        w.presenter.toLowerCase().includes(term) ||
        w.location.toLowerCase().includes(term),
    );
  });

  // ── Vue Timeline — chronologique du plus ancien au plus récent, sur
  // le même jeu filtré (recherche + visibilité) que la grille. ──
  timelineItems = computed<TimelineItem[]>(() => {
    const sorted = [...this.filteredWorkshops()].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return sorted.map((w) => ({
      id: w.id ?? w.themeTitle,
      icon: sharedWorkshopStatusIcon(w.status),
      title: w.themeTitle,
      dateLabel: new Date(w.date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      status: sharedWorkshopStatusClass(w.status) as TimelineItem['status'],
      statusLabel: w.status,
      pulse: w.status === 'en cours',
      meta: [
        { icon: sharedLocationIcon(w.location), text: sharedLocationText(w.location) },
        { icon: 'fa-user', text: w.presenter },
        { icon: 'fa-clock', text: sharedFormatDuration(w.duration) },
      ],
      ctaLabel: 'Voir le détail',
      disabled: false,
      data: w,
    }));
  });

  enrichedWorkshopData = signal<{
    objectives: string[];
    prerequisites: string[];
    skills: string[];
    outcomes: string[];
  } | null>(null);

  ngOnInit(): void {
    // ── SEO du listing ──
    this.seo.setPage({
      title: 'Workshops cybersécurité, IA & réseaux',
      description:
        'Workshops gratuits du Club TDSI : cybersécurité, cryptographie, IA, ' +
        'cloud. Club TDSI – UCAD, Dakar. En ligne et en présentiel, inscription libre.',
      path: '/workshops',
    });

    // ✅ SSR-safe : le listener Firestore temps réel (onSnapshot) ne
    // s'ouvre qu'en navigateur — au prerender il empêcherait l'app de
    // se stabiliser. Le HTML prérendu = shell + meta, les données
    // arrivent à l'hydratation côté client.
    if (!this.isBrowser) {
      // loading reste à true : le HTML prérendu montre l'état de
      // chargement (pas un faux "aucun workshop"), les données
      // arrivent dès que le JS client démarre.
      return;
    }

    this.readFiltersFromUrl(this.route.snapshot.queryParamMap);
    this.filtersInitialized = true;
    this.filtersRouteSub = this.route.queryParamMap.subscribe((params) => {
      this.readFiltersFromUrl(params);
    });

    this.subscription = this.workshopService
      .getWorkshops()
      .subscribe((workshops) => {
        this.workshops.set(workshops);
        this.loading.set(false);
      });
  }

  /** Segment d'URL de la page détail : {slug-du-titre}--{id}. */
  slugOf(workshop: Workshop): string {
    return buildSlug(workshop.themeTitle, workshop.id!);
  }

  /** Slug de la thématique liée à ce workshop (page /thematiques/:slug). */
  themeSlugOf(workshop: Workshop): string {
    return buildSlug(workshop.themeTitle, workshop.themeId);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.filtersRouteSub?.unsubscribe();
    if (this.isBrowser) document.body.style.overflow = '';
  }

  // ============================================================
  // WORKSHOP DETAIL DRAWER
  // ============================================================

  onTimelineItemClick(item: TimelineItem): void {
    const workshop = item.data as Workshop | undefined;
    if (workshop) this.openWorkshopDetail(workshop);
  }

  openWorkshopDetail(workshop: Workshop): void {
    const runOpen = () => {
      this.selectedWorkshop.set(workshop);
      this.enrichedWorkshopData.set(null);
      this.drawerOpen.set(true);
      document.body.style.overflow = 'hidden';
      this.focusDrawer();

      if (this.isLoggedIn()) {
        this.enrichWorkshopWithAI(workshop);
      }
    };

    if (!this.supportsViewTransitions() || !workshop.id) {
      runOpen();
      return;
    }

    this.transitioningWorkshopId.set(workshop.id);
    this.appRef.tick();

    (document as any).startViewTransition(() => {
      runOpen();
      this.appRef.tick();
    });
  }

  closeDrawer(): void {
    const workshop = this.selectedWorkshop();

    if (!this.supportsViewTransitions() || !workshop?.id) {
      this.drawerOpen.set(false);
      this.returnFocusToTrigger();
      setTimeout(() => {
        this.selectedWorkshop.set(null);
        document.body.style.overflow = '';
      }, 300);
      return;
    }

    this.returnFocusToTrigger();
    const transition = (document as any).startViewTransition(() => {
      this.drawerOpen.set(false);
      this.appRef.tick();
    });

    transition.finished
      .catch(() => {})
      .finally(() => {
        this.transitioningWorkshopId.set(null);
        this.selectedWorkshop.set(null);
        document.body.style.overflow = '';
      });
  }

  async enrichWorkshopWithAI(workshop: Workshop): Promise<void> {
    // ⚡ Si l'enrichissement est déjà persisté en base (cas de loin le
    // plus fréquent), forWorkshop retourne immédiatement — pas de
    // spinner visible, zéro appel au backend IA.
    this.loadingEnriched.set(true);
    try {
      const result = await this.enrichmentService.forWorkshop(workshop);
      this.enrichedWorkshopData.set({
        objectives: result.objectives || [],
        prerequisites: result.prerequisites || [],
        skills: result.skills || [],
        outcomes: result.outcomes || [],
      });
    } catch {
      // Silencieux — l'enrichissement IA est un bonus
    } finally {
      this.loadingEnriched.set(false);
    }
  }

  // ============================================================
  // INSCRIPTIONS / DÉSINSCRIPTIONS
  // ============================================================

  isRegistered(workshop: Workshop): boolean {
    const userId = this.authService.currentUser?.uid;
    return workshop.registrations?.includes(userId!) || false;
  }

  isProcessing(workshop: Workshop): boolean {
    return this.registeringId() === workshop.id;
  }

  async register(workshop: Workshop): Promise<void> {
    if (!this.isLoggedIn()) return;
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.registerToWorkshop(workshop.id!, userId);
      this.toastService.success(
        `✅ Inscription confirmée pour "${workshop.themeTitle}" !`,
      );
    } catch (error: any) {
      if (error.message === 'Plus de places disponibles') {
        this.toastService.error(
          '❌ Ce workshop est complet, plus de places disponibles.',
        );
      } else {
        this.toastService.error("❌ Erreur lors de l'inscription. Réessaie.");
      }
    } finally {
      this.registeringId.set(null);
    }
  }

  async unregister(workshop: Workshop): Promise<void> {
    if (!this.isLoggedIn()) return;
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.unregisterFromWorkshop(workshop.id!, userId);
      this.toastService.info(
        `ℹ️ Désinscription de "${workshop.themeTitle}" effectuée.`,
      );
    } catch {
      this.toastService.error('❌ Erreur lors de la désinscription. Réessaie.');
    } finally {
      this.registeringId.set(null);
    }
  }

  // ── File d'attente (workshop complet) ───────────────────────────────
  isOnWaitlist(workshop: Workshop): boolean {
    const userId = this.authService.currentUser?.uid;
    return !!userId && !!workshop.waitlist?.includes(userId);
  }

  isFull(workshop: Workshop): boolean {
    return (workshop.registrations?.length || 0) >= (workshop.maxParticipants || 30);
  }

  waitlistPosition(workshop: Workshop): number | null {
    const userId = this.authService.currentUser?.uid;
    if (!userId) return null;
    return this.workshopService.getWaitlistPosition(workshop, userId);
  }

  async joinWaitlist(workshop: Workshop): Promise<void> {
    if (!this.isLoggedIn()) return;
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.joinWaitlist(workshop.id!, userId);
      this.toastService.success(
        `🕒 Ajouté·e à la file d'attente pour "${workshop.themeTitle}".`,
      );
    } catch (error: any) {
      this.toastService.error(
        error?.message || "❌ Erreur lors de l'ajout à la file d'attente.",
      );
    } finally {
      this.registeringId.set(null);
    }
  }

  async leaveWaitlist(workshop: Workshop): Promise<void> {
    if (!this.isLoggedIn()) return;
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    this.registeringId.set(workshop.id!);
    try {
      await this.workshopService.leaveWaitlist(workshop.id!, userId);
      this.toastService.info("ℹ️ Retiré·e de la file d'attente.");
    } catch {
      this.toastService.error('❌ Erreur. Réessaie.');
    } finally {
      this.registeringId.set(null);
    }
  }

  joinMeet(workshop: Workshop): void {
    if (!this.isLoggedIn()) {
      this.toastService.error('🔒 Connecte-toi pour accéder au meet.');
      return;
    }
    this.router.navigate(['/workshops', workshop.id, 'meet']);
  }

  // ============================================================
  // LOGIQUE DE STATUT DYNAMIQUE (BASÉE SUR L'HEURE)
  // ============================================================

  // ============================================================
  // LOGIQUE DE STATUT DYNAMIQUE (BASÉE SUR L'HEURE)
  // ============================================================

  /**
   * Vérifie si un workshop est en cours
   */
  isWorkshopOngoing(workshop: Workshop): boolean {
    const now = new Date();
    const startDate = new Date(workshop.date);
    const duration = workshop.duration || 90;
    const endDate = workshop.endDate
      ? new Date(workshop.endDate)
      : new Date(startDate.getTime() + duration * 60000);

    return now >= startDate && now <= endDate;
  }

  /**
   * Vérifie si un workshop est terminé
   */
  isWorkshopFinished(workshop: Workshop): boolean {
    const now = new Date();
    const startDate = new Date(workshop.date);
    const duration = workshop.duration || 90;
    const endDate = workshop.endDate
      ? new Date(workshop.endDate)
      : new Date(startDate.getTime() + duration * 60000);

    return now > endDate;
  }

  /**
   * Obtient le statut d'affichage du workshop
   */
  getWorkshopDisplayStatus(workshop: Workshop): string {
    // Annulé (priorité max)
    if (workshop.status === 'annulé') return 'annulé';

    // Terminé
    if (this.isWorkshopFinished(workshop)) return 'terminé';

    // En cours
    if (this.isWorkshopOngoing(workshop)) return 'en cours';

    // Planifié par défaut
    return 'planifié';
  }

  /**
   * Classe CSS pour le badge
   */
  getWorkshopStatusClass(workshop: Workshop): string {
    return sharedWorkshopStatusClass(this.getWorkshopDisplayStatus(workshop));
  }

  /**
   * Icône pour le badge
   */
  getWorkshopStatusIcon(workshop: Workshop): string {
    return sharedWorkshopStatusIcon(this.getWorkshopDisplayStatus(workshop));
  }


  // ============================================================
  // MÉTHODES DE COMPTAGE (CORRIGÉES AVEC STATUT DYNAMIQUE)
  // ============================================================

  /**
   * Nombre de workshops à venir (basé sur le statut dynamique)
   */
  upcomingCount(): number {
    return this.workshops().filter(
      (w) => this.getWorkshopDisplayStatus(w) === 'planifié',
    ).length;
  }

  /**
   * Nombre de workshops en cours (basé sur le statut dynamique)
   */
  ongoingCount(): number {
    return this.workshops().filter(
      (w) => this.getWorkshopDisplayStatus(w) === 'en cours',
    ).length;
  }

  /**
   * Nombre de workshops terminés (basé sur le statut dynamique) - optionnel
   */
  finishedCount(): number {
    return this.workshops().filter(
      (w) => this.getWorkshopDisplayStatus(w) === 'terminé',
    ).length;
  }

  /**
   * Total des inscriptions (inchangé)
   */
  getTotalRegistrations(): number {
    return this.workshops().reduce(
      (total, ws) => total + (ws.registrations?.length || 0),
      0,
    );
  }

  /**
   * Mes inscriptions (inchangé)
   */
  myRegistrationsCount(): number {
    const userId = this.authService.currentUser?.uid;
    if (!userId) return 0;
    return this.workshops().filter((w) => w.registrations?.includes(userId))
      .length;
  }

  // ============================================================
  // MÉTHODES UTILITAIRES (GARDÉES)
  // ============================================================

  getStatusClass(status: string): string {
    return sharedWorkshopStatusClass(status);
  }

  getStatusIcon(status: string): string {
    return sharedWorkshopStatusIcon(status);
  }

  getLocationIcon(location: string): string {
    return sharedLocationIcon(location);
  }

  formatDuration(minutes: number): string {
    return sharedFormatDuration(minutes);
  }

  getRegistrationPercent(workshop: Workshop): number {
    const registrations = workshop.registrations?.length || 0;
    const max = workshop.maxParticipants || 30;
    return Math.min((registrations / max) * 100, 100);
  }

  getAvailablePlaces(workshop: Workshop): number {
    const max = workshop.maxParticipants || 30;
    const registrations = workshop.registrations?.length || 0;
    return Math.max(max - registrations, 0);
  }
}

interface CalendarCell {
  date: number | null;
  workshops: Workshop[];
  isToday: boolean;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
