// core/directives/reveal.directive.ts
import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// ─────────────────────────────────────────────────────────────
// RevealDirective — extrait de LandingComponent.initScrollReveal()
// pour être réutilisable partout sans dupliquer l'IntersectionObserver
// à chaque composant. Usage :
//
//   <div appReveal class="feature-card">...</div>
//   <div appReveal [appRevealDelay]="i * 60">...</div>   (délai en ms, ex: listes)
//
// S'appuie sur les classes .reveal / .revealed déjà définies dans
// _animations.scss (opacity/translateY + transition). SSR-safe : ne
// fait rien tant qu'on n'est pas côté navigateur.
// ─────────────────────────────────────────────────────────────
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input() appRevealDelay = 0;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer: IntersectionObserver | null = null;

  ngOnInit(): void {
    if (!this.isBrowser) return;

    const node = this.el.nativeElement;
    node.classList.add('reveal');
    if (this.appRevealDelay) {
      node.style.transitionDelay = `${this.appRevealDelay}ms`;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
