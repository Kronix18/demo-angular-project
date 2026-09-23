import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly ADMIN_EMAIL = 'admin@demo.angular-project.local';
  private readonly ADMIN_PASSWORD = 'changeme';
  // Rehydrate from sessionStorage so a page refresh keeps the user logged in
  // (the subject must start with the persisted value, not a hardcoded false).
  private isLoggedInSubject = new BehaviorSubject<boolean>(
    sessionStorage.getItem('isLoggedIn') === 'true'
  );
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  login(credentials: LoginCredentials): Observable<boolean> {
    const { email, username, password } = credentials;
    const identifier = email || username;
    if (identifier === this.ADMIN_EMAIL && password === this.ADMIN_PASSWORD) {
      sessionStorage.setItem('isLoggedIn', 'true');
      sessionStorage.setItem('userEmail', identifier);
      this.isLoggedInSubject.next(true);
      return of(true);
    } else {
      return of(false);
    }
  }

  logout(): void {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('userEmail');
    this.isLoggedInSubject.next(false);
  }

  isLoggedIn(): boolean {
    return sessionStorage.getItem('isLoggedIn') === 'true';
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  getUserEmail(): string | null {
    return sessionStorage.getItem('userEmail');
  }

  // For demo, we return a fixed token if logged in
  getAccessToken(): string | null {
    return this.isLoggedIn() ? 'demo-access-token' : null;
  }

  getRefreshToken(): string | null {
    return this.isLoggedIn() ? 'demo-refresh-token' : null;
  }

  getCurrentUser(): any {
    const email = this.getUserEmail();
    if (email) {
      return {
        email,
        username: email.split('@')[0],
        accessToken: this.getAccessToken()
      };
    }
    return null;
  }

  register(credentials: RegisterCredentials): Observable<boolean> {
    // For demo, we only allow registration of the admin email (which is just a login)
    if (credentials.email === this.ADMIN_EMAIL && credentials.password === this.ADMIN_PASSWORD) {
      return this.login({ email: credentials.email, password: credentials.password });
    }
    // In a real app, we would call the backend to register a new user.
    // For now, reject any other registration.
    return of(false);
  }

  verifyEmail(token: string): Observable<void> {
    // For demo, we assume email verification is always successful.
    return of(undefined);
  }
}