import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, retry, timeout, retryWhen, delayWhen, take } from 'rxjs/operators';
import { timer } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://localhost:3000';
  private readonly maxRetries = 3;
  private readonly timeoutMs = 10000;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`).pipe(
      timeout(this.timeoutMs),
      retryWhen(errors =>
        errors.pipe(
          delayWhen((error, index) => {
            if (index >= this.maxRetries) {
              return throwError(() => error);
            }
            const delayMs = Math.pow(2, index) * 1000;
            console.warn(`Retry attempt ${index + 1} after ${delayMs}ms`, error);
            return timer(delayMs);
          }),
          take(this.maxRetries)
        )
      ),
      catchError(error => this.handleError(error))
    );
  }

  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, data).pipe(
      timeout(this.timeoutMs),
      catchError(error => this.handleError(error))
    );
  }

  put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}/${endpoint}`, data).pipe(
      timeout(this.timeoutMs),
      catchError(error => this.handleError(error))
    );
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}/${endpoint}`).pipe(
      timeout(this.timeoutMs),
      catchError(error => this.handleError(error))
    );
  }

  private handleError(error: any) {
    let errorMessage = 'An unexpected error occurred';

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
    return throwError(() => ({ message: errorMessage, originalError: error }));
  }
}

