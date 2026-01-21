import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ScreenerComponent } from './features/screener/screener.component';
import { StockComponent } from './features/stock/stock.component';
import { ProfileComponent } from './features/profile/profile.component';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    data: { title: 'Home' }
  },
  {
    path: 'home',
    component: HomeComponent,
    data: { title: 'Home' }
  },
  {
    path: 'screener',
    component: ScreenerComponent,
    data: { title: 'Stock Screener' },
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    component: ProfileComponent,
    data: { title: 'Your Profile' },
    canActivate: [authGuard]
  },
  {
    path: 'stock/:symbol',
    component: StockComponent,
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
