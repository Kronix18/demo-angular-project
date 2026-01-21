import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
  styleUrl: './screener.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScreenerComponent implements OnInit, OnDestroy {
  private stockService = inject(StockService);
  private screenerService = inject(ScreenerService);
  private cdr = inject(ChangeDetectorRef);
  
  allStocks: Stock[] = []; // All data from backend
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
    this.loadAllStocks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllStocks(): void {
    console.log('Loading all stocks from screener...');
    this.isLoading = true;
    this.error = '';

    this.screenerService.runScreener({})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          console.log('All stocks loaded:', res.results?.length);
          this.allStocks = res.results || [];
          this.applyFiltersLocal();
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          this.isLoading = false;
          this.error = err?.error?.error || err?.message || 'Failed to load stocks.';
          console.error('Screener error', err);
          this.cdr.markForCheck();
        }
      });
  }

  applyFiltersLocal(): void {
    console.log('Applying local filters. Total stocks:', this.allStocks.length);
    
    this.filteredStocks = this.allStocks.filter(stock => {
      // Price filter
      if (this.filters.minPrice !== undefined && stock.price < this.filters.minPrice) {
        return false;
      }
      if (this.filters.maxPrice !== undefined && stock.price > this.filters.maxPrice) {
        return false;
      }

      // Sector filter
      if (this.filters.sector && stock.sector !== this.filters.sector) {
        return false;
      }

      // Volume filter (convert from millions to actual volume)
      if (this.filters.minVolume !== undefined) {
        const minVolumeActual = this.filters.minVolume * 1000000;
        if (stock.volume < minVolumeActual) {
          return false;
        }
      }

      // Search query filter
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        const matchesTicker = stock.ticker?.toLowerCase().includes(query);
        const matchesName = stock.name?.toLowerCase().includes(query);
        if (!matchesTicker && !matchesName) {
          return false;
        }
      }

      return true;
    });

    console.log('Filtered stocks:', this.filteredStocks.length);
  }

  onFilterChange(): void {
    console.log('Filter changed');
    this.applyFiltersLocal();
  }

  onSearch(query: string): void {
    console.log('Search query:', query);
    this.searchQuery = query;
    this.applyFiltersLocal();
  }

  resetFilters(): void {
    this.filters = {
      minPrice: undefined,
      maxPrice: undefined,
      sector: '',
      minVolume: undefined
    };
    this.searchQuery = '';
    this.applyFiltersLocal();
  }
}
