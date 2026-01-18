import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StockService, Stock } from '../../core/services/stock.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-screener',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './screener.component.html',
  styleUrl: './screener.component.scss'
})
export class ScreenerComponent implements OnInit, OnDestroy {
  private stockService = inject(StockService);
  filteredStocks: Stock[] = [];
  searchQuery = '';
  sectors$ = this.stockService.getSectors();
  
  filters = {
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    minPE: undefined as number | undefined,
    maxPE: undefined as number | undefined,
    minDividend: undefined as number | undefined,
    sector: '',
    minVolume: undefined as number | undefined
  };

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.stockService.getStocks()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stocks => {
        this.filteredStocks = stocks;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters(): void {
    const criteria = {
      minPrice: this.filters.minPrice,
      maxPrice: this.filters.maxPrice,
      minPE: this.filters.minPE,
      maxPE: this.filters.maxPE,
      minDividend: this.filters.minDividend,
      sector: this.filters.sector || undefined,
      minVolume: this.filters.minVolume ? this.filters.minVolume * 1000000 : undefined
    };

    this.stockService.filterStocks(criteria)
      .pipe(takeUntil(this.destroy$))
      .subscribe(stocks => {
        this.filteredStocks = stocks;
      });
  }

  onSearch(query: string): void {
    if (!query.trim()) {
      this.applyFilters();
      return;
    }

    this.stockService.searchStocks(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe(stocks => {
        this.filteredStocks = stocks;
      });
  }

  resetFilters(): void {
    this.filters = {
      minPrice: undefined,
      maxPrice: undefined,
      minPE: undefined,
      maxPE: undefined,
      minDividend: undefined,
      sector: '',
      minVolume: undefined
    };
    this.searchQuery = '';
    this.applyFilters();
  }
}
