// core/components/custom-cursor.component.ts
//
// Petit point cyan qui suit le curseur avec un léger retard (lerp) et
// grossit au survol des éléments interactifs (liens, boutons, éléments
// avec [role=button] ou la classe .cursor-hover). Purement décoratif,
// donc :
//   - désactivé sur tactile (matchMedia '(pointer: fine)')
//   - désactivé si prefers-reduced-motion
//   - SSR-safe (ne fait rien tant qu'on n'est pas côté navigateur)
//   - aucune interaction avec le curseur natif (pointer-events: none),
//     donc zéro risque de casser un clic existant
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  PLATFORM_ID, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-custom-cursor',
  standalone: true,
  template: `
    <div #dot class="custom-cursor" aria-hidden="true"></div>
  `,
  styles: [`
    .custom-cursor {
      position: fixed;
      top: 0;
      left: 0;
      width: 10px;
      height: 10px;
      margin: -5px 0 0 -5px;
      border-radius: 50%;
      background: var(--tech-cyan, #00d4ff);
      box-shadow: 0 0 12px rgba(0, 212, 255, 0.6);
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.2s ease, width 0.18s ease, height 0.18s ease, margin 0.18s ease, background 0.18s ease;
      will-change: transform;

      &.is-visible { opacity: 1; }

      &.is-hover {
        width: 34px;
        height: 34px;
        margin: -17px 0 0 -17px;
        background: rgba(0, 212, 255, 0.15);
        box-shadow: 0 0 0 1.5px var(--tech-cyan, #00d4ff);
      }

      &.is-down { opacity: 0.6; }
    }
  `],
})
export class CustomCursorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('dot') dotRef!: ElementRef<HTMLDivElement>;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private enabled = false;

  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private rafId: number | null = null;

  private readonly HOVER_SELECTOR = 'a, button, [role="button"], input, select, textarea, .cursor-hover';

  private onMouseMove = (e: MouseEvent) => {
    this.targetX = e.clientX;
    this.targetY = e.clientY;
    this.dotRef.nativeElement.classList.add('is-visible');
  };

  private onMouseOver = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest?.(this.HOVER_SELECTOR)) {
      this.dotRef.nativeElement.classList.add('is-hover');
    }
  };

  private onMouseOut = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest?.(this.HOVER_SELECTOR)) {
      this.dotRef.nativeElement.classList.remove('is-hover');
    }
  };

  private onMouseDown = () => this.dotRef.nativeElement.classList.add('is-down');
  private onMouseUp   = () => this.dotRef.nativeElement.classList.remove('is-down');
  private onMouseLeaveWindow = () => this.dotRef.nativeElement.classList.remove('is-visible');

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.enabled = isFinePointer && !prefersReducedMotion;
    if (!this.enabled) return;

    document.body.classList.add('has-custom-cursor');
    document.addEventListener('mousemove', this.onMouseMove, { passive: true });
    document.addEventListener('mouseover', this.onMouseOver, { passive: true });
    document.addEventListener('mouseout', this.onMouseOut, { passive: true });
    document.addEventListener('mousedown', this.onMouseDown, { passive: true });
    document.addEventListener('mouseup', this.onMouseUp, { passive: true });
    document.addEventListener('mouseleave', this.onMouseLeaveWindow, { passive: true });

    this.tick();
  }

  private tick = (): void => {
    // Lerp léger : le point "rattrape" la position réelle avec un peu
    // d'inertie plutôt que de la suivre au pixel près, plus organique.
    this.currentX += (this.targetX - this.currentX) * 0.2;
    this.currentY += (this.targetY - this.currentY) * 0.2;
    this.dotRef.nativeElement.style.transform =
      `translate3d(${this.currentX}px, ${this.currentY}px, 0)`;
    this.rafId = requestAnimationFrame(this.tick);
  };

  ngOnDestroy(): void {
    if (!this.isBrowser || !this.enabled) return;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.body.classList.remove('has-custom-cursor');
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseover', this.onMouseOver);
    document.removeEventListener('mouseout', this.onMouseOut);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mouseleave', this.onMouseLeaveWindow);
  }
}
