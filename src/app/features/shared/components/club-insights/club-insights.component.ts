// club-insights.component.ts
//
// Bloc "Le campus en chiffres" réutilisé sur la landing page et sur le
// dashboard membre : bandeau de stats animées, jauges circulaires et
// deux graphes (donut + histogramme) via Chart.js (déjà une dépendance
// du projet — voir AnalyticsComponent côté admin).
//
// ⚠️ Volontairement basé sur des données génériques/illustratives (pas
// de lecture Firestore) : c'est une vitrine visuelle du "Club en
// chiffres", pas un tableau de bord analytique — voir AnalyticsComponent
// (admin) pour les vraies statistiques du club.
//
// SSR-safe : aucun canvas n'est manipulé côté serveur.

import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { RevealDirective } from '../../../../core/directives/reveal.directive';
import { CountUpDirective } from '../../../../core/directives/count-up.directive';

Chart.register(...registerables);

interface StatItem {
  icon: string;
  value: number;
  suffix: string;
  label: string;
  color: 'cyan' | 'blue';
  delay: number;    // ms — décalage d'apparition (appRevealDelay)
  duration: number; // ms — durée du compteur (appCountUpDuration)
}

interface GaugeItem {
  icon: string;
  label: string;
  value: number; // 0-100
  color: 'cyan' | 'blue';
  delay: number;    // ms — décalage avant le début du remplissage
  duration: number; // ms — durée du remplissage
}

// Rayon du cercle SVG des jauges — voir template (r="40")
const GAUGE_RADIUS = 40;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

// Intervalles de "recharge" des jauges et des graphes — volontairement
// différents et non multiples l'un de l'autre, pour que les deux
// boucles se désynchronisent au fil du temps plutôt que de reprendre
// systématiquement pile en même temps (effet répétitif/monotone).
const GAUGE_REPLAY_INTERVAL_MS = 5200;
const CHART_REPLAY_INTERVAL_MS = 7400;

@Component({
  selector: 'app-club-insights',
  standalone: true,
  imports: [CommonModule, RevealDirective, CountUpDirective],
  templateUrl: './club-insights.component.html',
  styleUrls: ['./club-insights.component.scss'],
})
export class ClubInsightsComponent implements AfterViewInit, OnDestroy {
  @Input() title = 'Le campus en chiffres';
  @Input() subtitle = 'Ce que la communauté Club TDSI construit ensemble';

  @ViewChild('categoryCanvas') categoryCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlyCanvas') monthlyCanvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly reducedMotion =
    this.isBrowser && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  private categoryChart: Chart | null = null;
  private monthlyChart: Chart | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private gaugeReplayTimer: ReturnType<typeof setInterval> | null = null;
  private chartReplayTimer: ReturnType<typeof setInterval> | null = null;
  private revealTimeout: ReturnType<typeof setTimeout> | null = null;
  private chartsBuilt = false;

  readonly circumference = GAUGE_CIRCUMFERENCE;

  // ── Bandeau de stats génériques — chaque carte a son propre timing
  // (délai d'apparition + durée de comptage) pour éviter un rendu
  // "au garde-à-vous" où tout bouge exactement en même temps. ──
  readonly stats: StatItem[] = [
    { icon: 'fa-users',           value: 100, suffix: '+', label: 'Membres actifs',          color: 'cyan',  delay: 0,   duration: 1300 },
    { icon: 'fa-bolt',            value: 500, suffix: '+', label: 'Participations cumulées', color: 'blue',  delay: 160, duration: 1900 },
    { icon: 'fa-chalkboard-user', value: 40,  suffix: '+', label: 'Workshops organisés',     color: 'cyan',  delay: 340, duration: 1100 },
    { icon: 'fa-people-group',    value: 6,   suffix: '',  label: 'Communautés partenaires', color: 'blue',  delay: 560, duration: 800 },
  ];

