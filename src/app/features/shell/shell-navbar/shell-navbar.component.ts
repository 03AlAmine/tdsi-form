// shell-navbar.component.ts
import { Component, HostListener, inject, signal, effect, AfterViewInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CommandPaletteService } from '../../../core/services/command-palette.service';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-shell-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, NotificationBellComponent],
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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly commandPaletteService = inject(CommandPaletteService);
  private readonly themeService = inject(ThemeService);

  userMenuOpen = signal(false);
  mobileMenuOpen = signal(false);
  isScrolled = false;

  // ✅ Badge "Mes dépôts" — nombre de propositions encore en attente
  // de traitement, affiché dans le dropdown utilisateur (et repris sur
  // la page "Proposer"). Un abonnement léger, actif tant que l'onglet
  // reste connecté.
  private mySubmissionsSub: Subscription | null = null;
  pendingMySubmissionsCount = signal(0);

  private scrollListener: (() => void) | null = null;

  // ── Découvrabilité du raccourci ⌘K ──────────────────────────────────
  // Affiché une seule fois par navigateur (localStorage), uniquement
  // pour les nouveaux visiteurs qui n'ont jamais ouvert la palette.
  // Disparaît dès qu'ils l'ouvrent (clic ou clavier, via l'effect
  // ci-dessous) ou tout seul après quelques secondes s'ils l'ignorent.
  private static readonly CMDK_HINT_KEY = 'club-tdsi-cmdk-hint-seen';
  showCmdkHint = signal(false);
  private hintTimeout: ReturnType<typeof setTimeout> | null = null;
  private hintAutoDismiss: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Se déclenche pour toute ouverture de la palette, qu'elle vienne du
    // bouton de la navbar ou du raccourci clavier global.
    effect(() => {
      if (this.commandPaletteService.hasBeenOpened()) {
        this.dismissCmdkHint();
      }
    });

    const uid = this.authService.currentUser?.uid;
    if (uid) {
      this.mySubmissionsSub = this.themeService
        .getMySubmissions(uid)
        .subscribe((subs) => {
          this.pendingMySubmissionsCount.set(
            subs.filter((s) => s.status === 'en attente').length,
          );
        });
    }
  }

  dismissCmdkHint(): void {
    this.showCmdkHint.set(false);
    if (this.isBrowser) {
      localStorage.setItem(ShellNavbarComponent.CMDK_HINT_KEY, '1');
    }
    if (this.hintAutoDismiss) {
      clearTimeout(this.hintAutoDismiss);
      this.hintAutoDismiss = null;
    }
  }

  openCommandPalette(): void {
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
    this.commandPaletteService.requestOpen();
  }

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
    if (!target.closest('.mobile-menu-btn') &&
        !target.closest('.mobile-nav') &&
        !target.closest('.mobile-nav-overlay')) {
      this.mobileMenuOpen.set(false);
      document.body.style.overflow = '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.mobileMenuOpen.set(false);
    this.userMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  ngAfterViewInit(): void {
    // ✅ SSR-safe : pas de window au prerender.
    if (!this.isBrowser) return;
    this.scrollListener = this.handleScroll;
    window.addEventListener('scroll', this.scrollListener);

    if (!localStorage.getItem(ShellNavbarComponent.CMDK_HINT_KEY)) {
      this.hintTimeout = setTimeout(() => {
        this.showCmdkHint.set(true);
        // Auto-dismiss si ignorée, pour ne pas rester collée en
        // permanence à l'écran.
        this.hintAutoDismiss = setTimeout(() => this.dismissCmdkHint(), 8000);
      }, 1500);
    }
  }

  ngOnDestroy(): void {
    if (this.hintTimeout) clearTimeout(this.hintTimeout);
    if (this.hintAutoDismiss) clearTimeout(this.hintAutoDismiss);
    this.mySubmissionsSub?.unsubscribe();
    if (!this.isBrowser) return;
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
    document.body.style.overflow = '';
  }

  private handleScroll = (): void => {
    this.isScrolled = window.scrollY > 50;
  }
}
