// features/shared/components/glow-timeline/glow-timeline.component.ts
// ─────────────────────────────────────────────────────────────────────
// Timeline verticale "fil lumineux" : un rail vertical dont le
// remplissage (gradient cyan + glow) suit le scroll, avec des points
// qui s'allument un par un via IntersectionObserver au fur et à mesure
// qu'ils entrent dans le viewport. Cartes alternées gauche/droite en
// desktop, colonne unique en mobile (voir SCSS).
//
// Générique : consomme TimelineItem[], ne connaît rien du métier
// (workshops, roadmap membre...) — même esprit que RevealDirective /
// TiltSpotlightDirective : petit composant réutilisable, coût perf
// quasi nul (pas de scroll listener non throttlé, rAF + IO seulement).
// ─────────────────────────────────────────────────────────────────────

import {
  Component,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  AfterViewInit,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TimelineItem } from './timeline-item.model';

@Component({
  selector: 'app-glow-timeline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './glow-timeline.component.html',
  styleUrl: './glow-timeline.component.scss',
})
export class GlowTimelineComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() items: TimelineItem[] = [];
  /** Libellé affiché quand la liste est vide. */
  @Input() emptyLabel = 'Rien à afficher pour le moment.';
  @Output() itemClick = new EventEmitter<TimelineItem>();

  @ViewChild('rail') railRef?: ElementRef<HTMLElement>;
  @ViewChild('fill') fillRef?: ElementRef<HTMLElement>;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Ids des points déjà "révélés" (entrés une fois dans le viewport). */
  readonly revealedIds = signal<Set<string>>(new Set());

  private io: IntersectionObserver | null = null;
  private rafId: number | null = null;
  private scrollHandler = () => this.queueFillUpdate();
  private resizeHandler = () => this.queueFillUpdate();

  onItemClick(item: TimelineItem): void {
    if (item.disabled) return;
    this.itemClick.emit(item);
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Reveal progressif des points au scroll.
    this.io = new IntersectionObserver(
      (entries) => {
        let changed = false;
        const next = new Set(this.revealedIds());
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset['timelineId'];
            if (id && !next.has(id)) {
              next.add(id);
              changed = true;
              this.io?.unobserve(entry.target);
            }
          }
        }
        if (changed) this.revealedIds.set(next);
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );

    const hostEl = this.host.nativeElement as HTMLElement;
    const nodes = hostEl.querySelectorAll('[data-timeline-id]');
    nodes.forEach((node) => this.io?.observe(node));

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    this.queueFillUpdate();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    this.io?.disconnect();
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private queueFillUpdate(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updateFill();
    });
  }

  // Le rail se remplit progressivement entre le moment où son sommet
  // atteint le centre du viewport et celui où son bas l'atteint —
  // donne une sensation de "ligne qui se dessine avec vous", pas juste
  // un pourcentage de scroll de page brut (qui serait faux si la
  // timeline n'occupe qu'une partie de la page).
  private updateFill(): void {
    const rail = this.railRef?.nativeElement;
    const fillEl = this.fillRef?.nativeElement;
    if (!rail || !fillEl) return;

    const rect = rail.getBoundingClientRect();
    const viewportCenter = window.innerHeight * 0.55;

    const total = rect.height || 1;
    const progressed = viewportCenter - rect.top;
    const ratio = Math.min(1, Math.max(0, progressed / total));

    fillEl.style.height = `${ratio * 100}%`;
  }
}
