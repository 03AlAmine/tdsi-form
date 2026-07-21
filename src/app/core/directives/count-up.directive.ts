// core/directives/count-up.directive.ts
import {
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// ─────────────────────────────────────────────────────────────
// CountUpDirective — anime un nombre de 0 (ou de sa valeur précédente)
// jusqu'à [appCountUp] à chaque changement, façon dashboard SaaS.
// Usage : <span [appCountUp]="stats().myRegistrations"></span>
//
// Pas de dépendance externe, juste requestAnimationFrame + easing.
// SSR-safe : affiche directement la valeur finale côté serveur (pas
// de rAF sans navigateur), l'animation ne se joue qu'au client.
// ─────────────────────────────────────────────────────────────
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input() appCountUp = 0;
  /** Durée de l'animation en ms. */
  @Input() appCountUpDuration = 900;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private rafId: number | null = null;
  private current = 0;
  private hasRenderedOnce = false;

  ngOnChanges(changes: SimpleChanges): void {
    const target = changes['appCountUp']?.currentValue ?? 0;

    if (!this.isBrowser) {
      this.el.nativeElement.textContent = String(target);
      return;
    }

    // Première apparition : pas d'animation depuis 0 si la valeur est
    // déjà connue au chargement (évite un décompte artificiel visible
    // dès l'ouverture de la page) — seules les mises à jour ultérieures
    // (nouvelle inscription, nouveau workshop...) sont animées.
    if (!this.hasRenderedOnce) {
      this.hasRenderedOnce = true;
      this.current = target;
      this.el.nativeElement.textContent = String(target);
      return;
    }

    this.animateTo(target);
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private animateTo(target: number): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);

    const start = this.current;
    const delta = target - start;
    if (delta === 0) return;

    const startTime = performance.now();
    const duration = this.appCountUpDuration;
    const easeOutQuad = (t: number) => t * (2 - t);

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.round(start + delta * easeOutQuad(progress));
      this.el.nativeElement.textContent = String(value);

      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.current = target;
      }
    };

    this.rafId = requestAnimationFrame(step);
  }
}
