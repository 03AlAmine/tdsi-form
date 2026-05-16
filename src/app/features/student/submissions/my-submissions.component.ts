// my-submissions.component.ts - Version corrigée
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeSubmission } from '../../../core/model/models';

@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-submissions.component.html',
  styleUrls: ['./my-submissions.component.scss'],
})
export class MySubmissionsComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);

  submissions = signal<ThemeSubmission[]>([]);
  loading = signal(true);
  selectedSubmission = signal<ThemeSubmission | null>(null);
  drawerOpen = signal(false);

  private subscription: Subscription | null = null;

  ngOnInit(): void {
    const userId = this.authService.currentUser?.uid;
    if (userId) {
      this.subscription = this.themeService
        .getMySubmissions(userId)
        .subscribe((submissions) => {
          this.submissions.set(submissions);
          this.loading.set(false);
        });
    } else {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    document.body.style.overflow = '';
  }

  getStats(): { pending: number; approved: number; refused: number } {
    const submissions = this.submissions();
    return {
      pending: submissions.filter((s) => s.status === 'en attente').length,
      approved: submissions.filter((s) => s.status === 'approuvé').length,
      refused: submissions.filter((s) => s.status === 'refusé').length,
    };
  }

  openSubmissionDetail(submission: ThemeSubmission): void {
    this.selectedSubmission.set(submission);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => {
      this.selectedSubmission.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  getStatusIconClass(status: string): string {
    const icons: Record<string, string> = {
      'en attente': 'fa-hourglass-half',
      approuvé: 'fa-check-circle',
      refusé: 'fa-times-circle',
    };
    return icons[status] || 'fa-circle';
  }

  getBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'en attente': 'warning',
      approuvé: 'success',
      refusé: 'danger',
    };
    return classes[status] || 'neutral';
  }

  getDifficultyLabel(difficulty: string): string {
    const labels: Record<string, string> = {
      débutant: 'Débutant',
      intermédiaire: 'Intermédiaire',
      avancé: 'Avancé',
    };
    return labels[difficulty] || 'Non spécifiée';
  }

  /**
   * Parse les objectifs - accepte string, string[] ou null/undefined
   */
  parseObjectives(objectives: string | string[] | null | undefined): string[] {
    if (!objectives) return [];

    // Si c'est déjà un tableau, le retourner directement
    if (Array.isArray(objectives)) {
      return objectives.filter(obj => obj && obj.trim().length > 0);
    }

    // Si c'est une string, la parser
    if (typeof objectives === 'string') {
      return objectives
        .split(/[.;\n]+/)
        .filter(o => o && o.trim().length > 0)
        .map(o => o.trim());
    }

    return [];
  }

  /**
   * Parse les prérequis - accepte string, string[] ou null/undefined
   */
  parsePrerequisites(prerequisites: string | string[] | null | undefined): string[] {
    if (!prerequisites) return [];

    // Si c'est déjà un tableau, le retourner directement
    if (Array.isArray(prerequisites)) {
      return prerequisites.filter(preq => preq && preq.trim().length > 0);
    }

    // Si c'est une string, la parser
    if (typeof prerequisites === 'string') {
      return prerequisites
        .split(/[;,.\n]+/)
        .filter(p => p && p.trim().length > 0)
        .map(p => p.trim());
    }

    return [];
  }

  /**
   * Parse le matériel nécessaire - accepte string, string[] ou null/undefined
   */
  parseMaterials(materials: string | string[] | null | undefined): string[] {
    if (!materials) return [];

    // Si c'est déjà un tableau, le retourner directement
    if (Array.isArray(materials)) {
      return materials.filter(mat => mat && mat.trim().length > 0);
    }

    // Si c'est une string, la parser
    if (typeof materials === 'string') {
      return materials
        .split(/[;,.\n]+/)
        .filter(m => m && m.trim().length > 0)
        .map(m => m.trim());
    }

    return [];
  }

  /**
   * Vérifie si une valeur est une chaîne
   */
  isString(value: any): boolean {
    return typeof value === 'string';
  }
}
