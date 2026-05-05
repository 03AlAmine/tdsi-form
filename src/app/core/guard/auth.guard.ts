import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, switchMap } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ✅ On attend que Firebase soit prêt, PUIS on vérifie
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
      router.navigate(['/etudiant']);
      return false;
    })
  );
};
