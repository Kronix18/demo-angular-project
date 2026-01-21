import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.getCurrentUser();

  initials = computed(() => {
    const name = this.user()?.name || '';
    const parts = name.trim().split(' ').filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || 'U';
  });

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
