import {
  Component,
  HostListener,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  Renderer2,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { TechBackgroundComponent } from '../shared/components/tech-background/tech-background.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, CommonModule, TechBackgroundComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private renderer = inject(Renderer2);

  userMenuOpen = signal(false);
  private observer: IntersectionObserver | null = null;
  private typingInterval: any = null;
  private scrollObservers: IntersectionObserver[] = [];
  private mouseMoveHandler: (() => void) | null = null;
  private codeTypingTimeout: any = null;
  private isCodeTyping = false;
  private codeLinesOriginal: string[] = [];

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
    if (!target.closest('.user-menu')) {
      this.userMenuOpen.set(false);
    }
  }

  logout(): void {
    this.authService.logout();
  }

  ngAfterViewInit(): void {
    this.initCounters();
    this.initTypingAnimation();
    this.initMouseGlow();
    this.initScrollReveal();
    this.initParticlesAnimation();
    this.initCodeTyping(); // Démarre l'effet d'écriture en boucle
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
    if (this.codeTypingTimeout) {
      clearTimeout(this.codeTypingTimeout);
    }
    this.scrollObservers.forEach((obs) => obs.disconnect());
    if (this.mouseMoveHandler) {
      this.mouseMoveHandler();
    }
  }

  private initTypingAnimation(): void {
    const texts = [
      'Club TDSI Campus',
      'Tech Community',
      'Cyber Security Hub',
      'AI Innovation Lab',
    ];

    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typingElement = document.getElementById('typingText');
    if (!typingElement) return;

    const type = () => {
      const currentText = texts[textIndex];

      if (isDeleting) {
        typingElement.textContent = currentText.substring(0, charIndex - 1);
        charIndex--;
      } else {
        typingElement.textContent = currentText.substring(0, charIndex + 1);
        charIndex++;
      }

      if (!isDeleting && charIndex === currentText.length) {
        isDeleting = true;
        setTimeout(type, 2000);
        return;
      }

      if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
      }

      const speed = isDeleting ? 50 : 100;
      setTimeout(type, speed);
    };

    setTimeout(type, 500);
  }

  private initCodeTyping(): void {
    const codeLines = document.querySelectorAll('.code-line');
    const cursor = document.querySelector('.code-cursor') as HTMLElement;

    const animateLines = () => {
      codeLines.forEach((line, index) => {
        const element = line as HTMLElement;

        // reset animation
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';

        setTimeout(() => {
          element.style.transition = 'all 1.2s ease';
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
        }, index * 700);
      });

      // cursor animation
      if (cursor) {
        cursor.style.opacity = '0';

        setTimeout(() => {
          cursor.style.opacity = '1';
        }, codeLines.length * 700);
      }

      // infinite loop
      setTimeout(
        () => {
          animateLines();
        },
        codeLines.length * 700 + 7000,
      );
    };

    animateLines();
  }

  private initCounters(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const counters = document.querySelectorAll('.counter');
            counters.forEach((counter) => {
              const target = parseInt(
                counter.getAttribute('data-target') || '0',
                10,
              );
              let current = 0;
              const duration = 2000;
              const step = target / (duration / 16);

              const updateCounter = () => {
                current += step;
                if (current < target) {
                  counter.textContent = Math.floor(current).toString();
                  requestAnimationFrame(updateCounter);
                } else {
                  counter.textContent = target.toString();
                }
              };
              updateCounter();
            });
            this.observer?.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );

    const statsSection = document.querySelector('.stats-grid');
    if (statsSection) {
      this.observer.observe(statsSection);
    }
  }

  private initMouseGlow(): void {
    const glow = document.getElementById('mouseGlow');
    if (!glow) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      glow.style.transform = `translate(${x}px, ${y}px)`;
    };

    document.addEventListener('mousemove', handleMouseMove);
    this.mouseMoveHandler = () =>
      document.removeEventListener('mousemove', handleMouseMove);
  }

  private initScrollReveal(): void {
    const revealElements = document.querySelectorAll(
      '.feature-card, .stat-card, .showcase__content, .showcase__image, .resource-card',
    );

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

    revealElements.forEach((el) => {
      el.classList.add('reveal');
      revealObserver.observe(el);
    });

    this.scrollObservers.push(revealObserver);
  }

  private initParticlesAnimation(): void {
    const particles = document.querySelectorAll('.particle');
    particles.forEach((particle, index) => {
      const randomX = Math.random() * 100;
      const randomY = Math.random() * 100;
      const randomDelay = Math.random() * 2;
      const randomDuration = 3 + Math.random() * 2;

      (particle as HTMLElement).style.left = `${randomX}%`;
      (particle as HTMLElement).style.top = `${randomY}%`;
      (particle as HTMLElement).style.animationDelay = `${randomDelay}s`;
      (particle as HTMLElement).style.animationDuration = `${randomDuration}s`;
    });
  }
  openExternalLink(url: string): void {
    window.open(url, '_blank');
  }
}