  // ── Jauges circulaires animées — durées et délais volontairement
  // différents entre les trois pour un remplissage "en cascade" plutôt
  // que synchronisé. ──
  readonly gauges: GaugeItem[] = [
    { icon: 'fa-calendar-check', label: 'Taux de participation', value: 87, color: 'cyan',  delay: 0,   duration: 1300 },
    { icon: 'fa-face-smile',     label: 'Taux de satisfaction',  value: 96, color: 'blue',  delay: 220, duration: 1900 },
    { icon: 'fa-arrow-trend-up', label: 'Membres revenus',       value: 78, color: 'cyan',  delay: 440, duration: 1100 },
  ];

  // Pilote la transition CSS des jauges — passe à `false` puis `true`
  // pour rejouer l'animation de remplissage (voir replay() ci-dessous).
  revealed = false;

  // ── Effets "HUD" additionnels ─────────────────────────────────────
  // Valeur affichée en direct dans chaque jauge (compte de 0 → g.value,
  // en rythme avec le remplissage du cercle SVG).
  gaugeDisplay: Record<string, number> = {};
  // Anneau de "ping" radar déclenché brièvement quand une jauge termine
  // son remplissage — un signal visuel de "cible atteinte".
  gaugePulse: Record<string, boolean> = {};

  // Total affiché au centre du donut (0 → 100%), et badge d'état
  // "ANALYSE... / SYNC OK" pendant/après le rendu du graphe.
  donutTotalDisplay = 0;
  donutSyncing = false;

  // Total de workshops affiché au-dessus de l'histogramme, et curseur
  // "playhead" qui balaie le graphe pendant le rendu des barres.
  monthlyTotalDisplay = 0;
  barsSweeping = false;

  // ── Données génériques des graphes ───────────────────────────────────
  private readonly categoryLabels = ['Cybersécurité', 'Intelligence Artificielle', 'Développement Web', 'Cloud & DevOps'];
  private readonly categoryData = [35, 28, 22, 15];
  private readonly categoryColors = ['#00d4ff', '#3b82f6', '#1078b9', '#60a5fa'];

  private readonly monthlyData = [8, 11, 9, 14, 17, 22];

  categorySlices = this.categoryLabels.map((label, i) => ({
    label,
    value: this.categoryData[i],
    color: this.categoryColors[i],
  }));

  monthlyLabels: string[] = this.buildLastSixMonthLabels();

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // On construit les graphes/jauges seulement quand le bloc entre
    // réellement dans le viewport — l'animation de montée est ainsi
    // toujours visible, même si le bloc est plus bas dans la page.
    // Tant que le bloc reste visible, on la rejoue périodiquement pour
    // donner une sensation de tableau de bord "vivant" ; elle se met en
    // pause dès qu'on quitte la section (perf + pas d'animation dans le
    // dos de l'utilisateur).
    this.zone.runOutsideAngular(() => {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries[0]?.isIntersecting;
          if (visible) {
            this.zone.run(() => this.onEnterView());
          } else {
            this.onLeaveView();
          }
        },
        { threshold: 0.25 }
      );
      this.intersectionObserver.observe(this.hostEl.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
    this.stopReplayLoops();
    if (this.revealTimeout) clearTimeout(this.revealTimeout);
    this.categoryChart?.destroy();
    this.monthlyChart?.destroy();
  }

  gaugeOffset(value: number): number {
    return this.circumference * (1 - value / 100);
  }

  // ── Cycle de vie visuel : entrée / sortie du viewport ────────────────
  private onEnterView(): void {
    if (!this.chartsBuilt) {
      // Premier affichage : Chart.js anime déjà nativement la montée
      // des graphes à la création (voir `animation` dans les options),
      // seules les jauges ont besoin d'être déclenchées manuellement.
      this.renderCategoryChart();
      this.renderMonthlyChart();
      this.chartsBuilt = true;
      this.replayGauges();
    } else {
      // Le bloc redevient visible (retour au scroll) : on rejoue tout,
      // avec un léger décalage entre jauges et graphes pour ne pas
      // donner l'impression d'un "reset" global synchronisé.
      this.replayGauges();
      setTimeout(() => this.replayCharts(), 250);
    }

    if (this.reducedMotion) return; // pas de boucle auto pour ces utilisateurs

    if (!this.gaugeReplayTimer) {
      this.gaugeReplayTimer = setInterval(() => this.replayGauges(), GAUGE_REPLAY_INTERVAL_MS);
    }
    if (!this.chartReplayTimer) {
      this.chartReplayTimer = setInterval(() => this.replayCharts(), CHART_REPLAY_INTERVAL_MS);
    }
  }

