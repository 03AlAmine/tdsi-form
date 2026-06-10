import { Component, inject, signal, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { UserService } from '../../../core/services/user.service';
import { LoggerService } from '../../../core/services/logger.service';
import { firstValueFrom } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
})
export class AnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  private themeService    = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private userSvc         = inject(UserService);
  private logger          = inject(LoggerService);

  @ViewChild('activityChart') activityChartRef!: ElementRef;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef;

  // ✅ Instances stockées pour destruction dans ngOnDestroy
  private activityChart: Chart | null = null;
  private categoryChart: Chart | null = null;

  loading   = signal(true);
  dateRange = signal(30);
  Math      = Math;

  kpis = signal({
    totalUsers: 0, totalWorkshops: 0, totalRegistrations: 0,
    participationRate: 0,
    userGrowth: 12, workshopGrowth: 8, registrationGrowth: 23, participationTrend: 5,
  });

  popularTopics      = signal<{ name: string; count: number; percentage: number }[]>([]);
  recentActivities   = signal<{ id: string; title: string; type: string; date: Date }[]>([]);

  private monthlyData = signal<{ month: string; workshops: number; registrations: number }[]>([]);
  private categoryData = signal<{ category: string; count: number }[]>([]);

  // ── Lifecycle ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> { await this.loadData(); }

  ngAfterViewInit(): void {
    // ✅ Pas de setTimeout — ViewChild garanti disponible ici
    this.initCharts();
  }

  ngOnDestroy(): void {
    // ✅ CORRECTION CRITIQUE : détruire les 2 instances avant démontage
    this.activityChart?.destroy();
    this.categoryChart?.destroy();
    this.activityChart = null;
    this.categoryChart = null;
  }

  // ── Data ──────────────────────────────────────────────────
  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      // ✅ firstValueFrom() remplace .toPromise() déprécié
      // firstValueFrom() prend la 1ère émission et complete automatiquement
      const [totalUsers, workshops, themes] = await Promise.all([
        this.userSvc.getUserCount(),
        firstValueFrom(this.workshopService.getWorkshops()),
        firstValueFrom(this.themeService.getThemes()),
      ]);

      const totalWorkshops    = workshops.length;
      const totalRegistrations = workshops.reduce((sum, w) => sum + (w.registrations?.length || 0), 0);
      const participationRate  = totalUsers > 0
        ? Math.round((totalRegistrations / totalUsers) * 100)
        : 0;

      this.kpis.update(k => ({ ...k, totalUsers, totalWorkshops, totalRegistrations, participationRate }));

      // ── Données mensuelles ────────────────────────────────
      const monthlyMap = new Map<string, { workshops: number; registrations: number }>();
      workshops.forEach(ws => {
        const key  = ws.date.toLocaleString('fr', { month: 'short', year: 'numeric' });
        const curr = monthlyMap.get(key) || { workshops: 0, registrations: 0 };
        curr.workshops++;
        curr.registrations += ws.registrations?.length || 0;
        monthlyMap.set(key, curr);
      });
      this.monthlyData.set(
        Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data }))
      );

      // ✅ Catégories calculées depuis les vrais thèmes — plus de données mockées
      const categoryMap = new Map<string, number>();
      themes.forEach(t => categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1));

      // Croiser avec les workshops pour compter les workshops par catégorie
      workshops.forEach(ws => {
        const theme = themes.find(t => t.id === ws.themeId);
        if (theme) {
          categoryMap.set(theme.category, (categoryMap.get(theme.category) ?? 0));
        }
      });

      const catData = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      this.categoryData.set(catData);

      const maxCount = Math.max(...catData.map(c => c.count), 1);
      this.popularTopics.set(catData.map(c => ({
        name: c.category,
        count: c.count,
        percentage: Math.round((c.count / maxCount) * 100),
      })));

      // Activités récentes basées sur les vrais workshops
      this.recentActivities.set(
        [...workshops]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 5)
          .map(ws => ({
            id:    ws.id ?? '',
            title: ws.themeTitle,
            type:  'workshop',
            date:  ws.date,
          }))
      );

      // Mettre à jour les charts si déjà initialisés
      this.updateCharts();

    } catch (err) {
      this.logger.error('[Analytics] Erreur chargement:', err);
    } finally {
      this.loading.set(false);
    }
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

    if (this.categoryChartRef?.nativeElement) {
      this.categoryChart?.destroy();
      this.categoryChart = new Chart(this.categoryChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.categoryData().map(c => c.category),
          datasets: [{
            data: this.categoryData().map(c => c.count),
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

  private updateCharts(): void {
    if (this.activityChart) {
      this.activityChart.data.labels = this.monthlyData().map(d => d.month);
      this.activityChart.data.datasets[0].data = this.monthlyData().map(d => d.workshops);
      this.activityChart.data.datasets[1].data = this.monthlyData().map(d => d.registrations);
      this.activityChart.update('none');
    }
    if (this.categoryChart && this.categoryData().length > 0) {
      this.categoryChart.data.labels = this.categoryData().map(c => c.category);
      this.categoryChart.data.datasets[0].data = this.categoryData().map(c => c.count);
      this.categoryChart.update('none');
    }
  }

  // ── Actions ───────────────────────────────────────────────
  setDateRange(days: string): void {
    this.dateRange.set(parseInt(days, 10));
    this.loadData();
  }

  exportData(format: 'csv' | 'pdf'): void {
    if (format === 'csv') {
      const rows = [
        ['Catégorie', 'Nombre'],
        ...this.categoryData().map(c => [c.category, String(c.count)]),
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = 'analytics-tdsi.csv';
      link.click();
      URL.revokeObjectURL(url);
    } else {
      this.logger.log('[Analytics] Export PDF — à brancher sur ConfirmationPdfService');
    }
  }
}
