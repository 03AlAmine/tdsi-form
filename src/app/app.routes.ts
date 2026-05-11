import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guard/auth.guard';

export const routes: Routes = [
  // 🌍 Pages PUBLIQUES
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(
        (m) => m.LandingComponent,
      ),
  },
  {
    path: 'thematiques',
    loadComponent: () =>
      import('./features/public/thematiques/public-thematiques.component').then(
        (m) => m.PublicThematiquesComponent,
      ),
  },
  {
    path: 'workshops',
    loadComponent: () =>
      import('./features/public/workshops/public-workshops.component').then(
        (m) => m.PublicWorkshopsComponent,
      ),
  },
  {
    path: 'workshops/:id/register',
    loadComponent: () =>
      import('./features/public/register/public-register.component').then(
        (m) => m.PublicRegisterComponent,
      ),
  },

  // 🔐 Auth
  {
    path: 'connexion',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'inscription',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },

  // 🎓 Espace membre (étudiant)
  {
    path: 'espace-membre',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/student/layout/student-layout.component').then(
        (m) => m.StudentLayoutComponent,
      ),
    children: [
      { path: '', redirectTo: 'thematiques', pathMatch: 'full' },
      {
        path: 'thematiques',
        loadComponent: () =>
          import('./features/student/themes/themes.component').then(
            (m) => m.ThemesComponent,
          ),
      },
      {
        path: 'workshops',
        loadComponent: () =>
          import('./features/student/workshops/workshops.component').then(
            (m) => m.WorkshopsComponent,
          ),
      },
      {
        path: 'proposer',
        loadComponent: () =>
          import('./features/student/propose/propose.component').then(
            (m) => m.ProposeComponent,
          ),
      },
      {
        path: 'mes-soumissions',
        loadComponent: () =>
          import('./features/student/submissions/my-submissions.component').then(
            (m) => m.MySubmissionsComponent,
          ),
      },
      {
        path: 'profil',
        loadComponent: () =>
          import('./features/student/profile/profile.component').then(
            (m) => m.ProfileComponent,
          ),
      },
      // ✅ ROUTE PRÉSENCE AJOUTÉE
      {
        path: 'presence/:workshopId',
        loadComponent: () =>
          import('./features/student/presence/presence.component').then(
            (m) => m.PresenceComponent,
          ),
      },
    ],
  },

  // 👨‍💼 Admin
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent,
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'themes',
        loadComponent: () =>
          import('./features/admin/themes/admin-themes.component').then(
            (m) => m.AdminThemesComponent,
          ),
      },
      {
        path: 'soumissions',
        loadComponent: () =>
          import('./features/admin/submissions/submissions.component').then(
            (m) => m.SubmissionsComponent,
          ),
      },
      {
        path: 'workshops',
        loadComponent: () =>
          import('./features/admin/workshops/admin-workshops.component').then(
            (m) => m.AdminWorkshopsComponent,
          ),
      },
      {
        path: 'presence/:workshopId',
        loadComponent: () =>
          import('./features/admin/presence-config/presence-config.component').then(
            (m) => m.PresenceConfigComponent,
          ),
      },
    ],
  },

  {
    path: '**',
    loadComponent: () =>
      import('./features/shared/components/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
