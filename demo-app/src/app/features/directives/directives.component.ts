import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Item {
  id: number;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  price: number;
}

@Component({
  selector: 'app-directives',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="demo-container">
      <h2>Directives Demo</h2>

      <div class="section">
        <h3>1. *ngIf - Conditional Rendering</h3>
        <button (click)="showContent = !showContent">
          {{ showContent ? 'Hide' : 'Show' }} Content
        </button>
        
        <div *ngIf="showContent" class="content-box">
          <p>This content is conditionally displayed!</p>
        </div>

        <div *ngIf="isLoggedIn; then loggedInTemplate else loggedOutTemplate"></div>
        <ng-template #loggedInTemplate>
          <p class="success">User is logged in</p>
        </ng-template>
        <ng-template #loggedOutTemplate>
          <p class="warning">User is logged out</p>
        </ng-template>
      </div>

      <div class="section">
        <h3>2. *ngFor - List Rendering</h3>
        <div *ngIf="items.length > 0; else noItems">
          <ul>
            <li *ngFor="let item of items; let idx = index; let isLast = last">
              {{ idx + 1 }}. {{ item.name }} - ${{ item.price }}
              <span *ngIf="isLast" class="badge">Last</span>
            </li>
          </ul>
        </div>
        <ng-template #noItems>
          <p>No items to display</p>
        </ng-template>
      </div>

      <div class="section">
        <h3>3. *ngSwitch - Switch Statements</h3>
        <label>
          Status:
          <select [(ngModel)]="selectedStatus">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </label>

        <div [ngSwitch]="selectedStatus">
          <div *ngSwitchCase="'active'" class="status-active">
            Status is Active
          </div>
          <div *ngSwitchCase="'inactive'" class="status-inactive">
            Status is Inactive
          </div>
          <div *ngSwitchCase="'pending'" class="status-pending">
            Status is Pending
          </div>
          <div *ngSwitchDefault>
            Unknown Status
          </div>
        </div>
      </div>

      <div class="section">
        <h3>4. [ngClass] - Dynamic Classes</h3>
        <button (click)="highlightedItem = (highlightedItem + 1) % 3">
          Highlight Next
        </button>
        
        <div *ngFor="let item of items.slice(0, 3); let idx = index"
             [ngClass]="{
               'highlight': idx === highlightedItem,
               'fade': idx !== highlightedItem
             }"
             class="item-card">
          {{ item.name }}
        </div>
      </div>

      <div class="section">
        <h3>5. [ngStyle] - Dynamic Styles</h3>
        <div *ngFor="let item of items.slice(0, 3)"
             [ngStyle]="{
               'backgroundColor': item.status === 'active' ? '#d4edda' : '#f8d7da',
               'color': item.status === 'active' ? '#155724' : '#721c24',
               'padding': '12px',
               'margin': '8px 0',
               'borderRadius': '4px'
             }">
          {{ item.name }} - {{ item.status }}
        </div>
      </div>

      <div class="section">
        <h3>6. [ngModel] - Attribute Binding</h3>
        <input [ngModel]="inputValue" 
               (ngModelChange)="inputValue = $event"
               placeholder="Type here..." />
        <p>Input value: {{ inputValue }}</p>
      </div>

      <div class="section">
        <h3>7. Filtered List with Multiple Directives</h3>
        <label>
          Filter by status:
          <select [(ngModel)]="filterStatus">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </label>

        <div *ngIf="filteredItems.length > 0; else noFiltered">
          <table class="items-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredItems" 
                  [ngClass]="'status-' + item.status">
                <td>{{ item.name }}</td>
                <td>
                  <span [ngClass]="'badge badge-' + item.status">
                    {{ item.status }}
                  </span>
                </td>
                <td>${{ item.price }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noFiltered>
          <p class="warning">No items match the selected filter</p>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 900px;
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

    button, select {
      padding: 8px 16px;
      margin: 10px 5px 10px 0;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background: #0056b3;
    }

    .content-box {
      padding: 15px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin: 10px 0;
    }

    .item-card {
      padding: 12px;
      margin: 8px 0;
      border-radius: 4px;
      transition: all 0.3s ease;
    }

    .item-card.highlight {
      background: #ffc107;
      font-weight: bold;
      transform: scale(1.02);
    }

    .item-card.fade {
      opacity: 0.5;
    }

    .status-active { color: #28a745; font-weight: bold; }
    .status-inactive { color: #dc3545; font-weight: bold; }
    .status-pending { color: #ffc107; font-weight: bold; }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: bold;
    }

    .badge-active {
      background: #d4edda;
      color: #155724;
    }

    .badge-inactive {
      background: #f8d7da;
      color: #721c24;
    }

    .badge-pending {
      background: #fff3cd;
      color: #856404;
    }

    .success { color: #28a745; }
    .warning { color: #ffc107; }

    ul {
      list-style-position: inside;
      padding: 0;
    }

    li {
      padding: 8px;
      margin: 4px 0;
      background: white;
      border-radius: 4px;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .items-table th,
    .items-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    .items-table th {
      background: #f5f5f5;
      font-weight: bold;
    }

    .items-table tr.status-active {
      background: #f0f8f5;
    }

    .items-table tr.status-inactive {
      background: #fdf5f5;
    }

    .items-table tr.status-pending {
      background: #fffaf0;
    }

    label {
      display: block;
      margin: 10px 0;
      font-weight: bold;
    }

    input, select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      width: 100%;
      max-width: 300px;
      box-sizing: border-box;
    }

    p {
      margin: 10px 0;
      line-height: 1.6;
    }
  `]
})
export class DirectivesComponent {
  showContent = false;
  isLoggedIn = true;
  selectedStatus = 'active';
  highlightedItem = 0;
  inputValue = '';
  filterStatus = '';

  items: Item[] = [
    { id: 1, name: 'Product A', status: 'active', price: 99.99 },
    { id: 2, name: 'Product B', status: 'inactive', price: 49.99 },
    { id: 3, name: 'Product C', status: 'pending', price: 79.99 },
    { id: 4, name: 'Product D', status: 'active', price: 129.99 },
    { id: 5, name: 'Product E', status: 'pending', price: 59.99 }
  ];

  get filteredItems(): Item[] {
    return this.filterStatus
      ? this.items.filter(item => item.status === this.filterStatus)
      : this.items;
  }
}
