import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chart-toolbar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="toolbar">
      <div class="toolbar-group">
        <label for="symbol">Symbol:</label>
        <input type="text" id="symbol" [(ngModel)]="symbol" (ngModelChange)="onSymbolChange($event)" placeholder="Enter stock symbol (e.g., AAPL)">
      </div>
      
      <div class="toolbar-group">
        <label for="interval">Interval:</label>
        <select id="interval" [(ngModel)]="interval" (ngModelChange)="onIntervalChange($event)">
          <option value="1m">1 Minute</option>
          <option value="5m">5 Minutes</option>
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="1w">1 Week</option>
        </select>
      </div>
      
      <div class="toolbar-group">
        <button type="button" (click)="updateChart()">Update Chart</button>
      </div>
    </div>
  `,
  styles: [`
    .toolbar {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      background-color: var(--surface-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-elevation-low);
    }
    
    .toolbar-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    
    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
    }
    
    input, select {
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      background-color: var(--surface-color);
      color: var(--text-primary);
      font-size: 0.875rem;
    }
    
    input:focus, select:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.25);
    }
    
    button {
      padding: 0.5rem 1rem;
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
    }
    
    button:hover {
      background-color: var(--primary-color-dark);
    }
    
    button:disabled {
      background-color: var(--disabled-color);
      cursor: not-allowed;
    }
  `]
})
export class ChartToolbarComponent implements OnInit {
  @Output() symbolChange = new EventEmitter<string>();
  @Output() intervalChange = new EventEmitter<string>();
  
  symbol = 'AAPL';
  interval = '1d';
  
  // For demo, we'll use a fixed list of symbols
  // In a real app, this would come from an API or service
  symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NFLX', 'NVDA'];
  
  constructor(
    private fb: FormBuilder
  ) {
    // We don't really need the form for now, but we can keep it for future validation
    // this.chartForm = this.fb.group({
    //   symbol: ['AAPL', Validators.required],
    //   interval: ['1d', Validators.required]
    // });
  }

  ngOnInit(): void {
    // Optional: Add symbol autocomplete or validation
  }

  onSymbolChange(event: any): void {
    this.symbol = event.target.value;
    this.symbolChange.emit(this.symbol);
  }

  onIntervalChange(event: any): void {
    this.interval = event.target.value;
    this.intervalChange.emit(this.interval);
  }

  updateChart(): void {
    // This method is now redundant because we update on change, but we keep it for the button
    // We can emit the current values again if needed, but the change events already fire on input.
    // For the button, we can just emit the current values.
    this.symbolChange.emit(this.symbol);
    this.intervalChange.emit(this.interval);
  }
}