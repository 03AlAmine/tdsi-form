// analytics.component.ts
import { Component, inject, signal, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { ActivityService } from '../../../core/services/activity.service';
import { AuthService } from '../../../core/services/auth.service';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebase.config';

Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
})
export class AnalyticsComponent implements OnInit, AfterViewInit {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private activityService = inject(ActivityService);
  private authService = inject(AuthService);

  @ViewChild('activityChart') activityChartRef!: ElementRef;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef;

  loading = signal(true);
  dateRange = signal(30);
  Math = Math;

  kpis = signal({
    totalUsers: 0,
    totalWorkshops: 0,
    totalRegistrations: 0,
    participationRate: 0,
    userGrowth: 12,
    workshopGrowth: 8,
    registrationGrowth: 23,
    participationTrend: 5,
  });

  popularTopics = signal<{ name: string; count: number; percentage: number }[]>([]);
  recentActivities = signal<{ id: string; title: string; type: string; date: Date }[]>([]);

  private monthlyData = signal<{ month: string; workshops: number; registrations: number }[]>([]);
  private categoryData = signal<{ category: string; count: number }[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 500);
  }

  async loadData(): Promise<void> {
    this.loading.set(true);

    try {
      // Load users
      const usersSnap = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnap.size;

      // Load workshops
      const workshops = await this.workshopService.getWorkshops().toPromise();
      const totalWorkshops = workshops?.length || 0;

      // Load activities
      const activities = await this.activityService.getPublishedActivities().toPromise();

      // Calculate total registrations
      const totalRegistrations = workshops?.reduce((sum, w) => sum + (w.registrations?.length || 0), 0) || 0;

      // Calculate participation rate
      const participationRate = totalRegistrations > 0 ? Math.round((totalRegistrations / totalUsers) * 100) : 0;

      this.kpis.update(k => ({
        ...k,
        totalUsers,
        totalWorkshops,
        totalRegistrations,
        participationRate,
      }));

      // Generate monthly data
      const monthlyMap = new Map<string, { workshops: number; registrations: number }>();
      const last6Months = this.getLastMonths(6);

      workshops?.forEach(ws => {
        const monthKey = ws.date.toLocaleString('fr', { month: 'short', year: 'numeric' });
        const current = monthlyMap.get(monthKey) || { workshops: 0, registrations: 0 };
        current.workshops++;
        monthlyMap.set(monthKey, current);
      });

      this.monthlyData.set(Array.from(monthlyMap.entries()).map(([month, data]) => ({
        month,
        workshops: data.workshops,
        registrations: data.registrations,
      })));

      // Generate category data
      const categoryMap = new Map<string, number>();
      workshops?.forEach(ws => {
        const themeId = ws.themeId;
        // This would need theme data to map properly
        // For now using placeholder
      });

      this.categoryData.set([
        { category: 'Sécurité Réseau', count: 12 },
        { category: 'Cryptographie', count: 8 },
        { category: 'IA', count: 10 },
        { category: 'Cloud', count: 6 },
        { category: 'Web', count: 5 },
      ]);

      // Generate popular topics
      const maxCount = Math.max(...this.categoryData().map(c => c.count));
      this.popularTopics.set(this.categoryData().map(c => ({
        name: c.category,
        count: c.count,
        percentage: (c.count / maxCount) * 100,
      })));

      // Generate recent activities
      this.recentActivities.set([
        { id: '1', title: 'Nouvel utilisateur inscrit', type: 'inscription', date: new Date() },
        { id: '2', title: 'Workshop "Introduction à la Cyber" créé', type: 'workshop', date: new Date(Date.now() - 86400000) },
      ]);

    } catch {
      console.error('Error loading analytics');
    } finally {
      this.loading.set(false);
    }
  }

  private getLastMonths(count: number): string[] {
    const months = [];
    const date = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      months.push(d.toLocaleString('fr', { month: 'short', year: 'numeric' }));
    }
    return months;
  }

  private initCharts(): void {
    // Activity Chart
    if (this.activityChartRef) {
      new Chart(this.activityChartRef.nativeElement, {
        type: 'line',
        data: {
          labels: this.monthlyData().map(d => d.month),
          datasets: [
            {
              label: 'Workshops',
              data: this.monthlyData().map(d => d.workshops),
              borderColor: '#00d4ff',
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              tension: 0.4,
              fill: true,
            },
            {
              label: 'Inscriptions',
              data: this.monthlyData().map(d => d.registrations),
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#64748b' } },
          },
        },
      });
    }

    // Category Chart
    if (this.categoryChartRef) {
      new Chart(this.categoryChartRef.nativeElement, {
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
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
          },
        },
      });
    }
  }

  setDateRange(days: string): void {
    this.dateRange.set(parseInt(days));
    this.loadData();
  }

  exportData(format: 'csv' | 'pdf'): void {
    if (format === 'csv') {
      // Implement CSV export
      console.log('Exporting CSV...');
    } else {
      // Implement PDF export
      console.log('Exporting PDF...');
    }
  }
}
