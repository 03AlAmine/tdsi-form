import { Component, inject, signal, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ActivityService } from '../../../core/services/activity.service';
import { combineLatest, map, Subscription } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private themeService    = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService     = inject(AuthService);
  private activityService = inject(ActivityService);
  private userSvc         = inject(UserService);
  private logger          = inject(LoggerService);

  @ViewChild('activityChart') activityChartRef!: ElementRef;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef;

  // ✅ Instances Chart stockées pour pouvoir les détruire dans ngOnDestroy
  private activityChart: Chart | null = null;
  private categoryChart: Chart | null = null;
  private dataSub: Subscription | null = null;

  stats = signal({
    totalThemes: 0, totalWorkshops: 0, totalMembers: 0,
    totalRegistrations: 0, pendingSubmissions: 0,
    approvedSubmissions: 0, refusedSubmissions: 0,
    confirmedPresences: 0,
    themesGrowth: 12, workshopsGrowth: 8, membersGrowth: 15, registrationsGrowth: 23,
  });

  recentWorkshops       = signal<any[]>([]);
  pendingSubmissionsList = signal<any[]>([]);
  loading               = signal(true);
  monthlyData           = signal<{ month: string; workshops: number; registrations: number }[]>([]);
  categoryData          = signal<{ category: string; count: number }[]>([]);

  get adminName(): string { return this.authService.currentUser?.displayName || 'Administrateur'; }
  get currentDate(): Date { return new Date(); }

  pendingPercentage(): number {
    const total = this.stats().pendingSubmissions + this.stats().approvedSubmissions + this.stats().refusedSubmissions;
    return total === 0 ? 0 : (this.stats().pendingSubmissions / total) * 100;
  }

  participationRate(): number {
    if (this.stats().totalRegistrations === 0) return 0;
    return Math.round((this.stats().confirmedPresences / this.stats().totalRegistrations) * 100);
  }

  // ── Lifecycle ─────────────────────────────────────────────
  ngOnInit(): void {
    this.dataSub = combineLatest([
      this.themeService.getThemes(),
      this.workshopService.getWorkshops(),
      this.themeService.getSubmissions(),
      this.activityService.getPublishedActivities(),
    ]).pipe(
      map(([themes, workshops, submissions]) => {
        const totalRegistrations = workshops.reduce(
          (sum, ws) => sum + (ws.registrations?.length || 0), 0
        );
        const pendingSubmissions  = submissions.filter(s => s.status === 'en attente');
        const approvedSubmissions = submissions.filter(s => s.status === 'approuvé');
        const refusedSubmissions  = submissions.filter(s => s.status === 'refusé');

        const recent  = [...workshops].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
        const pending = pendingSubmissions.slice(0, 5);

        const monthlyMap = new Map<string, { workshops: number; registrations: number }>();
        workshops.forEach(ws => {
          const key  = ws.date.toLocaleString('fr', { month: 'short', year: 'numeric' });
          const curr = monthlyMap.get(key) || { workshops: 0, registrations: 0 };
          curr.workshops++;
          monthlyMap.set(key, curr);
        });

        // ✅ Catégories calculées depuis les vrais thèmes — plus de données mockées
        const categoryMap = new Map<string, number>();
        themes.forEach(t => categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1));
        const categoryData = Array.from(categoryMap.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          stats: {
            totalThemes: themes.length, totalWorkshops: workshops.length,
            totalMembers: 0, // chargé séparément via UserService.getUserCount()
            totalRegistrations,
            pendingSubmissions:  pendingSubmissions.length,
            approvedSubmissions: approvedSubmissions.length,
            refusedSubmissions:  refusedSubmissions.length,
            confirmedPresences: 0,
            themesGrowth: 12, workshopsGrowth: 8, membersGrowth: 15, registrationsGrowth: 23,
          },
          recentWorkshops: recent,
          pendingSubmissionsList: pending,
          monthlyData: Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data })),
          categoryData,
        };
      })
    ).subscribe({
      next: (data) => {
        this.stats.set(data.stats);
        this.recentWorkshops.set(data.recentWorkshops);
        this.pendingSubmissionsList.set(data.pendingSubmissionsList);
        this.monthlyData.set(data.monthlyData);
        this.categoryData.set(data.categoryData);
        this.loading.set(false);
        // Mettre à jour les charts avec les nouvelles données si déjà initialisés
        this.updateCharts();
      },
      error: (err) => {
        this.logger.error('[Dashboard] Erreur chargement:', err);
        this.loading.set(false);
      },
    });

    // Charger le vrai nombre de membres séparément (appel one-shot)
    this.userSvc.getUserCount().then(count => {
      this.stats.update(s => ({ ...s, totalMembers: count }));
    }).catch(err => this.logger.error('[Dashboard] Erreur getUserCount:', err));
  }

  ngAfterViewInit(): void {
    // ✅ Pas de setTimeout — le ViewChild est garanti disponible ici
    this.initCharts();
  }

  ngOnDestroy(): void {
    // ✅ CORRECTION CRITIQUE : détruire les instances Chart avant que le composant soit supprimé
    // Sans ça, chaque navigation recréait de nouvelles instances sur le même canvas
    this.activityChart?.destroy();
    this.categoryChart?.destroy();
    this.activityChart = null;
    this.categoryChart = null;
    this.dataSub?.unsubscribe();
  }

  // ── Charts ────────────────────────────────────────────────
  private initCharts(): void {
    if (this.activityChartRef?.nativeElement) {
      this.activityChart?.destroy();
      this.activityChart = new Chart(this.activityChartRef.nativeElement, {
        type: 'line',
        data: {
          labels: this.monthlyData().map(d => d.month),
          datasets: [
            {
              label: 'Workshops',
              data: this.monthlyData().map(d => d.workshops),
              borderColor: '#00d4ff',
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              tension: 0.4, fill: true,
            },
            {
              label: 'Inscriptions',
              data: this.monthlyData().map(d => d.registrations),
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              tension: 0.4, fill: true,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#64748b' } },
          },
        },
      });
    }

    if (this.categoryChartRef?.nativeElement && this.categoryData().length > 0) {
      this.categoryChart?.destroy();
      this.categoryChart = new Chart(this.categoryChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.categoryData().map(d => d.category),
          datasets: [{
            data: this.categoryData().map(d => d.count),
            backgroundColor: ['#00d4ff', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } },
        },
      });
    }
  }

  /** Met à jour les datasets Chart.js sans recréer le canvas */
  private updateCharts(): void {
    if (this.activityChart) {
      this.activityChart.data.labels = this.monthlyData().map(d => d.month);
      this.activityChart.data.datasets[0].data = this.monthlyData().map(d => d.workshops);
      this.activityChart.data.datasets[1].data = this.monthlyData().map(d => d.registrations);
      this.activityChart.update('none'); // 'none' = pas d'animation au refresh
    }
    if (this.categoryChart && this.categoryData().length > 0) {
      this.categoryChart.data.labels = this.categoryData().map(d => d.category);
      this.categoryChart.data.datasets[0].data = this.categoryData().map(d => d.count);
      this.categoryChart.update('none');
    }
  }

  private getLast6Months(): string[] {
    const months = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      months.push(d.toLocaleString('fr', { month: 'short', year: 'numeric' }));
    }
    return months;
  }
}
