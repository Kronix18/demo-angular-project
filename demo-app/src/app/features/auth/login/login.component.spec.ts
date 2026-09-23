import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();

    // Fresh stub per test so recorded calls never leak between specs.
    navigateByUrl = vi.fn().mockResolvedValue(true);
    const routerStub = {
      navigateByUrl,
      navigate: vi.fn().mockResolvedValue(true),
      url: '/auth/login',
      events: { subscribe: () => () => {} },
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: Router, useValue: routerStub }],
    }).compileComponents();

    // No RouterLink directive is provided on purpose: the login template
    // references routerLink but the component does not import RouterLink
    // (that is task 1.3's scope). The spec only asserts form submit
    // behavior, never those links.
  });

  it('navigates to "/" after submitting valid credentials', async () => {
    fixture = TestBed.createComponent(LoginComponent);
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
    fixture = TestBed.createComponent(LoginComponent);
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
});
