// shell-navbar.component.ts
import { Component, HostListener, inject, signal, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-shell-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './shell-navbar.component.html',
  styleUrls: ['./shell-navbar.component.scss'],
  animations: [
    trigger('mobileMenuAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateX(100%)' }))
      ])
    ])
  ]
})
export class ShellNavbarComponent implements AfterViewInit, OnDestroy {
  private authService = inject(AuthService);

  userMenuOpen = signal(false);
  mobileMenuOpen = signal(false);
  isScrolled = false;

  private scrollListener: (() => void) | null = null;

  get user() {
    return this.authService.currentUser;
  }

  get userInitial(): string {
    return this.user?.displayName?.charAt(0).toUpperCase() ?? '?';
  }

  get firstName(): string {
    return this.user?.displayName?.split(' ')[0] ?? '';
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
    if (this.mobileMenuOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.userMenuOpen.set(false);
    }
    if (!target.closest('.mobile-menu-btn') && !target.closest('.mobile-nav')) {
      this.mobileMenuOpen.set(false);
      document.body.style.overflow = '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  ngAfterViewInit(): void {
    this.scrollListener = this.handleScroll;
    window.addEventListener('scroll', this.scrollListener);
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
    document.body.style.overflow = '';
  }

  private handleScroll = (): void => {
    this.isScrolled = window.scrollY > 50;
  }
}
