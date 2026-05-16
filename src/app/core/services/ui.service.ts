// core/services/ui.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiService implements OnDestroy {
  private scrollLocks = 0;
  private routerSubscription!: Subscription;

  constructor(private router: Router) {
    // Restaure le scroll à chaque navigation
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationStart))
      .subscribe(() => {
        this.enableScroll();
      });
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
  }

  lockScroll() {
    this.scrollLocks++;
    if (this.scrollLocks === 1) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    }
  }

  unlockScroll() {
    this.scrollLocks = Math.max(0, this.scrollLocks - 1);
    if (this.scrollLocks === 0) {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
  }

  enableScroll() {
    this.scrollLocks = 0;
    document.body.style.overflow = '';
    document.body.style.height = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }
}
