import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'super-admin',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'chamas', pathMatch: 'full' },
      {
        path: 'chamas',
        loadComponent: () =>
          import('./features/super-admin/tenants.component').then((m) => m.TenantsComponent),
      },
    ],
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./features/members/members.component').then((m) => m.MembersComponent),
      },
      {
        path: 'meetings',
        loadComponent: () =>
          import('./features/meetings/meetings.component').then((m) => m.MeetingsComponent),
      },
      {
        path: 'meetings/:id',
        loadComponent: () =>
          import('./features/meetings/meeting-dashboard.component').then((m) => m.MeetingDashboardComponent),
      },
      {
        path: 'contributions',
        loadComponent: () =>
          import('./features/contributions/contributions.component').then(
            (m) => m.ContributionsComponent
          ),
      },
      {
        path: 'loans',
        loadComponent: () =>
          import('./features/loans/loans.component').then((m) => m.LoansComponent),
      },
      {
        path: 'merry-go-round',
        loadComponent: () =>
          import('./features/merry-go-round/merry-go-round.component').then(
            (m) => m.MerryGoRoundComponent
          ),
      },
      {
        path: 'shares',
        loadComponent: () =>
          import('./features/shares/shares.component').then((m) => m.SharesComponent),
      },
      {
        path: 'welfare',
        loadComponent: () =>
          import('./features/welfare/welfare.component').then((m) => m.WelfareComponent),
      },
      {
        path: 'investments',
        loadComponent: () =>
          import('./features/investments/investments.component').then(
            (m) => m.InvestmentsComponent
          ),
      },
      {
        path: 'investments/:id',
        loadComponent: () =>
          import('./features/investments/investment-detail.component').then(
            (m) => m.InvestmentDetailComponent
          ),
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance.component').then((m) => m.FinanceComponent),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./features/roles/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
