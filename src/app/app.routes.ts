import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guard/auth.guard';

export const routes: Routes = [
  // ── Auth ──
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
  {
    path: 'mot-de-passe-oublie',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },

  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell-layout/shell-layout.component').then(
        (m) => m.ShellLayoutComponent,
      ),
    children: [
      // ── Landing ──
      {
        path: '',
        loadComponent: () =>
          import('./features/landing/landing.component').then(
            (m) => m.LandingComponent,
          ),
      },

      // ── Pages communes (publiques + membres) ──
      {
        path: 'thematiques',
        data: { preload: true },
        loadComponent: () =>
          import('./features/themes/thematiques.component').then(
            (m) => m.ThematiquesComponent,
          ),
      },
      {
        path: 'workshops',
        data: { preload: true },
        loadComponent: () =>
          import('./features/workshops/workshops.component').then(
            (m) => m.WorkshopsComponent,
          ),
      },
      // ── Pages détail SEO (URLs canoniques indexables et partageables)
      //    Format : /workshops/{slug-du-titre}--{idFirestore}
      //    Pas de conflit avec workshops/:id/meet (3 segments ≠ 2).
      {
        path: 'thematiques/:slug',
        loadComponent: () =>
          import('./features/themes/thematique-detail.component').then(
            (m) => m.ThematiqueDetailComponent,
          ),
      },
      {
        path: 'workshops/:slug',
        loadComponent: () =>
          import('./features/workshops/workshop-detail.component').then(
            (m) => m.WorkshopDetailComponent,
          ),
      },
      {
        path: 'workshops/:id/meet',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/meet/jitsi-meet.component').then(
            (m) => m.JitsiMeetComponent,
          ),
      },
      /*/ ── Articles (public, sans connexion) ──
      {
        path: 'articles',
        loadComponent: () =>
          import('./features/articles/articles.component').then(
            (m) => m.ArticlesComponent,
          ),
      },
      {
        path: 'articles/soumettre',
        loadComponent: () =>
          import('./features/articles/submit-article.component').then(
            (m) => m.SubmitArticleComponent,
          ),
      },
      {
        path: 'articles/:id',
        loadComponent: () =>
          import('./features/articles/article-detail.component').then(
            (m) => m.ArticleDetailComponent,
          ),
      },
       {
        path: 'activites',
        loadComponent: () =>
          import('./features/activities/activities.component').then(
            (m) => m.ActivitiesComponent,
          ),
      },
      {
        path: 'activites/:id',
        loadComponent: () =>
          import('./features/activities/activity-detail.component').then(
            (m) => m.ActivityDetailComponent,
          ),
      },
      {
        path: 'activites/:id/inscription',
        loadComponent: () =>
          import('./features/activities/activity-register.component').then(
            (m) => m.ActivityRegisterComponent,
          ),
      },*/
      // ── Espace membre (auth requis) ──
      {
        path: 'espace-membre',
        canActivate: [authGuard],
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: '',
            loadComponent: () =>
              import('./features/student/dashboard/member-dashboard.component').then(
                (m) => m.MemberDashboardComponent,
              ),
          }, // Redirige vers les pages unifiées
          {
            path: 'thematiques',
            redirectTo: '/thematiques',
            pathMatch: 'full',
          },
          { path: 'workshops', redirectTo: '/workshops', pathMatch: 'full' },
          /*   { path: 'activites', redirectTo: '/activites', pathMatch: 'full' },*/
          // Pages membres exclusives
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
          {
            path: 'presence/:workshopId',
            loadComponent: () =>
              import('./features/student/presence/presence.component').then(
                (m) => m.PresenceComponent,
              ),
          },
        ],
      },
    ],
  },

  // 👨‍💼 Admin (layout séparé)
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
      {
        path: 'configuration',
        loadComponent: () =>
          import('./features/admin/configuration/admin-configuration.component').then(
            (m) => m.AdminConfigurationComponent,
          ),
      },
      /*  {
        path: 'activites',
        loadComponent: () =>
          import('./features/admin/activities/admin-activities.component').then(
            (m) => m.AdminActivitiesComponent,
          ),
      },
      {
        path: 'activites/:id/presences',
        loadComponent: () =>
          import('./features/admin/activities/activity-presence/activity-presence.component').then(
            (m) => m.ActivityPresenceComponent,
          ),
      },
      {
        path: 'articles',
        loadComponent: () =>
          import('./features/admin/articles/admin-articles.component').then(
            (m) => m.AdminArticlesComponent,
          ),
      },*/
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/users/admin-users.component').then(
            (m) => m.AdminUsersComponent,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/admin/analytics/analytics.component').then(
            (m) => m.AnalyticsComponent,
          ),
      },
    ],
  },

  // 404
  {
    path: '**',
    loadComponent: () =>
      import('./features/shared/components/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
