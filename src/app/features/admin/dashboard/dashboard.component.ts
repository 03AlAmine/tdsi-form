import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { combineLatest, map } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);

  stats = signal({
    totalThemes: 0,
    totalWorkshops: 0,
    pendingSubmissions: 0,
    totalRegistrations: 0
  });

  recentWorkshops = signal<any[]>([]);
  pendingSubmissionsList = signal<any[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    combineLatest([
      this.themeService.getThemes(),
      this.workshopService.getWorkshops(),
      this.themeService.getSubmissions()
    ]).pipe(
      map(([themes, workshops, submissions]) => {
        const totalRegistrations = workshops.reduce((sum, ws) => sum + (ws.registrations?.length || 0), 0);
        const pendingSubmissions = submissions.filter(s => s.status === 'en attente');
        const recent = [...workshops].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
        const pending = pendingSubmissions.slice(0, 5);

        return {
          stats: {
            totalThemes: themes.length,
            totalWorkshops: workshops.length,
            pendingSubmissions: pendingSubmissions.length,
            totalRegistrations
          },
          recentWorkshops: recent,
          pendingSubmissionsList: pending
        };
      })
    ).subscribe({
      next: (data) => {
        this.stats.set(data.stats);
        this.recentWorkshops.set(data.recentWorkshops);
        this.pendingSubmissionsList.set(data.pendingSubmissionsList);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }
}
