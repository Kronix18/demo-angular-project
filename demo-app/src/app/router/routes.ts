import { Routes } from '@angular/router';

export const PUBLIC_ROUTES: Routes = [
  { path: '', loadComponent: () => import('../pages/homepage/homepage.component').then(m => m.HomepageComponent) },
];

export const AUTH_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('../features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('../features/auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'charts/:symbol', loadComponent: () => import('../charts/chart-viewer/chart-viewer.component').then(m => m.ChartViewerComponent) },
];

export const APP_ROUTES: Routes = [...PUBLIC_ROUTES, ...AUTH_ROUTES];