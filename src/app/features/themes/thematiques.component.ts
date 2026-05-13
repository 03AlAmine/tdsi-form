import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { WorkshopService } from '../../core/services/workshop.service';
import { AuthService } from '../../core/services/auth.service';
import { AiService, ThemeRecommendation } from '../../core/services/ai.service';
import { Theme, ThemeCategory, Workshop } from '../../core/model/models';
import { SearchBarComponent } from '../shared/search-bar/search-bar.component';

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
  imports: [CommonModule, RouterLink, SearchBarComponent],
  templateUrl: './thematiques.component.html',
  styleUrls: ['./thematiques.component.scss'],
})
export class ThematiquesComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);

  private sub!: Subscription;

  // ── État principal ──
  themes = signal<ThemeWithWorkshop[]>([]);
  loading = signal(true);
  activeCategory = signal<ThemeCategory | null>(null);
  searchTerm = signal('');
  selectedTheme = signal<ThemeWithWorkshop | null>(null);
  drawerOpen = signal(false);
  categories = CATEGORIES;

  // ── Recommandations IA (membres uniquement) ──
  recommendations = signal<RecommendedTheme[]>([]);
  recoLoading = signal(false);
  recoError = signal('');
  showRecommendations = signal(true);

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

  ngOnInit(): void {
    if (this.isLoggedIn()) {
      this.initMember();
    } else {
      this.initPublic();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    document.body.style.overflow = '';
  }

  // ── Chargement public (visiteurs) ──
  private initPublic(): void {
    this.sub = this.themeService.getThemes().subscribe((themes) => {
      this.themes.set(themes.map((t) => ({ ...t })));
      this.loading.set(false);
    });
  }

  // ── Chargement membre (auth) ──
  private initMember(): void {
    const user = this.authService.currentUser!;

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
      this.loading.set(false);

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

  // ── Drawer ──
  openThemeDetail(theme: ThemeWithWorkshop): void {
    this.selectedTheme.set(theme);
    this.enrichedThemeData.set(null);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';

    if (this.isLoggedIn() && !theme.objectives && !theme.prerequisites) {
      this.enrichThemeWithAI(theme);
    }
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => {
      this.selectedTheme.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  async enrichThemeWithAI(theme: ThemeWithWorkshop): Promise<void> {
    this.loadingEnriched.set(true);
    try {
      const result = await this.aiService.enrichThemeContent(
        theme.title,
        theme.description,
        theme.category,
      );
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
    return (
      ({ débutant: 'green', intermédiaire: 'amber', avancé: 'red' } as any)[
        difficulty
      ] || 'neutral'
    );
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
    return (
      (
        {
          planifié: 'info',
          'en cours': 'success',
          terminé: 'neutral',
          annulé: 'danger',
        } as any
      )[status] || 'neutral'
    );
  }

  getWorkshopStatusIcon(status: string): string {
    return (
      (
        {
          planifié: 'fa-clipboard-list',
          'en cours': 'fa-circle-play',
          terminé: 'fa-circle-check',
          annulé: 'fa-circle-xmark',
        } as Record<string, string>
      )[status] || 'fa-circle'
    );
  }

  getLocationIcon(location: string): string {
    return (
      ({ 'en ligne': '💻', présentiel: '🏛️', hybride: '🔄' } as any)[
        location
      ] || '📍'
    );
  }

  getLocationText(location: string): string {
    switch (location) {
      case 'en ligne':
        return '💻 En ligne';
      case 'présentiel':
        return '🏛️ Présentiel';
      case 'hybride':
        return '🔄 Hybride';
      default:
        return location;
    }
  }

  getEndTime(
    date: Date | string | null | undefined,
    duration: number | null | undefined,
  ): string {
    if (!date || !duration) return '';
    const startDate = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(startDate.getTime())) return '';
    const endDate = new Date(startDate.getTime() + (duration || 0) * 60000);
    return endDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getScoreColor(score: number): string {
    if (score >= 85) return 'high';
    if (score >= 65) return 'mid';
    return 'low';
  }

  formatDuration(minutes: number): string {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60),
        m = minutes % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${minutes}min`;
  }

  totalThemesCount(): number {
    return this.filteredThemes().length;
  }
  workshopsAssociatedCount(): number {
    return this.themes().filter((t) => t.linkedWorkshop).length;
  }

  parseObjectives(objectives: string): string[] {
    if (!objectives) return [];
    return objectives
      .split(/[.;\n]+/)
      .filter((o) => o.trim().length > 0)
      .map((o) => o.trim());
  }

  parsePrerequisites(prerequisites: string): string[] {
    if (!prerequisites) return [];
    return prerequisites
      .split(/[;,.\n]+/)
      .filter((p) => p.trim().length > 0)
      .map((p) => p.trim());
  }

  parseMaterials(materials: string): string[] {
    if (!materials) return [];
    return materials
      .split(/[;,.\n]+/)
      .filter((m) => m.trim().length > 0)
      .map((m) => m.trim());
  }
}