  private onLeaveView(): void {
    this.stopReplayLoops();
  }

  private stopReplayLoops(): void {
    if (this.gaugeReplayTimer) {
      clearInterval(this.gaugeReplayTimer);
      this.gaugeReplayTimer = null;
    }
    if (this.chartReplayTimer) {
      clearInterval(this.chartReplayTimer);
      this.chartReplayTimer = null;
    }
  }

  // Rejoue le remplissage des jauges (chacune avec son propre délai/
  // durée — voir le tableau `gauges` — pour un effet "en cascade").
  private replayGauges(): void {
    this.revealed = false;
    for (const g of this.gauges) {
      this.gaugeDisplay[g.label] = 0;
      this.gaugePulse[g.label] = false;
    }
    if (this.revealTimeout) clearTimeout(this.revealTimeout);
    this.revealTimeout = setTimeout(() => {
      this.revealed = true;
      this.animateGaugeNumbers();
      this.scheduleGaugePulses();
    }, 60);
  }

  // Fait défiler chaque valeur de jauge de 0 → g.value en rythme avec
  // le remplissage du cercle SVG (même délai, même durée).
  private animateGaugeNumbers(): void {
    for (const g of this.gauges) {
      if (this.reducedMotion) {
        this.gaugeDisplay[g.label] = g.value;
        continue;
      }
      this.animateCount(g.value, g.duration, (v) => (this.gaugeDisplay[g.label] = v), g.delay);
    }
  }

  // Déclenche un anneau de "ping" radar juste au moment où chaque
  // jauge termine son remplissage — effet "cible verrouillée".
  private scheduleGaugePulses(): void {
    if (this.reducedMotion) return;
    for (const g of this.gauges) {
      setTimeout(() => {
        this.gaugePulse[g.label] = true;
        setTimeout(() => (this.gaugePulse[g.label] = false), 900);
      }, g.delay + g.duration);
    }
  }

