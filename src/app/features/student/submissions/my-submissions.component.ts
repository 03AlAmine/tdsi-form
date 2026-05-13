// my-submissions.component.ts - Version améliorée
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
