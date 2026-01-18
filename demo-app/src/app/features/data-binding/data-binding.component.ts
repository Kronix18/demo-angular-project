import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-data-binding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-binding.component.html',
  styleUrl: './data-binding.component.scss'
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
