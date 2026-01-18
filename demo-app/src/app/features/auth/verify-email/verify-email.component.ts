import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnInit {
  isVerifying = true;
  isSuccess = false;
  isError = false;
  errorMessage = '';
  countdown = 3;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];
    
    console.log('Email verification link clicked');
    console.log('Full URL:', window.location.href);
    console.log('Verification token from URL params:', token);
    
    if (!token) {
      this.handleError('No verification token provided. Invalid verification link.');
      return;
    }

    this.verifyEmail(token);
  }

  private verifyEmail(token: string): void {
    console.log('Starting email verification process with token:', token);
    
    // Call the actual auth service to verify email
    this.authService.verifyEmail(token).subscribe({
      next: (response) => {
        console.log('Email verification successful!', response);
        this.isVerifying = false;
        this.isSuccess = true;
        
        // Email verified successfully, redirect to login in 3 seconds
        this.startCountdown();
      },
      error: (err) => {
        console.error('Email verification error:', err);
        const errorMsg = err.message || err.originalError?.message || 'Verification failed';
        this.handleError(errorMsg);
      }
    });
  }

  private handleError(message: string): void {
    this.isVerifying = false;
    this.isError = true;
    this.errorMessage = this.getErrorMessage(message);
  }

  private getErrorMessage(message: string): string {
    if (message.includes('expired')) {
      return 'This verification link has expired. Please request a new verification email.';
    }
    if (message.includes('invalid') || message.includes('Invalid')) {
      return 'This verification link is invalid. Please check your email or request a new verification link.';
    }
    if (message.includes('already verified')) {
      return 'This email address has already been verified. You can proceed to login.';
    }
    return message || 'Email verification failed. Please try again or contact support.';
  }

  private startCountdown(): void {
    const interval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(interval);
        // Redirect to login after successful email verification
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  goToDashboard(): void {
    this.router.navigate(['/screener']);
  }

  resendVerification(): void {
    // In production, this would call the API to resend verification email
    this.router.navigate(['/auth/registration-success']);
  }
}
