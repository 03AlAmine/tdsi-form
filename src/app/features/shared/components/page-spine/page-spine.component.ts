// features/shared/components/page-spine/page-spine.component.ts
// ─────────────────────────────────────────────────────────────────────
// "Fil conducteur" de la page : rail vertical fixe sur le côté, qui se
// remplit (glow cyan) avec la progression du scroll global, avec un
// point par section qui s'allume quand elle est active. Clic = scroll
// fluide vers la section. Desktop uniquement (masqué <1024px en CSS —
// même logique que le fil de la timeline, réutilisée à l'échelle page
// plutôt qu'à l'échelle liste). Purement décoratif/navigationnel, donc
// dégrade sans casse si le JS n'a pas encore hydraté (SSR-safe).
// ─────────────────────────────────────────────────────────────────────

import {
  Component,
  Input,
  OnInit,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SpineAnchor } from './spine-anchor.model';

@Component({
  selector: 'app-page-spine',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-spine.component.html',
  styleUrl: './page-spine.component.scss',
})
export class PageSpineComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() anchors: SpineAnchor[] = [];

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly activeId = signal<string | null>(null);
  readonly fillPercent = signal(0);

  private io: IntersectionObserver | null = null;
  private rafId: number | null = null;
  private scrollHandler = () => this.queueScrollUpdate();

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeId.set(entry.target.id);
          }
        }
      },
      // Bande étroite au centre du viewport : la section "active" est
      // celle qui traverse le milieu de l'écran, pas la première visible.
      { threshold: 0, rootMargin: '-42% 0px -52% 0px' },
    );

    for (const anchor of this.anchors) {
      const el = document.getElementById(anchor.id);
      if (el) this.io.observe(el);
    }

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.queueScrollUpdate();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    this.io?.disconnect();
    window.removeEventListener('scroll', this.scrollHandler);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  scrollTo(id: string): void {
    if (!this.isBrowser) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private queueScrollUpdate(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      this.fillPercent.set(ratio * 100);
    });
  }
}
