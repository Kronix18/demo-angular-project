import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-page">
      <header>
        <nav>
          <a routerLink="/">Home</a>
          <a routerLink="/register">Sign Up</a>
        </nav>
      </header>

      <main class="login-form">
        <h2>Sign In</h2>
        <form (ngSubmit)="onSubmit()">
          <div>
            <label for="email">Email</label>
            <input type="email" id="email" [(ngModel)]="email" required>
          </div>
          <div>
            <label for="password">Password</label>
            <input type="password" id="password" [(ngModel)]="password" required>
          </div>
          <button type="submit" class="primary">Sign In</button>
        </form>

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

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    if (this.authService.login({ email: this.email, password: this.password })) {
      // Login successful
      this.router.navigateByUrl('/');
    } else {
      // Login failed
      alert('Invalid email or password');
    }
  }
}