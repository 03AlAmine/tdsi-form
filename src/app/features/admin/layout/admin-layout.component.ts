// admin-layout.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell.component';
import { PersonInfoModalComponent } from '../../shared/components/person-info-modal/person-info-modal.component';
import { PersonInfoService } from '../../../core/services/person-info.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule,
    ToastComponent,
    ConfirmModalComponent,
    NotificationBellComponent,
    PersonInfoModalComponent,
  ],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private personInfoService = inject(PersonInfoService);
  private notificationService = inject(NotificationService);

  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);

  // ✅ Badge dynamique sur "Soumissions" : nombre de propositions en
  // attente de traitement, pour que l'admin voie d'un coup d'œil si
  // une action l'attend, sans avoir à ouvrir la page.
  private pendingSubmissionsCount = signal(0);

  // ✅ Pastille sur l'avatar admin : notifications non lues, visible
  // même en sidebar réduite (contrairement au libellé de la cloche).
  private unreadNotifCount = signal(0);
  hasUnreadNotifs = computed(() => this.unreadNotifCount() > 0);
  notifBadgeLabel = computed(() => {
    const n = this.unreadNotifCount();
    return n > 9 ? '9+' : String(n);
  });

  constructor() {
    this.themeService.getSubmissions().subscribe((subs) => {
      this.pendingSubmissionsCount.set(
        subs.filter((s) => s.status === 'en attente').length,
      );
    });

    let lastNotifUid: string | null = null;
    this.authService.currentUser$.subscribe((u) => {
      if (u?.uid && u.uid !== lastNotifUid) {
        lastNotifUid = u.uid;
        this.notificationService.getNotifications(u.uid).subscribe((notifs) => {
          this.unreadNotifCount.set(notifs.filter((n) => !n.read).length);
        });
      }
    });
  }

  get user() {
    return this.authService.currentUser;
  }

  get userInitial(): string {
    return this.user?.displayName?.charAt(0)?.toUpperCase() || 'A';
  }

  get adminName(): string {
    return this.user?.displayName || 'Administrateur';
  }

  navItems = computed(() => [
    { path: '/admin/dashboard',  label: 'Dashboard',    icon: 'fa-chart-line',        badge: null as number | null },
    { path: '/admin/analytics',  label: 'Analytics',    icon: 'fa-chart-simple',      badge: null as number | null },
    { path: '/admin/themes',     label: 'Thématiques',  icon: 'fa-layer-group',       badge: null as number | null },
    { path: '/admin/soumissions',label: 'Soumissions',  icon: 'fa-file-alt',          badge: this.pendingSubmissionsCount() || null },
    { path: '/admin/workshops',  label: 'Workshops',    icon: 'fa-chalkboard-user',   badge: null as number | null },
  /*  { path: '/admin/articles',   label: 'Articles',     icon: 'fa-newspaper',         badge: null },*/
    { path: '/admin/users',      label: 'Utilisateurs', icon: 'fa-users',             badge: null as number | null },
  ]);

  // ✅ Ouvre la fiche "Voir le profil" (composant déjà utilisé pour les
  // auteurs de soumissions/thématiques) avec les infos de l'admin
  // connecté — pas besoin d'une page dédiée pour un simple aperçu.
  showProfile(): void {
    const u = this.user;
    if (!u) return;
    this.personInfoService.show({
      uid: u.uid,
      name: u.displayName || this.adminName,
      email: u.email,
      promo: u.promo,
      context: 'Administrateur',
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }
}
