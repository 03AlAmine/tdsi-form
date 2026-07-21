// core/directives/tilt-spotlight.directive.ts
// ─────────────────────────────────────────────────────────────────────
// Micro-interaction ciblée : un léger glow qui suit le curseur (spotlight
// radial-gradient) + un tilt 3D subtil, calculés au mousemove et exposés
// en variables CSS custom (--mouse-x, --mouse-y, --tilt-x, --tilt-y).
// Le rendu visuel (gradient, transform) reste entièrement dans le SCSS
// de chaque card — cette directive ne fait que poser les 4 variables,
// réutilisable sur n'importe quel élément sans dupliquer la logique JS.
//
// Volontairement pas de lib (Framer Motion...) : quelques lignes de
// calcul + CSS custom properties suffisent, coût quasi nul en perf
// (pas de re-render Angular, juste des mutations directes du style).
// ─────────────────────────────────────────────────────────────────────

import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  Input,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appTiltSpotlight]',
  standalone: true,
})
export class TiltSpotlightDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly prefersReducedMotion: boolean;

  /** Rotation maximale en degrés — volontairement faible pour rester subtil. */
  @Input() tiltMax = 6;

  constructor() {
    this.prefersReducedMotion =
      this.isBrowser &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isBrowser || this.prefersReducedMotion) return;

    const rect = this.el.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const style = this.el.nativeElement.style;

    style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
    style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * this.tiltMax;
    const rotateX = -((y - centerY) / centerY) * this.tiltMax;

    style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
    style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.isBrowser) return;
    const style = this.el.nativeElement.style;
    style.setProperty('--tilt-x', '0deg');
    style.setProperty('--tilt-y', '0deg');
    // --mouse-x/--mouse-y restent sur leur dernière position : le
    // spotlight s'estompe via l'opacité (:hover) dans le CSS, pas besoin
    // de les recentrer, ça évite un saut visuel au prochain survol.
  }
}
