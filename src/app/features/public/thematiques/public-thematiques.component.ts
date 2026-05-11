import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from '../../../core/services/theme.service';
import { Theme } from '../../../core/model/models';
import { TechBackgroundComponent } from '../../shared/components/tech-background/tech-background.component';
import { PublicNavbarComponent } from '../../shared/components/public-navbar/public-navbar.component';
import { PublicFooterComponent } from '../../shared/components/public-footer/public-footer.component';

@Component({
  selector: 'app-public-thematiques',
  standalone: true,
  imports: [CommonModule, TechBackgroundComponent, PublicNavbarComponent, PublicFooterComponent],
  templateUrl: './public-thematiques.component.html',
  styleUrls: ['./public-thematiques.component.scss']
})
export class PublicThematiquesComponent {
  private themeService = inject(ThemeService);

  themes         = signal<Theme[]>([]);
  loading        = signal(true);
  selectedTheme  = signal<Theme | null>(null);
  drawerOpen     = signal(false);
  activeCategory = signal<string | null>(null);

  categories = [
    'Sécurité Réseau', 'Cryptographie', 'Transmission de Données',
    'Intelligence Artificielle', 'Développement Web', 'Cloud & DevOps', 'Autre'
  ];

  constructor() {
    this.themeService.getThemes()
      .pipe(takeUntilDestroyed())
      .subscribe(themes => {
        this.themes.set(themes.filter(t => t.status === 'ouvert'));
        this.loading.set(false);
      });
  }

  get filteredThemes() {
    const category = this.activeCategory();
    if (!category) return this.themes();
    return this.themes().filter(t => t.category === category);
  }

  getDifficultyIcon(difficulty: string): string {
    return ({ débutant: '🌱', intermédiaire: '📘', avancé: '⚡' } as any)[difficulty] || '📚';
  }

  openThemeDrawer(theme: Theme): void {
    this.selectedTheme.set(theme);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => { this.selectedTheme.set(null); document.body.style.overflow = ''; }, 300);
  }
}
