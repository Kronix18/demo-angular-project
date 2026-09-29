import { Routes } from '@angular/router';
import { HomepageComponent } from './pages/homepage/homepage.component';
import { authGuard } from './core/guards/auth.guard';
// We will create the rest of the components as placeholders below.

export const routes: Routes = [
  {
    path: '',
    component: HomepageComponent,
    data: { title: 'Home' }
  },
  {
    path: 'home',
    component: HomepageComponent,
    data: { title: 'Home' }
  },
  {
    path: 'pricing',
    loadComponent: () => import('./features/pricing/pricing.component').then(m => m.PricingComponent),
    data: { title: 'Pricing Plans' }
  },
  {
    path: 'screener',
    loadComponent: () => import('./features/screener/screener.component').then(m => m.ScreenerComponent),
    data: { title: 'Stock Screener' },
    canActivate: [authGuard]
  },
  {
    path: 'charts/:symbol',
    loadComponent: () => import('./charts/chart-viewer/chart-viewer.component').then(m => m.ChartViewerComponent),
    data: { title: 'Chart Viewer', fullscreen: true }
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    data: { title: 'Your Profile' },
    canActivate: [authGuard]
  },
  {
    path: 'stock/:symbol',
    loadComponent: () => import('./features/stock/stock.component').then(m => m.StockComponent),
    data: { title: 'Stock Details' },
    canActivate: [authGuard]
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];
