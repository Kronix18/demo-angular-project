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
        
        // Redirect to screener after 1.5 seconds
        setTimeout(() => {
          this.router.navigate(['/screener']);
        }, 1500);
      },
      error: (err) => {
        this.error = err.message || 'Registration failed. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
