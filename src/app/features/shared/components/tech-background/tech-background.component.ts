import { Component } from '@angular/core';
import { TechCanvasComponent } from '../tech-canvas/tech-canvas.component';

// ─────────────────────────────────────────────────────────────
// TechBackgroundComponent — décor de fond commun à tout le site
// (monté une fois dans shell-layout, landing, login...). Les
// anneaux radar (conic-gradient en rotation continue) reprennent
// le même langage visuel que les jauges de "Le campus en chiffres"
// (club-insights) et l'écran de connexion — désormais mutualisés
// ici pour apparaître partout plutôt que dupliqués page par page.
// ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-tech-background',
  standalone: true,
  imports: [TechCanvasComponent],
  template: `
    <app-tech-canvas />
    <div class="tech-overlay"></div>
    <div class="grid-overlay"></div>
    <div class="tech-radar tech-radar--tl" aria-hidden="true">
      <span class="tech-radar__ring"></span>
      <span class="tech-radar__ring tech-radar__ring--slow"></span>
    </div>
    <div class="tech-radar tech-radar--br" aria-hidden="true">
      <span class="tech-radar__ring"></span>
    </div>
  `,
  styles: [`
    .tech-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 60%);
      z-index: 1;
      pointer-events: none;
    }

    .grid-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image:
        linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      z-index: 1;
      pointer-events: none;
    }

    // ── Anneaux radar — très discrets (opacity faible), pensés pour
    // être vus sur n'importe quelle page sans distraire du contenu.
    .tech-radar {
      position: fixed;
      z-index: 1;
      pointer-events: none;
      opacity: 0.4;
    }

    .tech-radar--tl { top: -14%; left: -10%; width: 46vw; height: 46vw; max-width: 620px; max-height: 620px; }
    .tech-radar--br { bottom: -18%; right: -12%; width: 40vw; height: 40vw; max-width: 560px; max-height: 560px; }

    .tech-radar__ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: conic-gradient(
        from 0deg,
        transparent 0%,
        rgba(0, 212, 255, 0.16) 8%,
        transparent 22%,
        transparent 78%,
        rgba(139, 92, 246, 0.12) 92%,
        transparent 100%
      );
      animation: tech-radar-spin 18s linear infinite;
    }

    .tech-radar__ring::before {
      content: '';
      position: absolute;
      inset: 12%;
      border-radius: 50%;
      border: 1px solid rgba(0, 212, 255, 0.07);
    }

    .tech-radar__ring--slow {
      inset: 8%;
      animation-duration: 28s;
      animation-direction: reverse;
      opacity: 0.7;
    }

    @keyframes tech-radar-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .tech-radar__ring { animation: none; }
    }

    @media (max-width: 900px) {
      .tech-radar { display: none; }
    }
  `]
})
export class TechBackgroundComponent {}
