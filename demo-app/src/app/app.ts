import { IconComponent } from './shared/icons/icon.component';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';
import { ChartStateService } from './core/services/chart-state.service';
import { Subject } from 'rxjs';
import { filter, startWith, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private chartState = inject(ChartStateService);
  readonly theme = inject(ThemeService);
  readonly themeIcon: Record<string, string> = { system: 'contrast', light: 'sun', dark: 'moon' };
  private destroy$ = new Subject<void>();

  isAuthenticated = false;
  userEmail = '';
  title = 'Stock Screener';
  /** Routes flagged `data.fullscreen` get a compact navbar, no footer and no page scroll (charts). */
  fullscreen = signal(false);
  /** The navbar's Charts link reopens the last-viewed symbol. */
  chartsSymbol = signal(this.chartState.snapshot().symbol);

  ngOnInit(): void {
    this.chartState.state$.pipe(takeUntil(this.destroy$)).subscribe((s) => this.chartsSymbol.set(s.symbol));
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
