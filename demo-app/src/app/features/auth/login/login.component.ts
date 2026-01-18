import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h2>Login</h2>
        <p class="subtitle">Demo Application - JWT & Interceptors Example</p>

        <form (ngSubmit)="handleLogin()">
          <div class="form-group">
            <label for="username">Username</label>
            <input 
              type="text"
              id="username"
              [(ngModel)]="username"
              name="username"
              placeholder="Enter username"
              disabled />
            <small>Try: 'demo' or 'user'</small>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password"
              id="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Enter password"
              disabled />
            <small>Any password works</small>
          </div>

          <button type="submit" [disabled]="isLoading">
            {{ isLoading ? 'Logging in...' : 'Login' }}
          </button>
        </form>

        <div class="info-box" *ngIf="!isAuthenticated">
          <h4>Demo Credentials</h4>
          <p>Username: demo</p>
          <p>Password: (any password)</p>
          <p class="note">This is a demo with mock JWT tokens</p>
        </div>

        <div class="success-box" *ngIf="isAuthenticated">
          <h4>✓ Login Successful!</h4>
          <p>JWT Token has been stored</p>
          <button type="button" (click)="goToDashboard()">
            Go to Dashboard
          </button>
          <button type="button" (click)="handleLogout()" class="logout">
            Logout
          </button>
        </div>

        <div class="error-box" *ngIf="error">
          <p>{{ error }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .login-card {
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
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    label {
      margin-bottom: 8px;
      font-weight: bold;
      color: #333;
    }

    input {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: all 0.3s ease;
    }

    input:not(:disabled):focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    input:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    small {
      margin-top: 4px;
      font-size: 12px;
      color: #999;
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

    button.logout {
      background: #6c757d;
      margin-top: 10px;
    }

    button.logout:hover {
      background: #5a6268;
    }

    .info-box {
      margin-top: 30px;
      padding: 15px;
      background: #e7f3ff;
      border-left: 4px solid #2196F3;
      border-radius: 4px;
      font-size: 13px;
    }

    .info-box h4 {
      margin: 0 0 10px 0;
      color: #1976D2;
    }

    .info-box p {
      margin: 5px 0;
      color: #555;
    }

    .info-box .note {
      margin-top: 10px;
      font-style: italic;
      color: #999;
    }

    .success-box {
      margin-top: 30px;
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
      margin: 5px 0;
      color: #155724;
    }

    .success-box button {
      width: 100%;
      margin-top: 15px;
      background: #28a745;
    }

    .success-box button:hover {
      background: #218838;
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
  `]
})
export class LoginComponent {
  username = 'demo';
  password = 'password';
  isLoading = false;
  isAuthenticated = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    if (this.authService.isAuthenticated()) {
      this.isAuthenticated = true;
    }
  }

  handleLogin(): void {
    if (!this.username) {
      this.error = 'Please enter a username';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.authService.setToken(response.token);
        this.isAuthenticated = true;
        this.isLoading = false;
        console.log('Login successful, token stored:', response.token.substring(0, 20) + '...');
      },
      error: (err) => {
        this.error = 'Login failed. Please try again.';
        this.isLoading = false;
      }
    });
  }

  handleLogout(): void {
    this.authService.logout();
    this.isAuthenticated = false;
    this.username = 'demo';
    this.password = 'password';
  }

  goToDashboard(): void {
    this.router.navigate(['/observables']);
  }
}
