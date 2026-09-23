import { Component } from '@angular/core';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [],
  template: `
    <div class="homepage">
      <h1>Welcome to the Stock Screener</h1>
      <p>Use the navigation to explore the application.</p>
    </div>
  `,
  styles: [`
    .homepage {
      text-align: center;
      padding: 2rem;
    }
  `]
})
export class HomepageComponent {}