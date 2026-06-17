// features/articles/articles.component.ts
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ArticleService } from '../../core/services/article.service';
import { Article, ArticleCategory } from '../../core/model/article.model';

@Component({
  selector: 'app-articles',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './articles.component.html',
  styleUrls: ['./articles.component.scss'],
})
export class ArticlesComponent implements OnInit, OnDestroy {
  private articleService = inject(ArticleService);
  private router = inject(Router);

  articles = signal<Article[]>([]);
  searchQuery = signal('');
  activeCategory = signal<ArticleCategory | 'Tous'>('Tous');
  loading = signal(true);

  private sub: Subscription | null = null;

  categories: (ArticleCategory | 'Tous')[] = [
    'Tous',
    'Cybersécurité',
    'Intelligence Artificielle',
    'Développement Web',
    'Cloud & DevOps',
    'Cryptographie',
    'Réseaux',
    'Autre',
  ];

  readonly categoryIcons: Record<string, string> = {
    'Tous':                      'fa-th-large',
    'Cybersécurité':             'fa-shield-alt',
    'Intelligence Artificielle': 'fa-robot',
    'Développement Web':         'fa-code',
    'Cloud & DevOps':            'fa-cloud',
    'Cryptographie':             'fa-lock',
    'Réseaux':                   'fa-network-wired',
    'Autre':                     'fa-ellipsis-h',
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  filtered = computed(() => {
    const q   = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();
    return this.articles().filter(a => {
      const matchCat = cat === 'Tous' || a.category === cat;
      const matchQ   = !q
        || a.title.toLowerCase().includes(q)
        || a.summary.toLowerCase().includes(q)
        || a.authorName.toLowerCase().includes(q)
        || a.tags?.some(t => t.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  });

  uniqueAuthorsCount = computed(() =>
    new Set(this.articles().map(a => a.authorName)).size
  );

  totalViews = computed(() =>
    this.articles().reduce((sum, a) => sum + (a.views ?? 0), 0)
  );

  avgReadTime = computed(() => {
    const list = this.articles();
    if (!list.length) return 0;
    const total = list.reduce((sum, a) => sum + (a.readTimeMinutes ?? 1), 0);
    return Math.round(total / list.length);
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.sub = this.articleService.getPublishedArticles().subscribe(data => {
      this.articles.set(data);
      this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  setCategory(cat: ArticleCategory | 'Tous'): void {
    this.activeCategory.set(cat);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.activeCategory.set('Tous');
  }

  goToArticle(id: string): void {
    this.router.navigate(['/articles', id]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getCategoryIcon(cat: string): string {
    return this.categoryIcons[cat] ?? 'fa-tag';
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(date);
  }
}
