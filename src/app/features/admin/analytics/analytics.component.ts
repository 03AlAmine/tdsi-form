import {
  Component, inject, signal, computed,
  OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ThemeService }    from '../../../core/services/theme.service';
import { WorkshopService } from '../../../core/services/workshop.service';
import { UserService }     from '../../../core/services/user.service';
import { LoggerService }   from '../../../core/services/logger.service';
import { User, Workshop }  from '../../../core/model/models';
import { firstValueFrom }  from 'rxjs';

Chart.register(...registerables);

interface PromoStat   { promo: string; count: number; pct: number; workshops: number; }
interface NiveauStat  { niveau: string; label: string; count: number; pct: number; color: string; }
interface TopUser     { uid: string; name: string; email: string; promo: string; total: number; }

// ── Helpers ────────────────────────────────────────────────
function parseNiveau(promo: string): string {
  const p = (promo ?? '').toUpperCase();
  if (p.startsWith('L1'))  return 'L1';
  if (p.startsWith('L2'))  return 'L2';
  if (p.startsWith('L3'))  return 'L3';
  if (p.startsWith('M1'))  return 'M1';
  if (p.startsWith('M2'))  return 'M2';
  if (p.startsWith('ING') || p.startsWith('GE')) return 'Ingénierie';
  return 'Autre';
}

