import { Injectable, inject } from '@angular/core';
import { API_URL } from '../api-url';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = inject(API_URL);
  private readonly timeoutMs = 10000;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;
    console.log('ApiService GET request to:', url);
    // Authorization is attached by authInterceptor (task 12.4).
    return this.http.get<T>(url).pipe(
      timeout(this.timeoutMs),
      catchError(error => this.handleError(error, url))
    );
  }

  post<T>(endpoint: string, data: any, customTimeoutMs?: number): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;
    console.log('ApiService POST request to:', url);

    const toMs = customTimeoutMs ?? this.timeoutMs;
    console.log(`Request timeout: ${toMs}ms`);

    return this.http.post<T>(url, data).pipe(
      timeout(toMs),
      catchError(error => this.handleError(error, url))
    );
  }

  put<T>(endpoint: string, data: any): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;
    return this.http.put<T>(url, data).pipe(
      timeout(this.timeoutMs),
      catchError(error => this.handleError(error, url))
    );
  }

  delete<T>(endpoint: string): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;
    return this.http.delete<T>(url).pipe(
      timeout(this.timeoutMs),
      catchError(error => this.handleError(error, url))
    );
  }

  private handleError(error: any, url?: string) {
    let errorMessage = 'An unexpected error occurred';

    console.error('API Error Details:', {
      url,
      error,
      status: error?.status,
      statusText: error?.statusText,
      errorBody: error?.error
    });

    if (error instanceof HttpErrorResponse) {
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
        if (error.error?.message) {
          errorMessage = error.error.message;
        }
      }
    } else if (error.name === 'TimeoutError') {
      errorMessage = 'Request timeout - the server took too long to respond';
    }

    console.error('API Error:', errorMessage);
    return throwError(() => ({ message: errorMessage, originalError: error, status: error?.status }));
  }
}

