import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, timeout } from 'rxjs/operators';
import { AuthService, LoginCredentials, RegisterCredentials } from '../../core/auth/auth.service';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
    private authService = inject(AuthService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    isAuthenticated = this.authService.isAuthenticated();

    // login form
    loginData: LoginCredentials = { username: '', password: '' };
    loginLoading = false;
    loginError = '';

    // register form
    registerData: RegisterCredentials & { confirmPassword?: string } = { name: '', username: '', email: '', password: '', confirmPassword: '' } as RegisterCredentials & { confirmPassword?: string };
    registerLoading = false;
    registerError = '';
    registerSuccess = '';

    ngOnInit(): void {
        this.authService.isLoggedIn$
            .pipe(takeUntil(this.destroy$))
            .subscribe(isAuth => {
                this.isAuthenticated = isAuth;
            });
    }

    handleLogin(): void {
        if (this.loginLoading) return;
        this.loginError = '';
        this.loginLoading = true;

        this.authService.login(this.loginData)
            .pipe(
                timeout(10000),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: () => {
                    this.loginLoading = false;
                    this.router.navigate(['/screener']);
                },
                error: (err) => {
                    this.loginLoading = false;
                    this.loginError = this.resolveLoginError(err);
                    this.cdr.markForCheck();
                }
            });
    }

    handleRegister(): void {
        if (this.registerLoading) return;
        this.registerError = '';
        this.registerSuccess = '';

        // Validation
        if (this.registerData.password !== this.registerData.confirmPassword) {
            this.registerError = 'Passwords do not match';
            return;
        }

        if (this.registerData.password.length < 6) {
            this.registerError = 'Password must be at least 6 characters';
            return;
        }

        this.registerLoading = true;

        this.authService.register(this.registerData)
            .pipe(
                timeout(10000),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: () => {
                    this.registerLoading = false;
                    this.registerSuccess = 'Account created. Check your email to verify.';
                    this.router.navigate(['/auth/registration-success'], { queryParams: { email: this.registerData.email } });
                },
                error: (err) => {
                    this.registerLoading = false;
                    this.registerError = this.resolveRegisterError(err);
                    this.cdr.markForCheck();
                }
            });
    }

    resolveLoginError(err: any): string {
        const status = err.originalError?.status || err.status;
        
        if (status === 401) return 'Invalid credentials. Please try again.';
        if (status === 403) return 'Your account is not authorized.';
        if (status === 400) return err.error?.error || err.error?.message || 'Invalid login data provided.';
        if (status === 500) return 'Server error. Please try again later.';
        if (status === 0) return 'Network error. Please check your internet connection and try again.';

        if (err.name === 'TimeoutError') {
            return 'Request took too long. Please check your connection and try again.';
        }

        return err.error?.error || err.message || 'Login failed. Check your connection and try again.';
    }

    resolveRegisterError(err: any): string {
        const status = err.originalError?.status || err.status;
        
        switch (status) {
            case 409:
                return err.error?.error || 'An account with this email or username already exists. Please use a different one or login.';
            case 400:
                return err.error?.error || err.error?.message || 'Invalid registration data. Please check your information and try again.';
            case 422:
                return err.error?.error || 'Validation failed. Please ensure your email is valid and password meets requirements.';
            case 500:
                return 'Server error occurred. Please try again later.';
            case 503:
                return 'Service temporarily unavailable. Please try again in a few moments.';
            case 0:
                return 'Network error. Please check your internet connection and try again.';
            default:
                break;
        }

        if (err.name === 'TimeoutError') {
            return 'Request took too long. Please check your connection and try again.';
        }

        return err.error?.error || err.message || 'Registration failed. Please try again.';
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
