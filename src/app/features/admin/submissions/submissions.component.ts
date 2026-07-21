// submissions.component.ts - Version améliorée
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { AiService, SubmissionSummary } from '../../../core/services/ai.service';
import { ThemeSubmission } from '../../../core/model/models';
import { ToastService } from '../../../core/services/toast.service';
import { TiltSpotlightDirective } from '../../../core/directives/tilt-spotlight.directive';

type FilterType = 'all' | 'en attente' | 'approuvé' | 'refusé';

@Component({
  selector: 'app-submissions',
  standalone: true,
  imports: [CommonModule, FormsModule, TiltSpotlightDirective],
  templateUrl: './submissions.component.html',
  styleUrls: ['./submissions.component.scss'],
})
export class SubmissionsComponent {
  private themeService = inject(ThemeService);
  private aiService = inject(AiService);
  private toast = inject(ToastService);

  allSubmissions = signal<ThemeSubmission[]>([]);
  activeFilter = signal<FilterType>('en attente');
  processingId = signal<string | null>(null);
  commentText = signal<Record<string, string>>({});

  summaries = signal<Record<string, SubmissionSummary>>({});
  summaryLoading = signal<Record<string, boolean>>({});
  summaryError = signal<Record<string, string>>({});
  summaryExpanded = signal<Record<string, boolean>>({});

  private subscription: Subscription | null = null;

  filters = [
    { value: 'en attente' as FilterType, label: 'En attente', icon: 'fa-clock' },
    { value: 'approuvé' as FilterType, label: 'Approuvées', icon: 'fa-check-circle' },
    { value: 'refusé' as FilterType, label: 'Refusées', icon: 'fa-times-circle' },
    { value: 'all' as FilterType, label: 'Toutes', icon: 'fa-list' },
  ];

  filteredSubmissions = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.allSubmissions();
    return this.allSubmissions().filter(s => s.status === filter);
  });

  pendingCount = computed(() =>
    this.allSubmissions().filter(s => s.status === 'en attente').length
  );

  constructor() {
    this.subscription = this.themeService.getSubmissions().subscribe(subs => {
      this.allSubmissions.set(subs);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'en attente': 'warning',
      'approuvé': 'success',
      'refusé': 'danger',
    };
    return map[status] || 'neutral';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      'en attente': 'fa-hourglass-half',
      'approuvé': 'fa-check-circle',
      'refusé': 'fa-times-circle',
    };
    return map[status] || 'fa-circle';
  }

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  updateComment(id: string, value: string): void {
    this.commentText.update(prev => ({ ...prev, [id]: value }));
  }

  async analyzeSummary(sub: ThemeSubmission): Promise<void> {
    const id = sub.id!;

    if (this.summaries()[id]) {
      this.summaryExpanded.update(prev => ({ ...prev, [id]: !prev[id] }));
      return;
    }

    this.summaryLoading.update(prev => ({ ...prev, [id]: true }));
    this.summaryError.update(prev => ({ ...prev, [id]: '' }));

    try {
      const result = await this.aiService.summarizeSubmission({
        proposedTitle: sub.proposedTitle,
        category: sub.category,
        description: sub.description,
        objectives: sub.objectives,
        prerequisites: sub.prerequisites ?? '',
        materialsNeeded: sub.materialsNeeded ?? '',
        estimatedDuration: sub.estimatedDuration,
        studentName: sub.studentName,
        promo: sub.promo,
      });

      this.summaries.update(prev => ({ ...prev, [id]: result }));
      this.summaryExpanded.update(prev => ({ ...prev, [id]: true }));

      if (!this.commentText()[id]) {
        this.updateComment(id, result.suggestion_commentaire);
      }

      this.toast.success('Analyse IA terminée');
    } catch {
      this.summaryError.update(prev => ({
        ...prev,
        [id]: 'Analyse indisponible. Veuillez réessayer.',
      }));
      this.toast.error('Erreur lors de l\'analyse IA');
    } finally {
      this.summaryLoading.update(prev => ({ ...prev, [id]: false }));
    }
  }

  getSummary(id: string): SubmissionSummary | null {
    return this.summaries()[id] ?? null;
  }

  isSummaryLoading(id: string): boolean {
    return this.summaryLoading()[id] ?? false;
  }

  isSummaryExpanded(id: string): boolean {
    return this.summaryExpanded()[id] ?? false;
  }

  getSummaryError(id: string): string {
    return this.summaryError()[id] ?? '';
  }

  getVerdictClass(verdict: string): string {
    const map: Record<string, string> = {
      fort: 'verdict--fort',
      moyen: 'verdict--moyen',
      faible: 'verdict--faible',
    };
    return map[verdict] || '';
  }

  getVerdictIcon(verdict: string): string {
    const map: Record<string, string> = {
      fort: 'fa-check-circle',
      moyen: 'fa-chart-line',
      faible: 'fa-exclamation-triangle',
    };
    return map[verdict] || 'fa-circle';
  }

  async approve(sub: ThemeSubmission): Promise<void> {
    this.processingId.set(sub.id!);
    try {
      await this.themeService.approveSubmission(sub, this.commentText()[sub.id!] ?? '');
      this.toast.success('Soumission approuvée et publiée');
    } catch {
      this.toast.error('Erreur lors de l\'approbation');
    } finally {
      this.processingId.set(null);
    }
  }

  async refuse(sub: ThemeSubmission): Promise<void> {
    const comment = this.commentText()[sub.id!] ?? '';
    if (!comment.trim()) {
      const confirm = window.confirm('Aucun commentaire. Confirmer le refus ?');
      if (!confirm) return;
    }

    this.processingId.set(sub.id!);
    try {
      await this.themeService.refuseSubmission(sub, comment);
      this.toast.info('Soumission refusée');
    } catch {
      this.toast.error('Erreur lors du refus');
    } finally {
      this.processingId.set(null);
    }
  }
    getFilterCount(filter: FilterType): number {
    switch (filter) {
      case 'en attente':
        return this.allSubmissions().filter(s => s.status === 'en attente').length;
      case 'approuvé':
        return this.allSubmissions().filter(s => s.status === 'approuvé').length;
      case 'refusé':
        return this.allSubmissions().filter(s => s.status === 'refusé').length;
      case 'all':
        return this.allSubmissions().length;
      default:
        return 0;
    }
  }

  // ✅ Obtenir la classe CSS du compteur selon le type
  getFilterCountClass(filter: FilterType): string {
    switch (filter) {
      case 'en attente':
        return 'count-pending';
      case 'approuvé':
        return 'count-approved';
      case 'refusé':
        return 'count-refused';
      case 'all':
        return 'count-all';
      default:
        return '';
    }
  }
}
