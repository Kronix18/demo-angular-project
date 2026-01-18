import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
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
    canActivate: [AuthGuard]
  },
  {
    path: 'stock/:symbol',
    component: StockComponent,
    data: { title: 'Stock Details' },
    canActivate: [AuthGuard]
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
