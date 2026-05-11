import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from '../../../core/services/theme.service';
import {
  AiService,
  SubmissionSummary,
} from '../../../core/services/ai.service';
import { ThemeSubmission } from '../../../core/model/models';

type FilterType = 'all' | 'en attente' | 'approuvé' | 'refusé';

@Component({
  selector: 'app-submissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './submissions.component.html',
  styleUrls: ['./submissions.component.scss'],
})
export class SubmissionsComponent {
  private themeService = inject(ThemeService);
  private aiService = inject(AiService);

  allSubmissions = signal<ThemeSubmission[]>([]);
  activeFilter = signal<FilterType>('en attente');
  processingId = signal<string | null>(null);
  commentText = signal<{ [key: string]: string }>({});

  summaries = signal<Record<string, SubmissionSummary>>({});
  summaryLoading = signal<Record<string, boolean>>({});
  summaryError = signal<Record<string, string>>({});
  summaryExpanded = signal<Record<string, boolean>>({});

  filters: { value: FilterType; label: string }[] = [
    { value: 'en attente', label: 'En attente' },
    { value: 'approuvé', label: 'Approuvées' },
    { value: 'refusé', label: 'Refusées' },
    { value: 'all', label: 'Toutes' },
  ];

  filteredSubmissions = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.allSubmissions();
    return this.allSubmissions().filter((s) => s.status === filter);
  });

  pendingCount = computed(
    () => this.allSubmissions().filter((s) => s.status === 'en attente').length,
  );

  constructor() {
    this.themeService
      .getSubmissions()
      .pipe(takeUntilDestroyed())
      .subscribe((subs) => this.allSubmissions.set(subs));
  }

  setFilter(f: FilterType): void {
    this.activeFilter.set(f);
  }

  updateComment(id: string, value: string): void {
    this.commentText.update((prev) => ({ ...prev, [id]: value }));
  }

  async analyzeSummary(sub: ThemeSubmission): Promise<void> {
    const id = sub.id!;

    if (this.summaries()[id]) {
      this.summaryExpanded.update((p) => ({ ...p, [id]: !p[id] }));
      return;
    }

    this.summaryLoading.update((p) => ({ ...p, [id]: true }));
    this.summaryError.update((p) => ({ ...p, [id]: '' }));

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

      this.summaries.update((p) => ({ ...p, [id]: result }));
      this.summaryExpanded.update((p) => ({ ...p, [id]: true }));

      if (!this.commentText()[id]) {
        this.updateComment(id, result.suggestion_commentaire);
      }
    } catch {
      this.summaryError.update((p) => ({
        ...p,
        [id]: 'Analyse indisponible. Réessaie.',
      }));
    } finally {
      this.summaryLoading.update((p) => ({ ...p, [id]: false }));
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

  getVerdictClass(v: string): string {
    return (
      (
        {
          fort: 'verdict--fort',
          moyen: 'verdict--moyen',
          faible: 'verdict--faible',
        } as any
      )[v] ?? ''
    );
  }
  getVerdictIcon(v: string): string {
    return ({ fort: '🟢', moyen: '🟡', faible: '🔴' } as any)[v] ?? '⚪';
  }

  async approve(sub: ThemeSubmission): Promise<void> {
    this.processingId.set(sub.id!);
    try {
      await this.themeService.approveSubmission(
        sub,
        this.commentText()[sub.id!] ?? '',
      );
    } finally {
      this.processingId.set(null);
    }
  }

  async refuse(sub: ThemeSubmission): Promise<void> {
    const comment = this.commentText()[sub.id!] ?? '';
    if (!comment.trim()) {
      if (!confirm('Aucun commentaire. Confirmer le refus ?')) return;
    }
    this.processingId.set(sub.id!);
    try {
      await this.themeService.refuseSubmission(sub.id!, comment);
    } finally {
      this.processingId.set(null);
    }
  }

  getStatusBadgeClass(status: string): string {
    return (
      (
        {
          'en attente': 'badge--warning',
          approuvé: 'badge--success',
          refusé: 'badge--danger',
        } as any
      )[status] ?? ''
    );
  }
  getStatusIcon(status: string): string {
    return (
      ({ 'en attente': '⏳', approuvé: '✓', refusé: '✕' } as any)[status] ?? '●'
    );
  }
}
