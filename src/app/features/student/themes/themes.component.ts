import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { Theme, ThemeCategory, Workshop } from '../../../core/model/models';

interface ThemeWithWorkshop extends Theme {
  linkedWorkshop?: Workshop;
}

const CATEGORIES: ThemeCategory[] = [
  'Sécurité Réseau', 'Cryptographie', 'Transmission de Données',
  'Intelligence Artificielle', 'Développement Web', 'Cloud & DevOps', 'Autre'
];

@Component({
  selector: 'app-themes',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.scss']
})
export class ThemesComponent implements OnInit {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);

  themes = signal<ThemeWithWorkshop[]>([]);
  loading = signal(true);
  activeCategory = signal<ThemeCategory | null>(null);
  selectedTheme = signal<ThemeWithWorkshop | null>(null);
  drawerOpen = signal(false);
  categories = CATEGORIES;

  filteredThemes = computed(() => {
    const all = this.themes();
    const category = this.activeCategory();
    if (!category) return all;
    return all.filter(t => t.category === category);
  });

  ngOnInit(): void {
    combineLatest([
      this.themeService.getThemes(),
      this.workshopService.getWorkshops()
    ]).subscribe(([themes, workshops]) => {
      const themesWithWorkshop = themes.map(theme => ({
        ...theme,
        linkedWorkshop: workshops.find(ws =>
          ws.themeId === theme.id &&
          (ws.status === 'planifié' || ws.status === 'en cours')
        )
      }));
      this.themes.set(themesWithWorkshop);
      this.loading.set(false);
    });
  }

  openThemeDetail(theme: ThemeWithWorkshop): void {
    this.selectedTheme.set(theme);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => {
      this.selectedTheme.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  getDifficultyClass(difficulty: string): string {
    const map: Record<string, string> = {
      'débutant': 'green',
      'intermédiaire': 'amber',
      'avancé': 'red'
    };
    return map[difficulty] || 'neutral';
  }

  getDifficultyIcon(difficulty: string): string {
    const map: Record<string, string> = {
      'débutant': '🌱',
      'intermédiaire': '📘',
      'avancé': '⚡'
    };
    return map[difficulty] || '📚';
  }

  getWorkshopStatusClass(status: string): string {
    const map: Record<string, string> = {
      'planifié': 'info',
      'en cours': 'success',
      'terminé': 'neutral',
      'annulé': 'danger'
    };
    return map[status] || 'neutral';
  }

  getWorkshopStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'planifié': '📋',
      'en cours': '🔴',
      'terminé': '✅',
      'annulé': '❌'
    };
    return map[status] || '●';
  }

  getLocationIcon(location: string): string {
    const map: Record<string, string> = {
      'en ligne': '💻',
      'présentiel': '🏛️',
      'hybride': '🔄'
    };
    return map[location] || '📍';
  }
}
