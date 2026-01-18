import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  name = '';
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

    // Call real AuthService register method
    this.authService.register({
      name: this.username,
      username: this.username,
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => {
        this.isRegistered = true;
        this.isLoading = false;
        
        // Redirect to success page with masked email
        setTimeout(() => {
          this.router.navigate(['/auth/registration-success'], {
            queryParams: { email: this.email }
          });
        }, 800);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = this.getErrorMessage(err);
      }
    });
  }

  private getErrorMessage(err: any): string {
    // Check if it's an HTTP error response
    if (err.originalError?.status || err.status) {
      const status = err.originalError?.status || err.status;
      
      switch (status) {
        case 409:
          return 'An account with this email or username already exists. Please use a different one or login.';
        case 400:
          return err.message || 'Invalid registration data. Please check your information and try again.';
        case 422:
          return 'Validation failed. Please ensure your email is valid and password meets requirements.';
        case 500:
          return 'Server error occurred. Please try again later.';
        case 503:
          return 'Service temporarily unavailable. Please try again in a few moments.';
        case 0:
          return 'Network error. Please check your internet connection and try again.';
        default:
          return err.message || `Registration failed (Error ${status}). Please try again.`;
      }
    }

    // Handle network/timeout errors
    if (err.name === 'TimeoutError') {
      return 'Request timed out. Please check your connection and try again.';
    }

    // Handle generic errors
    return err.message || 'Registration failed. Please try again.';
  }
}
