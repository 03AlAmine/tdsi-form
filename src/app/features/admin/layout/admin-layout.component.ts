// admin-layout.component.ts
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';

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
  ],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);

  sidebarCollapsed = signal(false);
  mobileOpen = signal(false);

  get user() {
    return this.authService.currentUser;
  }

  get userInitial(): string {
    return this.user?.displayName?.charAt(0)?.toUpperCase() || 'A';
  }

  get adminName(): string {
    return this.user?.displayName || 'Administrateur';
  }

  navItems = [
    { path: '/admin/dashboard',  label: 'Dashboard',    icon: 'fa-chart-line',        badge: null },
    { path: '/admin/analytics',  label: 'Analytics',    icon: 'fa-chart-simple',      badge: null },
    { path: '/admin/themes',     label: 'Thématiques',  icon: 'fa-layer-group',       badge: null },
    { path: '/admin/soumissions',label: 'Soumissions',  icon: 'fa-file-alt',          badge: null },
    { path: '/admin/workshops',  label: 'Workshops',    icon: 'fa-chalkboard-user',   badge: null },
  /*  { path: '/admin/articles',   label: 'Articles',     icon: 'fa-newspaper',         badge: null },*/
    { path: '/admin/users',      label: 'Utilisateurs', icon: 'fa-users',             badge: null },
  ];

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
