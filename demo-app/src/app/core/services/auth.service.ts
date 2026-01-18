import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, delay, of, map } from 'rxjs';

export interface AuthToken {
  token: string;
  expiry: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenSubject = new BehaviorSubject<string | null>(
    localStorage.getItem('auth_token')
  );

  token$ = this.tokenSubject.asObservable();
  isAuthenticated$ = this.tokenSubject.asObservable().pipe(
    map(token => !!token)
  );

  login(username: string, password: string): Observable<AuthToken> {
    // Mock JWT token (in real app, this would come from server)
    const mockToken = this.generateMockJWT(username);
    
    return of({
      token: mockToken,
      expiry: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    }).pipe(
      delay(1000) // Simulate network delay
    );
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    this.tokenSubject.next(null);
  }

  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
    this.tokenSubject.next(token);
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  private generateMockJWT(username: string): string {
    // Simple mock JWT format: header.payload.signature
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      username: username
    }));
    const signature = btoa('mock-signature-' + Math.random());
    
    return `${header}.${payload}.${signature}`;
  }
}
