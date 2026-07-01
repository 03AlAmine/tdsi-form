// not-found.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss'],
})
export class NotFoundComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);

  path = window.location.pathname;
  cursorVisible = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  // ✅ Lien d'accueil dynamique
  get homeLink(): string {
    if (this.isLoggedIn()) {
      const user = this.authService.currentUser;
      if (user?.role === 'admin') {
        return '/admin/dashboard';
      }
      return '/espace-membre/thematiques';
    }
    return '/';
  }

  // ✅ Lien espace membre
  get memberSpaceLink(): string {
    const user = this.authService.currentUser;
    if (user?.role === 'admin') {
      return '/admin/dashboard';
    }
    return '/espace-membre/thematiques';
  }

  ngOnInit() {
    this.timer = setTimeout(() => {
      this.cursorVisible = true;
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }
}
