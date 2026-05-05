import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../../core/services/theme.service';
import { ThemeSubmission } from '../../../core/model/models';

type FilterType = 'all' | 'en attente' | 'approuvé' | 'refusé';

@Component({
  selector: 'app-submissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './submissions.component.html',
  styleUrls: ['./submissions.component.scss']
})
export class SubmissionsComponent {
  private themeService = inject(ThemeService);

  allSubmissions = signal<ThemeSubmission[]>([]);
  activeFilter = signal<FilterType>('en attente');
  processingId = signal<string | null>(null);
  commentText = signal<{ [key: string]: string }>({});

  filters: { value: FilterType; label: string }[] = [
    { value: 'en attente', label: 'En attente' },
    { value: 'approuvé', label: 'Approuvées' },
    { value: 'refusé', label: 'Refusées' },
    { value: 'all', label: 'Toutes' }
  ];

  // Computed filtered submissions
  filteredSubmissions = computed(() => {
    const submissions = this.allSubmissions();
    const filter = this.activeFilter();

    if (filter === 'all') return submissions;
    return submissions.filter(s => s.status === filter);
  });

  // Computed pending count
  pendingCount = computed(() => {
    return this.allSubmissions().filter(s => s.status === 'en attente').length;
  });

  constructor() {
    // Load submissions
    this.themeService.getSubmissions().subscribe(submissions => {
      this.allSubmissions.set(submissions);
    });
  }

  setFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
  }

  updateComment(subId: string, comment: string): void {
    this.commentText.update(prev => ({ ...prev, [subId]: comment }));
  }

  async approve(sub: ThemeSubmission): Promise<void> {
    this.processingId.set(sub.id!);
    try {
      const comment = this.commentText()[sub.id!] || '';
      await this.themeService.approveSubmission(sub, comment);
    } finally {
      this.processingId.set(null);
    }
  }

  async refuse(sub: ThemeSubmission): Promise<void> {
    const comment = this.commentText()[sub.id!] || '';

    if (!comment.trim()) {
      const confirmed = confirm('Aucun commentaire saisi. Confirmer le refus sans explication ?');
      if (!confirmed) return;
    }

    this.processingId.set(sub.id!);
    try {
      await this.themeService.refuseSubmission(sub.id!, comment);
    } finally {
      this.processingId.set(null);
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'en attente': return 'badge--warning';
      case 'approuvé': return 'badge--success';
      case 'refusé': return 'badge--danger';
      default: return 'badge--neutral';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'en attente': return '⏳';
      case 'approuvé': return '✓';
      case 'refusé': return '✕';
      default: return '●';
    }
  }
}
