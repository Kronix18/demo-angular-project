import { Injectable, signal, effect, inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
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
  access_token: string;
  refresh_token: string;
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

interface DecodedToken {
  exp: number;  // Expiration timestamp
  userId?: string;
  user_id?: string;
  email?: string;
  iat?: number; // Issued at
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'auth_user';
  private readonly TOKEN_EXPIRY_KEY = 'token_expiry';

  private isLoggedIn = new BehaviorSubject<boolean>(this.hasValidTokens());
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
        this.setTokens(response.access_token, response.refresh_token);
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
        this.setTokens(response.access_token, response.refresh_token);
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
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    this.currentUser.set(null);
    this.isLoggedIn.next(false);
    
    // Clear subscription data on logout
    // Note: Import SubscriptionService dynamically to avoid circular dependency
    import('../subscriptions/subscription.service').then(module => {
      const subscriptionService = inject(module.SubscriptionService);
      subscriptionService.clearSubscription();
    }).catch(err => console.error('Failed to clear subscription:', err));
  }

  isAuthenticated(): boolean {
    return this.hasValidTokens() && this.isLoggedIn.value;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    
    // Decode and store expiration time
    try {
      const decoded = this.decodeToken(accessToken);
      if (decoded?.exp) {
        localStorage.setItem(this.TOKEN_EXPIRY_KEY, decoded.exp.toString());
      }
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  }

  private hasValidTokens(): boolean {
    const accessToken = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    
    if (!accessToken || !refreshToken) {
      return false;
    }
    
    // Check if token is fully expired
    if (this.isTokenFullyExpired()) {
      console.log('Token expired, clearing auth state');
      this.logout();
      return false;
    }
    
    return true;
  }

  private getStoredUser(): any {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  /**
   * Decode JWT token without external library
   */
  private decodeToken(token: string): DecodedToken | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if access token is expired (with 5 minute buffer)
   */
  isTokenExpired(): boolean {
    const expiryStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryStr) return true;
    
    const expiry = parseInt(expiryStr, 10);
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    
    // Check if token expires in less than 5 minutes (300 seconds)
    // This gives buffer time to refresh
    return (expiry - now) < 300;
  }

  /**
   * Check if token is completely expired (no buffer)
   */
  private isTokenFullyExpired(): boolean {
    const expiryStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryStr) return true;
    
    const expiry = parseInt(expiryStr, 10);
    const now = Math.floor(Date.now() / 1000);
    
    return now >= expiry;
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }
    
    return this.apiService.post<AuthResponse>('auth/refresh', { 
      refresh_token: refreshToken 
    }).pipe(
      tap(response => {
        this.setTokens(response.access_token, response.refresh_token);
        console.log('Token refreshed successfully');
      }),
      catchError(error => {
        console.error('Failed to refresh token:', error);
        this.logout();
        throw error;
      })
    );
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTokenExpiryTime(): number {
    const expiryStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiryStr) return 0;
    
    const expiry = parseInt(expiryStr, 10);
    const now = Math.floor(Date.now() / 1000);
    
    return Math.max(0, expiry - now);
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