function parseEtablissement(promo: string): string {
  const p = (promo ?? '').toUpperCase();
  if (p.includes('TDSI'))   return 'TDSI';
  if (p.includes('ESP'))   return 'ESP';
  if (p.includes('UCAD') || p.includes('FST')) return 'UCAD/FST';
  if (p.includes('ISM'))   return 'ISM';
  if (p.includes('ISEP'))  return 'ISEP';
  if (p.includes('EPT'))   return 'EPT';
  return 'Autre';
}

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

  @ViewChild('activityChart')    activityChartRef!:    ElementRef;
  @ViewChild('categoryChart')    categoryChartRef!:    ElementRef;
  @ViewChild('promoChart')       promoChartRef!:       ElementRef;
  @ViewChild('niveauChart')      niveauChartRef!:      ElementRef;
  @ViewChild('etablissementChart') etablissementChartRef!: ElementRef;

  private charts: Record<string, Chart | null> = {
    activity: null, category: null, promo: null, niveau: null, etablissement: null
  };

  loading   = signal(true);
  dateRange = signal(30);
  Math      = Math;

  // ── Data signals ───────────────────────────────────────────
  users     = signal<User[]>([]);
  workshops = signal<Workshop[]>([]);

  kpis = signal({
    totalUsers: 0, totalWorkshops: 0, totalRegistrations: 0,
    participationRate: 0, avgParticipantsPerWs: 0,
    userGrowth: 12, workshopGrowth: 8, registrationGrowth: 23, participationTrend: 5,
  });

  popularTopics    = signal<{ name: string; count: number; percentage: number }[]>([]);
  recentActivities = signal<{ id: string; title: string; type: string; date: Date }[]>([]);

  private monthlyData  = signal<{ month: string; workshops: number; registrations: number }[]>([]);
  private categoryData = signal<{ category: string; count: number }[]>([]);

  // ── Computed: classifications ──────────────────────────────
  promoStats = computed<PromoStat[]>(() => {
    const usersArr = this.users();
    const wsArr    = this.workshops();
    const map = new Map<string, { count: number; workshops: Set<string> }>();

    usersArr.forEach(u => {
      const p = u.promo || 'Non renseigné';
      if (!map.has(p)) map.set(p, { count: 0, workshops: new Set() });
      map.get(p)!.count++;
    });

    wsArr.forEach(ws => {
      ws.registrations?.forEach(uid => {
        const user = usersArr.find(u => u.uid === uid);
        if (user) {
          const p = user.promo || 'Non renseigné';
          map.get(p)?.workshops.add(ws.id ?? '');
        }
      });
    });

    const total = usersArr.length || 1;
    return Array.from(map.entries())
      .map(([promo, d]) => ({
        promo, count: d.count,
        pct: Math.round((d.count / total) * 100),
        workshops: d.workshops.size,
      }))
      .sort((a, b) => b.count - a.count);
  });

  niveauStats = computed<NiveauStat[]>(() => {
    const colors: Record<string, string> = {
      'L1': '#00d4ff', 'L2': '#3b82f6', 'L3': '#8b5cf6',
      'M1': '#10b981', 'M2': '#f59e0b', 'Ingénierie': '#ef4444', 'Autre': '#64748b',
    };
    const labels: Record<string, string> = {
      'L1': 'Licence 1', 'L2': 'Licence 2', 'L3': 'Licence 3',
      'M1': 'Master 1',  'M2': 'Master 2',  'Ingénierie': 'Ingénierie', 'Autre': 'Autre',
    };
    const map = new Map<string, number>();
    this.users().forEach(u => {
      const n = parseNiveau(u.promo ?? '');
      map.set(n, (map.get(n) ?? 0) + 1);
    });
    const total = this.users().length || 1;
    return Array.from(map.entries())
      .map(([niveau, count]) => ({
        niveau, label: labels[niveau] ?? niveau,
        count, pct: Math.round((count / total) * 100),
        color: colors[niveau] ?? '#64748b',
      }))
      .sort((a, b) => b.count - a.count);
  });

  etablissementStats = computed(() => {
    const map = new Map<string, number>();
    this.users().forEach(u => {
      const e = parseEtablissement(u.promo ?? '');
      map.set(e, (map.get(e) ?? 0) + 1);
    });
    const total = this.users().length || 1;
    return Array.from(map.entries())
      .map(([etab, count]) => ({ etab, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  });

  topParticipants = computed<TopUser[]>(() => {
    const wsArr = this.workshops();
    const usersArr = this.users();
    const countMap = new Map<string, number>();

    wsArr.forEach(ws => {
      ws.registrations?.forEach(uid => {
        countMap.set(uid, (countMap.get(uid) ?? 0) + 1);
      });
    });

    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([uid, total]) => {
        const u = usersArr.find(u => u.uid === uid);
        return {
          uid, total,
          name:  u?.displayName  ?? uid,
          email: u?.email        ?? '',
          promo: u?.promo        ?? '',
        };
      });
  });

  // ── Lifecycle ──────────────────────────────────────────────
  async ngOnInit(): Promise<void> { await this.loadData(); }
  ngAfterViewInit(): void        { this.initCharts(); }

  ngOnDestroy(): void {
    Object.values(this.charts).forEach(c => c?.destroy());
  }

  // ── Data ───────────────────────────────────────────────────
  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [allUsers, workshops, themes] = await Promise.all([
        this.userSvc.getAllUsers(),
        firstValueFrom(this.workshopService.getWorkshops()),
        firstValueFrom(this.themeService.getThemes()),
      ]);

      this.users.set(allUsers);
      this.workshops.set(workshops);

      const totalUsers         = allUsers.length;
      const totalWorkshops     = workshops.length;
      const totalRegistrations = workshops.reduce((s, w) => s + (w.registrations?.length ?? 0), 0);
      const participationRate  = totalUsers > 0 ? Math.round((totalRegistrations / totalUsers) * 100) : 0;
      const avgPerWs           = totalWorkshops > 0 ? Math.round(totalRegistrations / totalWorkshops) : 0;

      this.kpis.update(k => ({ ...k, totalUsers, totalWorkshops, totalRegistrations, participationRate, avgParticipantsPerWs: avgPerWs }));

      // Mensuel
      const monthlyMap = new Map<string, { workshops: number; registrations: number }>();
      workshops.forEach(ws => {
        const key  = ws.date.toLocaleString('fr', { month: 'short', year: 'numeric' });
        const curr = monthlyMap.get(key) ?? { workshops: 0, registrations: 0 };
        curr.workshops++;
        curr.registrations += ws.registrations?.length ?? 0;
        monthlyMap.set(key, curr);
      });
      this.monthlyData.set(Array.from(monthlyMap.entries()).map(([month, d]) => ({ month, ...d })));

      // Catégories
      const categoryMap = new Map<string, number>();
      themes.forEach(t => categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1));
      const catData = Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      this.categoryData.set(catData);

      const maxCat = Math.max(...catData.map(c => c.count), 1);
      this.popularTopics.set(catData.map(c => ({
        name: c.category, count: c.count,
        percentage: Math.round((c.count / maxCat) * 100),
      })));

      this.recentActivities.set(
        [...workshops]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 6)
          .map(ws => ({ id: ws.id ?? '', title: ws.themeTitle, type: 'workshop', date: ws.date }))
      );

      this.updateCharts();
    } catch (err) {
      this.logger.error('[Analytics] Erreur chargement:', err);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Charts ────────────────────────────────────────────────
  private initCharts(): void {
    this.buildActivityChart();
    this.buildCategoryChart();
    this.buildPromoChart();
    this.buildNiveauChart();
    this.buildEtablissementChart();
  }

  private chartDefaults = {
    grid:  { color: 'rgba(255,255,255,0.05)' },
    ticks: { color: '#64748b', font: { size: 11 } },
    legend:{ labels: { color: '#94a3b8', font: { size: 11 } } },
  };

  private buildActivityChart(): void {
    const el = this.activityChartRef?.nativeElement;
    if (!el) return;
    this.charts['activity']?.destroy();
    this.charts['activity'] = new Chart(el, {
      type: 'line',
      data: {
        labels: this.monthlyData().map(d => d.month),
        datasets: [
          { label: 'Workshops', data: this.monthlyData().map(d => d.workshops),
            borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.08)',
            tension: 0.4, fill: true, pointBackgroundColor: '#00d4ff', pointRadius: 4 },
          { label: 'Inscriptions', data: this.monthlyData().map(d => d.registrations),
            borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.08)',
            tension: 0.4, fill: true, pointBackgroundColor: '#8b5cf6', pointRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: this.chartDefaults.grid, ticks: this.chartDefaults.ticks },
          x: { grid: { display: false }, ticks: this.chartDefaults.ticks },
        },
      },
    });
  }

  private buildCategoryChart(): void {
    const el = this.categoryChartRef?.nativeElement;
    if (!el) return;
    this.charts['category']?.destroy();
    this.charts['category'] = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: this.categoryData().map(c => c.category),
        datasets: [{
          data: this.categoryData().map(c => c.count),
          backgroundColor: ['#00d4ff','#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444'],
          borderWidth: 0, hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: this.chartDefaults.legend.labels } },
      },
    });
  }

  private buildPromoChart(): void {
    const el = this.promoChartRef?.nativeElement;
    if (!el) return;
    const data = this.promoStats().slice(0, 8);
    this.charts['promo']?.destroy();
    this.charts['promo'] = new Chart(el, {
      type: 'bar',
      data: {
        labels: data.map(p => p.promo),
        datasets: [{
          label: 'Membres',
          data: data.map(p => p.count),
          backgroundColor: data.map((_, i) =>
            `rgba(0,212,255,${0.7 - i * 0.07})`
          ),
          borderRadius: 6, borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: this.chartDefaults.grid, ticks: this.chartDefaults.ticks },
          y: { grid: { display: false }, ticks: this.chartDefaults.ticks },
        },
      },
    });
  }

  private buildNiveauChart(): void {
    const el = this.niveauChartRef?.nativeElement;
    if (!el) return;
    const data = this.niveauStats();
    this.charts['niveau']?.destroy();
    this.charts['niveau'] = new Chart(el, {
      type: 'polarArea',
      data: {
        labels: data.map(n => n.label),
        datasets: [{ data: data.map(n => n.count), backgroundColor: data.map(n => n.color + 'cc'), borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: this.chartDefaults.legend.labels } },
        scales: { r: { ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' } } },
      },
    });
  }

  private buildEtablissementChart(): void {
    const el = this.etablissementChartRef?.nativeElement;
    if (!el) return;
    const data = this.etablissementStats();
    this.charts['etablissement']?.destroy();
    this.charts['etablissement'] = new Chart(el, {
      type: 'bar',
      data: {
        labels: data.map(e => e.etab),
        datasets: [{
          label: 'Membres',
          data: data.map(e => e.count),
          backgroundColor: ['#00d4ff','#3b82f6','#8b5cf6','#10b981','#f59e0b','#64748b'].slice(0, data.length),
          borderRadius: 8, borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: this.chartDefaults.grid, ticks: this.chartDefaults.ticks },
          x: { grid: { display: false }, ticks: this.chartDefaults.ticks },
        },
      },
    });
  }

  private updateCharts(): void {
    if (!this.charts['activity']) return;
    this.charts['activity']!.data.labels = this.monthlyData().map(d => d.month);
    (this.charts['activity']!.data.datasets[0] as any).data = this.monthlyData().map(d => d.workshops);
    (this.charts['activity']!.data.datasets[1] as any).data = this.monthlyData().map(d => d.registrations);
    this.charts['activity']!.update('none');
  }

  // ── Actions ───────────────────────────────────────────────
  setDateRange(days: string): void {
    this.dateRange.set(parseInt(days, 10));
    this.loadData();
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  exportData(format: 'csv'): void {
    const rows = [
      ['Promotion', 'Membres', '%', 'Workshops'],
      ...this.promoStats().map(p => [p.promo, String(p.count), p.pct + '%', String(p.workshops)]),
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'analytics-tdsi.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}
