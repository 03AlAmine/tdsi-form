import { Component, HostListener, inject, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { TechBackgroundComponent } from "../shared/components/tech-background/tech-background.component";
import { PublicNavbarComponent } from "../shared/components/public-navbar/public-navbar.component";
import { PublicFooterComponent } from "../shared/components/public-footer/public-footer.component";

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, CommonModule, TechBackgroundComponent, PublicNavbarComponent, PublicFooterComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private authService = inject(AuthService);

  userMenuOpen = signal(false);
  private observer: IntersectionObserver | null = null;
  private typingInterval: any = null;

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
    this.userMenuOpen.update(v => !v);
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
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
  }

  private initTypingAnimation(): void {
    const text = "Club TDSI Campus";
    const typingElement = document.getElementById('typing-text');
    if (!typingElement) return;

    let i = 0;
    typingElement.textContent = '';

    this.typingInterval = setInterval(() => {
      if (i < text.length) {
        typingElement.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(this.typingInterval);
      }
    }, 100);
  }

  private initCounters(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counters = document.querySelectorAll('.counter');
          counters.forEach((counter) => {
            const target = parseInt(counter.getAttribute('data-target') || '0', 10);
            let current = 0;
            const increment = target / 50;
            const updateCounter = () => {
              current += increment;
              if (current < target) {
                counter.textContent = Math.ceil(current).toString();
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
    });

    const statsSection = document.querySelector('.hero__stats');
    if (statsSection) {
      this.observer.observe(statsSection);
    }
  }
}
