import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
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
    this.router.navigate(['/screener']);
  }
}
