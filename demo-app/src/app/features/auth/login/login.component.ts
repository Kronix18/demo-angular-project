import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  username = 'demo';
  password = 'password';
  isLoading = false;
  isAuthenticated = false;
  error = '';

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.isAuthenticated = true;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  handleLogin(): void {
    if (!this.username) {
      this.error = 'Please enter a username';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.login({
      username: this.username,
      password: this.password
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isAuthenticated = true;
          this.isLoading = false;
          this.goToDashboard();
        },
        error: (err) => {
          this.error = err?.message || 'Login failed. Please try again.';
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
