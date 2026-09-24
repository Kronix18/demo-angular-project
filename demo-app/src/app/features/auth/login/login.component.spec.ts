import { TestBed, ComponentFixture } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
  withDisabledInitialNavigation,
} from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  // Real router providers (with disabled initial navigation) so RouterLink can
  // resolve hrefs; ActivatedRoute is stubbed to control query params per test.
  const createFixture = async (queryParams: Record<string, string> = {}) => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    // Spy on the real router so assertions reflect the component's actual calls.
    const router = TestBed.inject(Router);
    navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginComponent);
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('navigates to "/" after submitting valid credentials', async () => {
    await createFixture();
    const component = fixture.componentInstance;
    component.email = 'admin@demo.angular-project.local';
    component.password = 'changeme';
    fixture.detectChanges();

    component.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigateByUrl).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('does not navigate and shows an inline error element after submitting invalid credentials', async () => {
    await createFixture();
    const component = fixture.componentInstance;
    component.email = 'admin@demo.angular-project.local';
    component.password = 'wrong-password';
    fixture.detectChanges();

    component.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigateByUrl).not.toHaveBeenCalled();

    const errorEl = (fixture.nativeElement as HTMLElement).querySelector('.login-error');
    expect(errorEl).not.toBeNull();
    expect((errorEl as HTMLElement).textContent).toContain('Invalid email or password');
  });

  it('renders nav links targeting /home and /auth/register (RouterLink imported)', async () => {
    await createFixture();
    fixture.detectChanges();
    await fixture.whenStable();

    const nav = (fixture.nativeElement as HTMLElement).querySelector('header nav');
    expect(nav).not.toBeNull();

    const home = Array.from(nav?.querySelectorAll('a') ?? []).find(
      (a) => (a.textContent ?? '').trim() === 'Home'
    );
    const signUp = Array.from(nav?.querySelectorAll('a') ?? []).find(
      (a) => (a.textContent ?? '').trim() === 'Sign Up'
    );

    // RouterLink must be imported so these render real hrefs (and clicks work);
    // without it the anchors have no href at all.
    expect(home).toBeDefined();
    expect(home?.getAttribute('href')).toBe('/home');
    expect(signUp).toBeDefined();
    expect(signUp?.getAttribute('href')).toBe('/auth/register');
  });

  it('navigates to the returnUrl query param after successful login when present', async () => {
    await createFixture({ returnUrl: '/profile' });
    const component = fixture.componentInstance;
    component.email = 'admin@demo.angular-project.local';
    component.password = 'changeme';
    fixture.detectChanges();

    component.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/profile');
  });
});
