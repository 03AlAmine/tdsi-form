import {
  Component,
  HostListener,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { TechBackgroundComponent } from '../shared/components/tech-background/tech-background.component';
import { MemberCalendarComponent } from '../calendar/calendar.component';
import { MemberNotesComponent } from '../notes/notes.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule,
    TechBackgroundComponent,
    MemberCalendarComponent,
    MemberNotesComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private renderer = inject(Renderer2);

  userMenuOpen = signal(false);

  // ── Guest notebook state (même séquence que MemberNotesComponent) ──
  guestNotebookOpen = false;
  guestIsFlipping = false;
  guestIsOpening = false;

  private t1: ReturnType<typeof setTimeout> | null = null;
  private t2: ReturnType<typeof setTimeout> | null = null;
  private t3: ReturnType<typeof setTimeout> | null = null;

  private observer: IntersectionObserver | null = null;
  private typingInterval: any = null;
  private scrollObservers: IntersectionObserver[] = [];
  private mouseMoveHandler: (() => void) | null = null;
  private codeTypingTimeout: any = null;

  get user() {
    return this.authService.currentUser;
  }
  get userInitial(): string {
    return this.user?.displayName?.charAt(0).toUpperCase() ?? '?';
  }
  isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) this.userMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  // ── Ouverture du carnet guest avec feuilletage ────────────────────────
  openGuestNotebook(): void {
    if (this.guestNotebookOpen) return; // déjà ouvert

    this.guestIsFlipping = true;
    this.guestIsOpening = true;

    // t=380ms → cahier ouvert entre dans le DOM
    this.t1 = setTimeout(() => {
      this.guestNotebookOpen = true;
    }, 380);

    // t=680ms → retirer l'overlay de feuilletage
    this.t2 = setTimeout(() => {
      this.guestIsFlipping = false;
    }, 680);

    // t=950ms → retirer le cahier fermé du DOM
    this.t3 = setTimeout(() => {
      this.guestIsOpening = false;
    }, 950);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.initCounters();
    this.initTypingAnimation();
    this.initMouseGlow();
    this.initScrollReveal();
    this.initParticlesAnimation();
    this.initCodeTyping();
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    if (this.typingInterval) clearInterval(this.typingInterval);
    if (this.codeTypingTimeout) clearTimeout(this.codeTypingTimeout);
    [this.t1, this.t2, this.t3].forEach((t) => t && clearTimeout(t));
    this.scrollObservers.forEach((obs) => obs.disconnect());
    if (this.mouseMoveHandler) this.mouseMoveHandler();
  }

  // ── Animations existantes ─────────────────────────────────────────────

  private initTypingAnimation(): void {
    const texts = [
      'Club TDSI Campus',
      'Tech Community',
      'Cyber Security Hub',
      'AI Innovation Lab',
    ];
    let textIndex = 0,
      charIndex = 0,
      isDeleting = false;
    const typingElement = document.getElementById('typingText');
    if (!typingElement) return;

    const type = () => {
      const currentText = texts[textIndex];
      typingElement.textContent = isDeleting
        ? currentText.substring(0, charIndex - 1)
        : currentText.substring(0, charIndex + 1);
      isDeleting ? charIndex-- : charIndex++;

      if (!isDeleting && charIndex === currentText.length) {
        isDeleting = true;
        setTimeout(type, 2000);
        return;
      }
      if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
      }
      setTimeout(type, isDeleting ? 50 : 100);
    };
    setTimeout(type, 500);
  }

  private initCodeTyping(): void {
    const codeLines = document.querySelectorAll('.code-line');
    const cursor = document.querySelector('.code-cursor') as HTMLElement;
    const animateLines = () => {
      codeLines.forEach((line, index) => {
        const el = line as HTMLElement;
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => {
          el.style.transition = 'all 1.2s ease';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, index * 700);
      });
      if (cursor) {
        cursor.style.opacity = '0';
        setTimeout(() => {
          cursor.style.opacity = '1';
        }, codeLines.length * 700);
      }
      setTimeout(() => animateLines(), codeLines.length * 700 + 7000);
    };
    animateLines();
  }

  private initCounters(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            document.querySelectorAll('.counter').forEach((counter) => {
              const target = parseInt(
                counter.getAttribute('data-target') || '0',
                10,
              );
              let current = 0;
              const step = target / (2000 / 16);
              const update = () => {
                current += step;
                if (current < target) {
                  counter.textContent = Math.floor(current).toString();
                  requestAnimationFrame(update);
                } else counter.textContent = target.toString();
              };
              update();
            });
            this.observer?.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    const statsSection = document.querySelector('.stats-grid');
    if (statsSection) this.observer.observe(statsSection);
  }

  private initMouseGlow(): void {
    const glow = document.getElementById('mouseGlow');
    if (!glow) return;

    const handler = (e: MouseEvent) => {
      glow.style.transform = `translate3d(${e.clientX - 125}px, ${e.clientY - 125}px, 0)`;
    };

    document.addEventListener('mousemove', handler);

    this.mouseMoveHandler = () =>
      document.removeEventListener('mousemove', handler);
  }

  private initScrollReveal(): void {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' },
    );
    document
      .querySelectorAll(
        '.feature-card, .stat-card, .showcase__content, .showcase__image, .resource-card',
      )
      .forEach((el) => {
        el.classList.add('reveal');
        revealObserver.observe(el);
      });
    this.scrollObservers.push(revealObserver);
  }

  private initParticlesAnimation(): void {
    document.querySelectorAll('.particle').forEach((particle) => {
      (particle as HTMLElement).style.left = `${Math.random() * 100}%`;
      (particle as HTMLElement).style.top = `${Math.random() * 100}%`;
      (particle as HTMLElement).style.animationDelay = `${Math.random() * 2}s`;
      (particle as HTMLElement).style.animationDuration =
        `${3 + Math.random() * 2}s`;
    });
  }

  openExternalLink(url: string): void {
    window.open(url, '_blank');
  }
}
