import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StockService, Stock } from '../../core/services/stock.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ScreenerService } from '../../core/services/screener.service';

@Component({
  selector: 'app-screener',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './screener.component.html',
  styleUrl: './screener.component.scss'
})
export class ScreenerComponent implements OnInit, OnDestroy {
  private stockService = inject(StockService);
  private screenerService = inject(ScreenerService);
  filteredStocks: Stock[] = [];
  searchQuery = '';
  sectors$ = this.stockService.getSectors();
  isLoading = false;
  error = '';
  
  filters = {
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    sector: '',
    minVolume: undefined as number | undefined
  };

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.applyFilters();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters(): void {
    const criteria: Record<string, any> = {
      minPrice: this.filters.minPrice,
      maxPrice: this.filters.maxPrice,
      sector: this.filters.sector || undefined,
      minVolume: this.filters.minVolume ? this.filters.minVolume * 1000000 : undefined
    };

    this.isLoading = true;
    this.error = '';

    this.screenerService.runScreener(criteria)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          console.log('Screener response:', res);
          this.filteredStocks = res.results || [];
          console.log('Filtered stocks updated:', this.filteredStocks);
          this.isLoading = false;
        },
        error: err => {
          this.isLoading = false;
          this.error = err?.error?.error || err?.message || 'Failed to run screener.';
          console.error('Screener error', err);
        }
      });
  }

  onSearch(query: string): void {
    if (!query.trim()) {
      this.applyFilters();
      return;
    }

    // For now, run screener with current filters and a text query if backend supports it
    const criteria: Record<string, any> = {
      ...this.filters,
      query
    };
    if (criteria['minVolume']) {
      criteria['minVolume'] = criteria['minVolume'] * 1000000;
    }

    this.isLoading = true;
    this.error = '';

    this.screenerService.runScreener(criteria)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          console.log('Search response:', res);
          this.filteredStocks = res.results || [];
          console.log('Filtered stocks updated from search:', this.filteredStocks);
          this.isLoading = false;
        },
        error: err => {
          this.isLoading = false;
          this.error = err?.error?.error || err?.message || 'Failed to run screener.';
        }
      });
  }

  resetFilters(): void {
    this.filters = {
      minPrice: undefined,
      maxPrice: undefined,
      sector: '',
      minVolume: undefined
    };
    this.searchQuery = '';
    this.applyFilters();
  }
}
