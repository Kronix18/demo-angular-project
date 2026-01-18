import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Create Account</h2>
        <p class="subtitle">Join our stock screener platform</p>

        <form (ngSubmit)="handleRegister()">
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email"
              id="email"
              [(ngModel)]="email"
              name="email"
              placeholder="you@example.com"
              required />
          </div>

          <div class="form-group">
            <label for="username">Username</label>
            <input 
              type="text"
              id="username"
              [(ngModel)]="username"
              name="username"
              placeholder="Choose a username"
              required />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password"
              id="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Min 6 characters"
              required />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input 
              type="password"
              id="confirmPassword"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              placeholder="Confirm password"
              required />
          </div>

          <button type="submit" [disabled]="isLoading">
            {{ isLoading ? 'Creating Account...' : 'Create Account' }}
          </button>
        </form>

        <div class="error-box" *ngIf="error">
          <p>{{ error }}</p>
        </div>

        <div class="success-box" *ngIf="isRegistered">
          <h4>✓ Registration Successful!</h4>
          <p>Your account has been created. Redirecting to login...</p>
        </div>

        <div class="login-link">
          Already have an account? <a routerLink="/auth/login">Login here</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .register-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 400px;
      width: 100%;
    }

    h2 {
      margin-top: 0;
      color: #333;
      text-align: center;
    }

    .subtitle {
      text-align: center;
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    label {
      margin-bottom: 8px;
      font-weight: bold;
      color: #333;
      font-size: 14px;
    }

    input {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: all 0.3s ease;
    }

    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    button {
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 10px;
    }

    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.3);
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error-box {
      margin-top: 20px;
      padding: 15px;
      background: #f8d7da;
      border-left: 4px solid #dc3545;
      border-radius: 4px;
      color: #721c24;
    }

    .error-box p {
      margin: 0;
    }

    .success-box {
      margin-top: 20px;
      padding: 15px;
      background: #d4edda;
      border-left: 4px solid #28a745;
      border-radius: 4px;
    }

    .success-box h4 {
      margin: 0 0 10px 0;
      color: #155724;
    }

    .success-box p {
      margin: 0;
      color: #155724;
    }

    .login-link {
      text-align: center;
      margin-top: 20px;
      font-size: 14px;
      color: #666;
    }

    .login-link a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .login-link a:hover {
      text-decoration: underline;
    }
  `]
})
export class RegisterComponent {
  email = '';
  username = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  isRegistered = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  handleRegister(): void {
    // Validation
    if (!this.email || !this.username || !this.password || !this.confirmPassword) {
      this.error = 'All fields are required';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters';
      return;
    }

    this.isLoading = true;
    this.error = '';

    // Simulate registration (in real app, would call backend)
    setTimeout(() => {
      this.isRegistered = true;
      this.isLoading = false;
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
      }, 2000);
    }, 1500);
  }
}
