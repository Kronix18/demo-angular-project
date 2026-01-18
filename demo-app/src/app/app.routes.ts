import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ScreenerComponent } from './features/screener/screener.component';
import { StockComponent } from './features/stock/stock.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/screener',
    pathMatch: 'full'
  },
  {
    path: 'screener',
    component: ScreenerComponent,
    data: { title: 'Stock Screener' },
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