  // Compteur générique 0 → target, easing "easeOutCubic", avec délai
  // de départ optionnel — utilisé pour les jauges, le donut et
  // l'histogramme afin que les chiffres affichés "vivent" au même
  // rythme que les éléments graphiques qu'ils accompagnent.
  private animateCount(
    target: number,
    duration: number,
    onTick: (value: number) => void,
    delay = 0
  ): void {
    const start = performance.now() + delay;
    const step = (now: number) => {
      if (now < start) {
        requestAnimationFrame(step);
        return;
      }
      const elapsed = now - start;
      const t = Math.min(1, duration > 0 ? elapsed / duration : 1);
      const eased = 1 - Math.pow(1 - t, 3);
      onTick(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Rejoue la montée des deux graphes — le donut redémarre en premier,
  // l'histogramme un peu après, pour ne pas retomber à zéro d'un seul
  // bloc (chaque barre/tranche a en plus son propre délai interne, voir
  // les options `animation.delay` ci-dessous).
  private replayCharts(): void {
    if (this.categoryChart) {
      this.syncDonutCounter();
      const dataset = this.categoryChart.data.datasets[0] as any;
      dataset.data = this.categoryData.map(() => 0);
      this.categoryChart.update('none');
      requestAnimationFrame(() => {
        dataset.data = [...this.categoryData];
        this.categoryChart?.update();
      });
    }
    setTimeout(() => {
      if (!this.monthlyChart) return;
      this.syncMonthlyCounter(0);
      const dataset = this.monthlyChart.data.datasets[0] as any;
      dataset.data = this.monthlyData.map(() => 0);
      this.monthlyChart.update('none');
      requestAnimationFrame(() => {
        dataset.data = [...this.monthlyData];
        this.monthlyChart?.update();
      });
    }, 220);
  }

  private buildLastSixMonthLabels(): string[] {
    const now = new Date();
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('fr-FR', { month: 'short' }));
    }
    return labels;
  }

  // Fait défiler le total du donut (0 → 100%) et bascule le badge
  // d'état "ANALYSE... → SYNC OK" en rythme avec l'animation Chart.js
  // (durée du chart + décalage cumulé du dernier secteur).
  private syncDonutCounter(): void {
    const lastSliceDelay = (this.categoryData.length - 1) * 130;
    const totalDuration = 1300 + lastSliceDelay;
    this.donutTotalDisplay = 0;
    this.donutSyncing = true;
    if (this.reducedMotion) {
      this.donutTotalDisplay = 100;
      this.donutSyncing = false;
      return;
    }
    this.animateCount(100, totalDuration, (v) => (this.donutTotalDisplay = v));
    setTimeout(() => (this.donutSyncing = false), totalDuration);
  }

  // Fait défiler le total de workshops et active le curseur "playhead"
  // qui balaie l'histogramme, en rythme avec l'animation Chart.js
  // (durée de la barre + décalage cumulé de la dernière barre, plus le
  // délai de 220ms avant que l'histogramme ne redémarre — voir
  // replayCharts()).
  private syncMonthlyCounter(startDelay = 0): void {
    const total = this.monthlyData.reduce((sum, v) => sum + v, 0);
    const lastBarDelay = (this.monthlyData.length - 1) * 90;
    const totalDuration = 900 + lastBarDelay;
    this.monthlyTotalDisplay = 0;
    this.barsSweeping = true;
    if (this.reducedMotion) {
      this.monthlyTotalDisplay = total;
      this.barsSweeping = false;
      return;
    }
    this.animateCount(total, totalDuration, (v) => (this.monthlyTotalDisplay = v), startDelay);
    setTimeout(() => (this.barsSweeping = false), totalDuration + startDelay);
  }

  private renderCategoryChart(): void {
    const el = this.categoryCanvasRef?.nativeElement;
    if (!el) return;
    this.syncDonutCounter();
    this.categoryChart = new Chart(el, {
      type: 'doughnut',
      data: {
        labels: this.categoryLabels,
        datasets: [
          {
            data: this.categoryData,
            backgroundColor: this.categoryColors,
            borderColor: 'rgba(10, 14, 39, 0.95)',
            borderWidth: 3,
            hoverOffset: 10,
            hoverBorderColor: 'rgba(10, 14, 39, 1)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: {
          duration: 1300,
          easing: 'easeOutQuart',
          // Chaque tranche démarre un peu après la précédente — évite
          // que le donut "explose" d'un coup et rappelle plutôt un
          // remplissage progressif, secteur par secteur.
          delay: (ctx: any) => (ctx.type === 'data' ? ctx.dataIndex * 130 : 0),
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 18, 53, 0.95)',
            borderColor: 'rgba(0, 212, 255, 0.25)',
            borderWidth: 1,
            padding: 10,
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            callbacks: { label: (item) => ` ${item.label} : ${item.formattedValue}%` },
          },
        },
      },
    });
  }

  private renderMonthlyChart(): void {
    const el = this.monthlyCanvasRef?.nativeElement;
    if (!el) return;
    this.syncMonthlyCounter();

    const ctx = el.getContext('2d');
    let barFill: CanvasGradient | string = 'rgba(0, 212, 255, 0.55)';
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 220);
      gradient.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
      gradient.addColorStop(1, 'rgba(138, 11, 228, 0.35)');
      barFill = gradient;
    }

    this.monthlyChart = new Chart(el, {
      type: 'bar',
      data: {
        labels: this.monthlyLabels,
        datasets: [
          {
            label: 'Workshops',
            data: this.monthlyData,
            backgroundColor: barFill,
            hoverBackgroundColor: '#00d4ff',
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: 'easeOutBack',
          // Chaque barre démarre après la précédente, un peu comme un
          // escalier qui se construit — volontairement différent du
          // donut (easing + rythme) pour casser l'effet "copié-collé".
          delay: (ctx: any) => (ctx.type === 'data' ? ctx.dataIndex * 90 : 0),
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 18, 53, 0.95)',
            borderColor: 'rgba(0, 212, 255, 0.25)',
            borderWidth: 1,
            padding: 10,
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            callbacks: {
              label: (item) => ` ${item.formattedValue} workshop${Number(item.raw) > 1 ? 's' : ''}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 11 }, precision: 0, stepSize: 5 },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
        },
      },
    });
  }
}
