import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.waitForAuthReady().pipe(
    map(() => {
      if (auth.isLoggedIn) return true;
      router.navigate(['/connexion']);
      return false;
    })
  );
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.waitForAuthReady().pipe(
    map(() => {
      if (auth.isAdmin) return true;
      router.navigate(['/espace-membre']);
      return false;
    })
  );
};
