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
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  AiService,
  ThemeRecommendation,
} from '../../../core/services/ai.service';
import { Theme, ThemeCategory, Workshop } from '../../../core/model/models';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';

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
  selector: 'app-themes',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchBarComponent],
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.scss'],
})
export class ThemesComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);

  private sub!: Subscription;

  themes = signal<ThemeWithWorkshop[]>([]);
  loading = signal(true);
  activeCategory = signal<ThemeCategory | null>(null);
  searchTerm = signal('');
  selectedTheme = signal<ThemeWithWorkshop | null>(null);
  drawerOpen = signal(false);
  categories = CATEGORIES;

  // ── Axe 2 — Recommandations IA ──
  recommendations = signal<RecommendedTheme[]>([]);
  recoLoading = signal(false);
  recoError = signal('');
  showRecommendations = signal(true);

  filteredThemes = computed(() => {
    const all = this.themes();
    const category = this.activeCategory();
    const term = this.searchTerm().toLowerCase().trim();

    return all.filter(t => {
      const matchCategory = !category || t.category === category;
      const matchSearch = !term
        || t.title.toLowerCase().includes(term)
        || t.description?.toLowerCase().includes(term)
        || t.category.toLowerCase().includes(term);
      return matchCategory && matchSearch;
    });
  });

  ngOnInit(): void {
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

      // Lance les reco une seule fois après le premier chargement
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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    document.body.style.overflow = '';
  }

  // ══ AXE 2 — Recommandations personnalisées ══
  private async loadRecommendations(
    themes: ThemeWithWorkshop[],
    workshops: Workshop[],
    mySubmissions: any[],
    user: any,
  ): Promise<void> {
    this.recoLoading.set(true);
    this.recoError.set('');

    try {
      // Profil utilisateur depuis les données Firestore
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

      // Thèmes disponibles non encore suivis
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
  this.drawerOpen.set(true);
  document.body.style.overflow = 'hidden';

  // Enrichir avec IA si nécessaire
  if (!theme.objectives && !theme.prerequisites) {
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

  // ── Helpers ──
  getDifficultyClass(difficulty: string): string {
    return (
      ({ débutant: 'green', intermédiaire: 'amber', avancé: 'red' } as any)[
        difficulty
      ] || 'neutral'
    );
  }

  getDifficultyIcon(difficulty: string): string {
    return (
      ({ débutant: '🌱', intermédiaire: '📘', avancé: '⚡' } as any)[
        difficulty
      ] || '📚'
    );
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
        { planifié: '📋', 'en cours': '🔴', terminé: '✅', annulé: '❌' } as any
      )[status] || '●'
    );
  }

  getLocationIcon(location: string): string {
    return (
      ({ 'en ligne': '💻', présentiel: '🏛️', hybride: '🔄' } as any)[
        location
      ] || '📍'
    );
  }

  getScoreColor(score: number): string {
    if (score >= 85) return 'high';
    if (score >= 65) return 'mid';
    return 'low';
  }
  totalThemesCount(): number {
    return this.filteredThemes().length;
  }
  workshopsAssociatedCount(): number {
    return this.themes().filter((t) => t.linkedWorkshop).length;
  }

  // Ajouter ces méthodes dans la classe ThemesComponent

  // Parse les objectifs (séparés par des points ou des retours à la ligne)
  parseObjectives(objectives: string): string[] {
    if (!objectives) return [];
    // Sépare par les points, points-virgules ou retours à la ligne
    return objectives
      .split(/[.;\n]+/)
      .filter((o) => o.trim().length > 0)
      .map((o) => o.trim());
  }

  // Parse les prérequis
  parsePrerequisites(prerequisites: string): string[] {
    if (!prerequisites) return [];
    return prerequisites
      .split(/[;,.\n]+/)
      .filter((p) => p.trim().length > 0)
      .map((p) => p.trim());
  }

  // Parse le matériel nécessaire
  parseMaterials(materials: string): string[] {
    if (!materials) return [];
    return materials
      .split(/[;,.\n]+/)
      .filter((m) => m.trim().length > 0)
      .map((m) => m.trim());
  }

  // Retourne l'icône Font Awesome pour la difficulté
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

  // Retourne le texte du lieu
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
  // Ajouter cette méthode dans la classe ThemesComponent

formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${minutes}min`;
}

// Ajouter un signal pour stocker les données enrichies
enrichedThemeData = signal<{
  objectives: string[];
  prerequisites: string[];
  materials: string[];
  skills: string[];
} | null>(null);
loadingEnriched = signal(false);

// Méthode pour enrichir une thématique à l'ouverture
async enrichThemeWithAI(theme: ThemeWithWorkshop): Promise<void> {
  // Si déjà chargé et pas de nouvelles données, skip
  if (theme.objectives && theme.prerequisites) return;

  this.loadingEnriched.set(true);
  try {
    const result = await this.aiService.enrichThemeContent(
      theme.title,
      theme.description,
      theme.category
    );

    this.enrichedThemeData.set({
      objectives: result.objectives || [],
      prerequisites: result.prerequisites || [],
      materials: result.materials || [],
      skills: result.skills || []
    });
  } catch (error) {
    console.error('Erreur enrichissement IA:', error);
  } finally {
    this.loadingEnriched.set(false);
  }
}


}
