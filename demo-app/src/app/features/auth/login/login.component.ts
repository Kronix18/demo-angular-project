import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: [
    `
      .login-error {
        color: var(--auth-error-color);
        font-size: 14px;
        font-weight: 600;
        margin: 12px 0 0 0;
      }
    `,
  ],
  template: `
    <div class="login-page">
      <header>
        <nav>
          <a routerLink="/home">Home</a>
          <a routerLink="/auth/register">Sign Up</a>
        </nav>
      </header>

      <main class="login-form">
        <h2>Sign In</h2>
        <form (ngSubmit)="onSubmit()">
          <div>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" [(ngModel)]="email" required>
          </div>
          <div>
            <label for="password">Password</label>
            <input type="password" id="password" name="password" [(ngModel)]="password" required>
          </div>
          <button type="submit" class="primary">Sign In</button>
        </form>

        @if (errorMessage) {
          <p class="login-error">{{ errorMessage }}</p>
        }

        <p class="hint">
          For demo purposes, you can use the default account:
          <br><strong>Email:</strong> admin@demo.angular-project.local
          <br><strong>Password:</strong> changeme
        </p>
      </main>
    </div>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';

  private readonly route = inject(ActivatedRoute);

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    this.authService
      .login({ email: this.email, password: this.password })
      .subscribe((success) => {
        if (success) {
          this.errorMessage = '';
          // Where the guard intercepted the user from (e.g. /profile);
          // fall back to the home root when login was opened directly.
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigateByUrl(returnUrl || '/');
        } else {
          this.errorMessage = 'Invalid email or password';
        }
      });
  }
}
