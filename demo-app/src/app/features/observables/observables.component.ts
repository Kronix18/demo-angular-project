import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../core/services/data.service';
import { UserService, User } from '../../core/services/user.service';
import { Subject, takeUntil, filter, map, Observable } from 'rxjs';

@Component({
  selector: 'app-observables',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './observables.component.html',
  styleUrl: './observables.component.scss'
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
