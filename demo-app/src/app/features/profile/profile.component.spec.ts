import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { ProfileComponent } from './profile.component';

const profile = { user_id: '1', username: 'admin', name: 'Demo Admin', email: 'admin@demo.angular-project.local', role: 'admin', email_status: 'verified' };

/** Regression: a SUCCESSFUL profile load used to throw (`getCurrentUser(...).set is not a function`); it never ran while the backend was down. */
describe('ProfileComponent profile loading', () => {
  function make(getProfile: () => unknown) {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('userEmail', profile.email);
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: UserService, useValue: { getProfile } }] });
    return TestBed.createComponent(ProfileComponent);
  }
  afterEach(() => sessionStorage.clear());

  it('stores the loaded profile and stops loading without throwing', () => {
    const f = make(() => of(profile));
    expect(() => f.detectChanges()).not.toThrow();
    const c = f.componentInstance;
    expect(c.userProfile()?.name).toBe('Demo Admin');
    expect(c.isLoading()).toBe(false);
    expect(c.error()).toBe('');
    expect(c.initials()).toBe('DA');
  });

  it('a failed load shows the error message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const f = make(() => throwError(() => ({ message: 'x' })));
    f.detectChanges();
    expect(f.componentInstance.error()).toContain('Failed to load profile');
    expect(f.componentInstance.isLoading()).toBe(false);
  });
});
