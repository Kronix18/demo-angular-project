import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { RegistrationSuccessComponent } from './registration-success/registration-success.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'registration-success',
    component: RegistrationSuccessComponent
  },
  {
    path: 'verify-email',
    component: VerifyEmailComponent
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
