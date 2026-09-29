import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { Subject } from 'rxjs';
import { filter, startWith, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  isAuthenticated = false;
  userEmail = '';
  title = 'Stock Screener';
  /** Routes flagged `data.fullscreen` get a compact navbar, no footer and no page scroll (charts). */
  fullscreen = signal(false);

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), startWith(null), takeUntil(this.destroy$))
      .subscribe(() => {
        let r = this.route.snapshot;
        while (r.firstChild) r = r.firstChild;
        this.fullscreen.set(!!r.data?.['fullscreen']);
      });
    this.authService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuth => {
        this.isAuthenticated = isAuth;
        this.userEmail = isAuth ? this.authService.getUserEmail() ?? '' : '';
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  handleLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
