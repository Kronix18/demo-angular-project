import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../core/services/data.service';
import { UserService, User } from '../../core/services/user.service';
import { Subject, takeUntil, filter, map, Observable } from 'rxjs';

@Component({
  selector: 'app-observables',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="demo-container">
      <h2>Observables Demo</h2>

      <div class="section">
        <h3>1. Basic Observable Subscription</h3>
        <button (click)="subscribeToData()">Subscribe to Data</button>
        <button (click)="unsubscribeFromData()">Unsubscribe</button>
        
        <div *ngIf="dataItems.length > 0" class="data-list">
          <h4>Data Items:</h4>
          <ul>
            <li *ngFor="let item of dataItems">
              {{ item.title }} - Value: {{ item.value }}
            </li>
          </ul>
        </div>
      </div>

      <div class="section">
        <h3>2. Using Async Pipe</h3>
        <p>The async pipe automatically subscribes and unsubscribes from observables</p>
        
        <h4>Users (automatically subscribed):</h4>
        <div *ngIf="users$ | async as users">
          <ul>
            <li *ngFor="let user of users">
              {{ user.name }} ({{ user.role }}) - {{ user.email }}
            </li>
          </ul>
        </div>
      </div>

      <div class="section">
        <h3>3. Real-time Data Stream</h3>
        <p>Updates every 2 seconds:</p>
        <div class="realtime-value">
          Value: {{ realtimeValue$ | async }}
        </div>
      </div>

      <div class="section">
        <h3>4. Observable with Operators</h3>
        <p>Filtered users (role = 'user' only):</p>
        <div *ngIf="filteredUsers$ | async as users">
          <ul>
            <li *ngFor="let user of users">
              {{ user.name }} - {{ user.email }}
            </li>
          </ul>
        </div>
      </div>

      <div class="section">
        <h3>5. Subscription Management</h3>
        <p>Using takeUntil pattern to prevent memory leaks:</p>
        <button (click)="startSubscription()">Start Subscription</button>
        <button (click)="stopSubscription()">Stop Subscription</button>
        
        <div *ngIf="subscriptionActive" class="active-subscription">
          <p>✓ Subscription is active</p>
          <p>Subscription count: {{ subscriptionCount }}</p>
        </div>
        <div *ngIf="!subscriptionActive" class="inactive-subscription">
          <p>✗ Subscription is inactive</p>
        </div>
      </div>

      <div class="section">
        <h3>6. Combining Observables Pattern</h3>
        <p>Handling multiple observable subscriptions:</p>
        <div class="info-box">
          <p><strong>Users Count:</strong> {{ userCount }}</p>
          <p><strong>Data Items Count:</strong> {{ dataItemCount }}</p>
          <p><strong>Last Real-time Value:</strong> {{ lastRealtimeValue }}</p>
        </div>
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

    h4 {
      margin: 15px 0 10px 0;
      color: #555;
    }

    button {
      padding: 8px 16px;
      margin: 5px 5px 5px 0;
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

    .data-list {
      margin-top: 15px;
      padding: 15px;
      background: white;
      border-radius: 4px;
      border: 1px solid #ddd;
    }

    ul {
      list-style-position: inside;
      padding: 0;
    }

    li {
      padding: 8px;
      margin: 4px 0;
      background: #f0f0f0;
      border-radius: 4px;
    }

    .realtime-value {
      padding: 20px;
      background: white;
      border: 2px solid #007bff;
      border-radius: 4px;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: #007bff;
      animation: pulse 0.5s ease-in-out;
    }

    @keyframes pulse {
      0% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
      }
    }

    .active-subscription {
      padding: 15px;
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
    }

    .inactive-subscription {
      padding: 15px;
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
    }

    .info-box {
      padding: 15px;
      background: white;
      border-radius: 4px;
      border: 1px solid #ddd;
    }

    .info-box p {
      margin: 10px 0;
      line-height: 1.6;
    }

    p {
      margin: 10px 0;
      line-height: 1.6;
      color: #555;
    }
  `]
})
export class ObservablesComponent implements OnInit, OnDestroy {
  dataItems: any[] = [];
  userCount = 0;
  dataItemCount = 0;
  lastRealtimeValue = 0;
  subscriptionActive = false;
  subscriptionCount = 0;

  users$: Observable<any[]>;
  realtimeValue$: Observable<number>;
  filteredUsers$: Observable<any[]>;

  private destroy$ = new Subject<void>();
  private subscriptionTimer: any;

  constructor(
    private dataService: DataService,
    private userService: UserService
  ) {
    this.users$ = this.userService.getUsers();
    this.realtimeValue$ = this.dataService.realtimeData$;
    this.filteredUsers$ = this.userService.getUsers().pipe(
      map(users => users.filter(u => u.role === 'user'))
    );
  }

  ngOnInit(): void {
    // Subscribe to users
    this.userService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.userCount = users.length;
      });

    // Subscribe to data
    this.dataService.getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        this.dataItemCount = items.length;
      });

    // Subscribe to real-time data
    this.realtimeValue$
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.lastRealtimeValue = value;
      });
  }

  subscribeToData(): void {
    this.dataService.getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        this.dataItems = items;
      });
  }

  unsubscribeFromData(): void {
    this.dataItems = [];
  }

  startSubscription(): void {
    this.subscriptionActive = true;
    this.subscriptionCount = 0;

    this.subscriptionTimer = setInterval(() => {
      this.subscriptionCount++;
    }, 1000);
  }

  stopSubscription(): void {
    this.subscriptionActive = false;
    if (this.subscriptionTimer) {
      clearInterval(this.subscriptionTimer);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.subscriptionTimer) {
      clearInterval(this.subscriptionTimer);
    }
  }
}
