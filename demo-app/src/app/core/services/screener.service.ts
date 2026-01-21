import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Stock } from './stock.service';

export interface ScreenerFiltersResponse {
  filters: any;
}

export interface ScreenerRunResponse {
  results: Stock[];
  filters_used?: any;
  result_count?: number;
  timestamp?: string;
  meta?: any;
}

@Injectable({ providedIn: 'root' })
export class ScreenerService {
  constructor(private api: ApiService) {}

  getFilters(): Observable<ScreenerFiltersResponse> {
    return this.api.get<ScreenerFiltersResponse>('api/screener/filters');
  }

  runScreener(filters: Record<string, any>, limit = 50): Observable<ScreenerRunResponse> {
    // Screener can be heavier; allow longer timeout (45s)
    console.log('ScreenerService.runScreener called with:', { filters, limit });
    return this.api.post<ScreenerRunResponse>('api/screener/run', { filters, limit }, 45000);
  }
}
