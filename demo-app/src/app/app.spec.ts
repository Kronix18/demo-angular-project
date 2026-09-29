import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';

const TEST_EMAIL = 'admin@demo.angular-project.local';

describe('App — navbar composition', () => {
  let fixture: ComponentFixture<App>;
  let navbar: HTMLElement;

  /** Angular keeps the attribute name as written in the template ("routerLink"). */
  const routerTarget = (el: Element | null): string | null => {
    if (!el) return null;
    return el.getAttribute('routerLink') ?? el.getAttribute('routerlink');
  };

  const textsOf = (selector: string): string[] =>
    Array.from(navbar.querySelectorAll(selector)).map((el) =>
      (el.textContent ?? '').trim()
    );

  const anchorWithText = (selector: string, label: string): HTMLAnchorElement | undefined =>
    Array.from(navbar.querySelectorAll(selector)).find(
      (el): el is HTMLAnchorElement => (el.textContent ?? '').trim() === label
    );

  const seedLoggedIn = (): void => {
    // Seed BEFORE the component (and its root-provided AuthService) is created,
    // simulating an existing session — proven pattern from auth.service.spec.ts.
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('userEmail', TEST_EMAIL);
  };

  const createFixture = async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes, withDisabledInitialNavigation())],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    fixture.detectChanges(); // runs ngOnInit -> isLoggedIn$ subscription
    await fixture.whenStable();
    fixture.detectChanges();
    navbar = (fixture.nativeElement as HTMLElement).querySelector(
      'nav.navbar'
    ) as HTMLElement;
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('logged out: shows Home, Screener, Pricing nav links plus Login/Register; hides My Account and Logout', async () => {
    await createFixture();

    // Nav links are ungated: all three render without authentication
    // (Screener must NOT be hidden behind *ngIf="isAuthenticated").
    const expectedTargets: Record<string, string> = {
      Home: '/home',
      Screener: '/screener',
      Pricing: '/pricing',
    };
    for (const [label, target] of Object.entries(expectedTargets)) {
      const anchor = anchorWithText('.nav-links a', label);
      // eslint-disable-next-line no-console
      if (!anchor) console.error(`nav link "${label}" missing when logged out`);
      expect(anchor).toBeDefined();
      expect(routerTarget(anchor ?? null)).toBe(target);
    }

    // Right side logged OUT: Login + Register visible.
    const loggedOutActions = textsOf('.nav-actions a, .nav-actions button');
    expect(loggedOutActions).toContain('Login');
    expect(loggedOutActions).toContain('Register');

    // Right side logged OUT: My Account + Logout must NOT render.
    expect(navbar.querySelector('a.account-link')).toBeNull();
    expect(navbar.querySelector('button.logout-btn')).toBeNull();
    const loggedOutTexts = textsOf('.nav-actions a, .nav-actions button, .nav-actions span');
    expect(loggedOutTexts).not.toContain('My Account');
    expect(loggedOutTexts).not.toContain('Logout');
  });

  it('logged in (seeded sessionStorage): shows My Account (title = user email, target /profile) + Logout; hides Login/Register and the "Logged In" badge', async () => {
    seedLoggedIn();
    await createFixture();

    // Right side logged IN: My Account link with the user email as title.
    const accountLink = navbar.querySelector(
      '.nav-actions a.account-link'
    ) as HTMLAnchorElement | null;
    if (!accountLink) console.error('My Account link missing when logged in');
    expect(accountLink).not.toBeNull();
    expect((accountLink?.textContent ?? '').trim()).toBe('My Account');
    expect(accountLink?.getAttribute('title')).toBe(TEST_EMAIL);
    expect(routerTarget(accountLink)).toBe('/profile');

    // Right side logged IN: Logout button visible.
    expect(navbar.querySelector('button.logout-btn')).not.toBeNull();

    // Nav links stay visible when logged in too.
    for (const label of ['Home', 'Screener', 'Pricing']) {
      const anchor = anchorWithText('.nav-links a', label);
      if (!anchor) console.error(`nav link "${label}" missing when logged in`);
      expect(anchor).toBeDefined();
    }

    // Right side logged IN: Login/Register must NOT render.
    const loggedInActions = textsOf('.nav-actions a, .nav-actions button');
    expect(loggedInActions).not.toContain('Login');
    expect(loggedInActions).not.toContain('Register');

    // The passive "✓ Logged In" badge is replaced by the My Account link.
    expect(navbar.querySelector('.auth-status')).toBeNull();
  });

  it('clicking Logout calls AuthService.logout and navigates to /auth/login', async () => {
    seedLoggedIn();
    await createFixture();

    const authService = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const logoutSpy = vi.spyOn(authService, 'logout');
    const navigateSpy = vi.spyOn(router, 'navigate');

    (navbar.querySelector('button.logout-btn') as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });

  it('renders no inline style attributes in the navbar (design-token compliance)', async () => {
    seedLoggedIn(); // render the fullest navbar (My Account + Logout present)
    await createFixture();

    const inlineStyled = navbar.querySelectorAll('[style]');
    if (inlineStyled.length > 0) {
      console.error(
        'navbar elements with inline styles: ' +
          Array.from(inlineStyled).map((el) => el.tagName).join(', ')
      );
    }
    expect(inlineStyled.length).toBe(0);
  });

  describe('navigation (6.1)', () => {
    const hrefOf = (label: string) => anchorWithText('.nav-links a', label)?.getAttribute('href');
    const activeLabels = () =>
      Array.from(navbar.querySelectorAll('.nav-links a.active')).map((a) => (a.textContent ?? '').trim());

    it('Charts link exists in both auth states, pointing at the default symbol', async () => {
      await createFixture();
      expect(hrefOf('Charts')).toBe('/charts/msft');
      TestBed.resetTestingModule();
      seedLoggedIn();
      await createFixture();
      expect(hrefOf('Charts')).toBe('/charts/msft');
    });

    it('the link for the current route gets the active class', async () => {
      await createFixture();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/pricing');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(activeLabels()).toEqual(['Pricing']);
    });

    it('chart routes flag the shell fullscreen (compact navbar, no footer)', async () => {
      await createFixture();
      const container = fixture.nativeElement.querySelector('.app-container') as HTMLElement;
      expect(container.classList.contains('fullscreen')).toBe(false);
      expect(fixture.nativeElement.querySelector('footer')).toBeTruthy();
      const route = routes.find((r) => r.path === 'charts/:symbol');
      expect(route?.data?.['fullscreen']).toBe(true);
    });
  });
});
