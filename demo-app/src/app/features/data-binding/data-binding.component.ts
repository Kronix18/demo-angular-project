import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-data-binding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="demo-container">
      <h2>Data Binding Demo</h2>

      <div class="section">
        <h3>1. Interpolation (One-way binding)</h3>
        <p>Component data: <strong>{{ message }}</strong></p>
        <p>Calculation: 5 + 3 = {{ 5 + 3 }}</p>
        <p>Current time: {{ currentTime | date: 'HH:mm:ss' }}</p>
      </div>

      <div class="section">
        <h3>2. Property Binding</h3>
        <button [disabled]="isButtonDisabled">
          {{ isButtonDisabled ? 'Disabled' : 'Enabled' }}
        </button>
        <img [src]="imageUrl" [alt]="imageAlt" style="width: 100px; border-radius: 8px;" />
        <p [style.color]="isActive ? 'green' : 'red'">
          Status: {{ isActive ? 'Active' : 'Inactive' }}
        </p>
      </div>

      <div class="section">
        <h3>3. Event Binding</h3>
        <button (click)="handleClick()">Click me</button>
        <input (keyup)="handleKeyUp($event)" placeholder="Type something..." />
        <p>Last key: {{ lastKey }}</p>
        <p>Click count: {{ clickCount }}</p>
      </div>

      <div class="section">
        <h3>4. Two-way Binding [(ngModel)]</h3>
        <input [(ngModel)]="name" placeholder="Enter your name" />
        <p>Hello, {{ name || 'Guest' }}!</p>
        
        <input type="number" [(ngModel)]="age" placeholder="Enter your age" />
        <p>You are {{ age }} years old</p>
      </div>

      <div class="section">
        <h3>5. Class Binding</h3>
        <div [class.active]="isActive" class="status-box">
          Class binding: {{ isActive ? 'Active' : 'Inactive' }}
        </div>
        <button (click)="toggleActive()">Toggle Active</button>
      </div>

      <div class="section">
        <h3>6. Style Binding</h3>
        <div [style.backgroundColor]="backgroundColor" 
             [style.padding]="'20px'" 
             [style.borderRadius]="'8px'"
             [style.color]="'white'">
          Style binding demo
        </div>
        <button (click)="changeColor()">Change Color</button>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }

    .section {
      margin: 30px 0;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #f9f9f9;
    }

    h3 {
      margin-top: 0;
      color: #333;
    }

    button {
      padding: 8px 16px;
      margin: 10px 5px 10px 0;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    button:hover {
      background: #0056b3;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    input {
      padding: 8px 12px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
      width: 100%;
      max-width: 300px;
      box-sizing: border-box;
    }

    .status-box {
      padding: 15px;
      border-radius: 4px;
      background: #e7e7e7;
      margin: 10px 0;
      transition: all 0.3s ease;
    }

    .status-box.active {
      background: #28a745;
      color: white;
    }

    p {
      margin: 10px 0;
      line-height: 1.6;
    }

    strong {
      color: #007bff;
    }
  `]
})
export class DataBindingComponent {
  message = 'Welcome to Data Binding!';
  currentTime = new Date();

  isButtonDisabled = false;
  imageUrl = 'https://via.placeholder.com/100';
  imageAlt = 'Placeholder image';
  isActive = true;

  lastKey = '';
  clickCount = 0;

  name = '';
  age = 0;

  backgroundColor = '#28a745';
  private colors = ['#28a745', '#007bff', '#dc3545', '#ffc107', '#17a2b8'];
  private colorIndex = 0;

  constructor() {
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  handleClick(): void {
    this.clickCount++;
  }

  handleKeyUp(event: KeyboardEvent): void {
    this.lastKey = (event.target as HTMLInputElement).value;
  }

  toggleActive(): void {
    this.isActive = !this.isActive;
  }

  changeColor(): void {
    this.colorIndex = (this.colorIndex + 1) % this.colors.length;
    this.backgroundColor = this.colors[this.colorIndex];
  }
}
