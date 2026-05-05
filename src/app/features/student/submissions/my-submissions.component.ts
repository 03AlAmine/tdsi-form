import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
export class MySubmissionsComponent implements OnInit {
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);

  submissions = signal<ThemeSubmission[]>([]);
  loading = signal(true);
  selectedSubmission = signal<ThemeSubmission | null>(null);
  drawerOpen = signal(false);

  ngOnInit(): void {
    const userId = this.authService.currentUser?.uid;
    if (userId) {
      this.themeService.getMySubmissions(userId).subscribe(submissions => {
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
    setTimeout(() => {
      this.selectedSubmission.set(null);
      document.body.style.overflow = '';
    }, 300);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'en attente': return '⏳';
      case 'approuvé': return '✓';
      case 'refusé': return '✕';
      default: return '●';
    }
  }

  getBadgeClass(status: string): string {
    switch (status) {
      case 'en attente': return 'badge--warning';
      case 'approuvé': return 'badge--success';
      case 'refusé': return 'badge--danger';
      default: return 'badge--neutral';
    }
  }
}
