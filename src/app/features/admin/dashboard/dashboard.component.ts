// dashboard.component.ts
import { Component, inject, signal, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { AuthService } from '../../../core/services/auth.service';
import { ActivityService } from '../../../core/services/activity.service';
import { combineLatest, map } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private themeService = inject(ThemeService);
  private workshopService = inject(WorkshopService);
  private authService = inject(AuthService);
  private activityService = inject(ActivityService);

  @ViewChild('activityChart') activityChartRef!: ElementRef;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef;

  stats = signal({
    totalThemes: 0,
    totalWorkshops: 0,
    totalMembers: 0,
    totalRegistrations: 0,
    pendingSubmissions: 0,
    approvedSubmissions: 0,
    refusedSubmissions: 0,
    confirmedPresences: 0,
    themesGrowth: 12,
    workshopsGrowth: 8,
    membersGrowth: 15,
    registrationsGrowth: 23,
  });

  recentWorkshops = signal<any[]>([]);
  pendingSubmissionsList = signal<any[]>([]);
  loading = signal(true);

  monthlyData = signal<{ month: string; workshops: number; registrations: number }[]>([]);
  categoryData = signal<{ category: string; count: number }[]>([]);

  get adminName(): string {
    return this.authService.currentUser?.displayName || 'Administrateur';
  }

  get currentDate(): Date {
    return new Date();
  }

  pendingPercentage(): number {
    const total = this.stats().pendingSubmissions + this.stats().approvedSubmissions + this.stats().refusedSubmissions;
    if (total === 0) return 0;
    return (this.stats().pendingSubmissions / total) * 100;
  }

  participationRate(): number {
    if (this.stats().totalRegistrations === 0) return 0;
    return Math.round((this.stats().confirmedPresences / this.stats().totalRegistrations) * 100);
  }

  ngOnInit(): void {
    combineLatest([
      this.themeService.getThemes(),
      this.workshopService.getWorkshops(),
      this.themeService.getSubmissions(),
      this.activityService.getPublishedActivities(),
    ]).pipe(
      map(([themes, workshops, submissions, activities]) => {
        const totalRegistrations = workshops.reduce(
          (sum, ws) => sum + (ws.registrations?.length || 0), 0
        );

        const pendingSubmissions = submissions.filter(s => s.status === 'en attente');
        const approvedSubmissions = submissions.filter(s => s.status === 'approuvé');
        const refusedSubmissions = submissions.filter(s => s.status === 'refusé');

        // Calculer les présences confirmées
        let confirmedPresences = 0;
        // À implémenter selon votre logique de présence

        const recent = [...workshops]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 5);

        const pending = pendingSubmissions.slice(0, 5);

        // Données mensuelles pour le graphique
        const monthlyMap = new Map<string, { workshops: number; registrations: number }>();
        const last6Months = this.getLast6Months();

        workshops.forEach(ws => {
          const monthKey = ws.date.toLocaleString('fr', { month: 'short', year: 'numeric' });
          const current = monthlyMap.get(monthKey) || { workshops: 0, registrations: 0 };
          current.workshops++;
          monthlyMap.set(monthKey, current);
        });

        // Catégories
        const categoryMap = new Map<string, number>();
        themes.forEach(theme => {
          const count = categoryMap.get(theme.category) || 0;
          categoryMap.set(theme.category, count + 1);
        });

        const categoryData = Array.from(categoryMap.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          stats: {
            totalThemes: themes.length,
            totalWorkshops: workshops.length,
            totalMembers: 48, // À connecter avec votre service d'auth
            totalRegistrations,
            pendingSubmissions: pendingSubmissions.length,
            approvedSubmissions: approvedSubmissions.length,
            refusedSubmissions: refusedSubmissions.length,
            confirmedPresences,
            themesGrowth: 12,
            workshopsGrowth: 8,
            membersGrowth: 15,
            registrationsGrowth: 23,
          },
          recentWorkshops: recent,
          pendingSubmissionsList: pending,
          monthlyData: Array.from(monthlyMap.entries()).map(([month, data]) => ({
            month,
            workshops: data.workshops,
            registrations: data.registrations,
          })),
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
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 500);
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

  private initCharts(): void {
    // Activity Chart
    if (this.activityChartRef) {
      const months = this.monthlyData().map(d => d.month);
      const workshops = this.monthlyData().map(d => d.workshops);
      const registrations = this.monthlyData().map(d => d.registrations);

      new Chart(this.activityChartRef.nativeElement, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Workshops',
              data: workshops,
              borderColor: '#00d4ff',
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              tension: 0.4,
              fill: true,
            },
            {
              label: 'Inscriptions',
              data: registrations,
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
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8' },
            },
            x: {
              grid: { display: false },
              ticks: { color: '#64748b' },
            },
          },
        },
      });
    }

    // Category Chart
    if (this.categoryChartRef && this.categoryData().length > 0) {
      new Chart(this.categoryChartRef.nativeElement, {
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
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', font: { size: 11 } },
            },
          },
        },
      });
    }
  }
}
