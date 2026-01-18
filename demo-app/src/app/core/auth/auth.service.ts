import { Injectable, signal, effect } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from '../services/api.service';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  username: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    is_admin?: boolean;
  };
}

export interface VerificationResponse {
  message: string;
  user_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  private isLoggedIn = new BehaviorSubject<boolean>(this.hasToken());
  public isLoggedIn$: Observable<boolean> = this.isLoggedIn.asObservable();

  private currentUser = signal<any>(this.getStoredUser());

  constructor(private apiService: ApiService) {
    // Persist current user when it changes
    effect(() => {
      const user = this.currentUser();
      if (user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }
    });
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.apiService.post<AuthResponse>('auth/login', credentials).pipe(
      tap(response => {
        this.setToken(response.token);
        // Set admin flag if username matches admin username (configurable)
        const adminUsername = 'kevin'; // Change this to your admin username
        const user = {
          ...response.user,
          is_admin: credentials.username === adminUsername || response.user.is_admin
        };
        this.currentUser.set(user);
        this.isLoggedIn.next(true);
      }),
      catchError(error => {
        this.isLoggedIn.next(false);
        throw error;
      })
    );
  }

  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    return this.apiService.post<AuthResponse>('auth/register', credentials).pipe(
      tap(response => {
        this.setToken(response.token);
        const user = {
          ...response.user,
          is_admin: false
        };
        this.currentUser.set(user);
        this.isLoggedIn.next(true);
      }),
      catchError(error => {
        this.isLoggedIn.next(false);
        throw error;
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isLoggedIn.next(false);
  }

  isAuthenticated(): boolean {
    return this.hasToken() && this.isLoggedIn.value;
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): any {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  verifyEmail(token: string): Observable<VerificationResponse> {
    console.log('AuthService.verifyEmail called');
    console.log('Sending verification request with token:', token);
    
    // Send token in the request body (backend expects it there, not as query parameter)
    return this.apiService.post<VerificationResponse>('auth/verify-email', { token }).pipe(
      tap(response => {
        console.log('Email verification successful:', response);
        // Email is now verified, user needs to login manually
      }),
      catchError(error => {
        console.error('Email verification API error:', error);
        throw error;
      })
    );
  }
}
