// core/directives/magnetic.directive.ts
// ─────────────────────────────────────────────────────────────────────
// Effet "aimant" : l'élément se décale légèrement vers le curseur quand
// celui-ci le survole, et revient à sa position d'origine au mouseleave
// avec un léger rebond (voir --transition-bounce dans _variables.scss).
// Même philosophie que TiltSpotlightDirective : pas de lib, juste un
// transform posé au mousemove, désactivé sur tactile et en
// prefers-reduced-motion.
//
// Usage : <button appMagnetic [magneticStrength]="0.3">CTA</button>
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
  selector: '[appMagnetic]',
  standalone: true,
})
export class MagneticDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly enabled: boolean;

  /** Fraction du déplacement du curseur appliquée à l'élément (0.2–0.4 = subtil). */
  @Input() magneticStrength = 0.3;

  constructor() {
    this.enabled =
      this.isBrowser &&
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;

    const rect = this.el.nativeElement.getBoundingClientRect();
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);

    this.el.nativeElement.style.transform =
      `translate(${offsetX * this.magneticStrength}px, ${offsetY * this.magneticStrength}px)`;
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.enabled) return;
    this.el.nativeElement.style.transition = 'transform var(--transition-bounce, 500ms cubic-bezier(0.34, 1.56, 0.64, 1))';
    this.el.nativeElement.style.transform = 'translate(0, 0)';
    // On retire la transition après coup pour ne pas la laisser sur les
    // mousemove suivants (qui doivent rester instantanés/collés au curseur).
    setTimeout(() => {
      this.el.nativeElement.style.transition = '';
    }, 500);
  }
}
