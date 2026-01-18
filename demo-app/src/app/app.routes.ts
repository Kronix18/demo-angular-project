import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { DataBindingComponent } from './features/data-binding/data-binding.component';
import { DirectivesComponent } from './features/directives/directives.component';
import { FormsComponent } from './features/forms/forms.component';
import { ObservablesComponent } from './features/observables/observables.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: DataBindingComponent,
    data: { title: 'Data Binding' }
  },
  {
    path: 'data-binding',
    component: DataBindingComponent,
    data: { title: 'Data Binding' }
  },
  {
    path: 'directives',
    component: DirectivesComponent,
    data: { title: 'Directives' }
  },
  {
    path: 'forms',
    component: FormsComponent,
    data: { title: 'Template-Driven Forms' }
  },
  {
    path: 'observables',
    component: ObservablesComponent,
    data: { title: 'Observables' },
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
