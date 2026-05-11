import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeSubmission } from '../../../core/model/models';

@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-submissions.component.html',
  styleUrls: ['./my-submissions.component.scss']
})
export class MySubmissionsComponent {
  private themeService = inject(ThemeService);
  private authService  = inject(AuthService);

  submissions        = signal<ThemeSubmission[]>([]);
  loading            = signal(true);
  selectedSubmission = signal<ThemeSubmission | null>(null);
  drawerOpen         = signal(false);

  constructor() {
    const userId = this.authService.currentUser?.uid;
    if (userId) {
      this.themeService.getMySubmissions(userId)
        .pipe(takeUntilDestroyed())
        .subscribe(submissions => {
          this.submissions.set(submissions);
          this.loading.set(false);
        });
    }
  }

  openSubmissionDetail(submission: ThemeSubmission): void {
    this.selectedSubmission.set(submission);
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => { this.selectedSubmission.set(null); document.body.style.overflow = ''; }, 300);
  }

  getStatusIcon(status: string): string {
    return ({ 'en attente': '⏳', 'approuvé': '✓', 'refusé': '✕' } as any)[status] ?? '●';
  }
  getBadgeClass(status: string): string {
    return ({ 'en attente': 'badge--warning', 'approuvé': 'badge--success', 'refusé': 'badge--danger' } as any)[status] ?? 'badge--neutral';
  }
}
