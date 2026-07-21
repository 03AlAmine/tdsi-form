// features/admin/articles/admin-articles.component.ts
import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ArticleService } from '../../../core/services/article.service';
import { Article } from '../../../core/model/article.model';
import { ToastService } from '../../../core/services/toast.service';
import { TiltSpotlightDirective } from '../../../core/directives/tilt-spotlight.directive';

type Filter = 'en attente' | 'approuvé' | 'refusé' | 'all';

@Component({
  selector: 'app-admin-articles',
  standalone: true,
  imports: [CommonModule, FormsModule, TiltSpotlightDirective],
  templateUrl: './admin-articles.component.html',
  styleUrls: ['./admin-articles.component.scss'],
})
export class AdminArticlesComponent implements OnDestroy {
  private articleService = inject(ArticleService);
  private toast = inject(ToastService);

  articles = signal<Article[]>([]);
  activeFilter = signal<Filter>('en attente');
  processingId = signal<string | null>(null);
  commentText = signal<Record<string, string>>({});
  expandedId = signal<string | null>(null);
  private sub: Subscription;

  filters: { value: Filter; label: string; icon: string }[] = [
    { value: 'en attente', label: 'En attente', icon: 'fa-clock' },
    { value: 'approuvé',   label: 'Approuvés',  icon: 'fa-check-circle' },
    { value: 'refusé',     label: 'Refusés',    icon: 'fa-times-circle' },
    { value: 'all',        label: 'Tous',       icon: 'fa-list' },
  ];

  filtered = computed(() => {
    const f = this.activeFilter();
    return f === 'all' ? this.articles() : this.articles().filter(a => a.status === f);
  });

  pendingCount = computed(() => this.articles().filter(a => a.status === 'en attente').length);

  constructor() {
    this.sub = this.articleService.getAllArticles().subscribe(data => {
      this.articles.set(data);
    });
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  setFilter(f: Filter): void { this.activeFilter.set(f); }

  countFor(f: Filter): number {
    if (f === 'all') return this.articles().length;
    return this.articles().filter(a => a.status === f).length;
  }

  toggleExpand(id: string): void {
    this.expandedId.update(cur => cur === id ? null : id);
  }

  updateComment(id: string, value: string): void {
    this.commentText.update(prev => ({ ...prev, [id]: value }));
  }

  getStatusClass(s: string): string {
    return { 'en attente': 'warning', 'approuvé': 'success', 'refusé': 'danger' }[s] ?? 'neutral';
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  async approve(article: Article): Promise<void> {
    this.processingId.set(article.id!);
    try {
      await this.articleService.approveArticle(article.id!, this.commentText()[article.id!] ?? '');
      this.toast.success('Article approuvé et publié');
    } catch {
      this.toast.error('Erreur lors de l\'approbation');
    } finally {
      this.processingId.set(null);
    }
  }

  async refuse(article: Article): Promise<void> {
    const comment = this.commentText()[article.id!] ?? '';
    if (!comment.trim()) {
      if (!window.confirm('Aucun commentaire. Confirmer le refus ?')) return;
    }
    this.processingId.set(article.id!);
    try {
      await this.articleService.refuseArticle(article.id!, comment);
      this.toast.info('Article refusé');
    } catch {
      this.toast.error('Erreur lors du refus');
    } finally {
      this.processingId.set(null);
    }
  }

  async remove(article: Article): Promise<void> {
    if (!window.confirm(`Supprimer définitivement "${article.title}" ?`)) return;
    try {
      await this.articleService.deleteArticle(article.id!);
      this.toast.success('Article supprimé');
    } catch {
      this.toast.error('Erreur lors de la suppression');
    }
  }
}
