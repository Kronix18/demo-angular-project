import { TestBed } from '@angular/core/testing';
import { ApiError, ApiErrorService } from '../../core/api/errors';
import { ApiToastComponent } from './api-toast.component';

describe('ApiToastComponent (12.3)', () => {
  it('renders nothing without a toast, shows the message with role=status, and dismisses', async () => {
    const f = TestBed.createComponent(ApiToastComponent);
    const svc = TestBed.inject(ApiErrorService);
    await f.whenStable();
    expect(f.nativeElement.querySelector('[data-api-toast]')).toBeNull();

    svc.report(new ApiError(500, 'server_error', 'Boom'));
    f.detectChanges();
    const el = f.nativeElement.querySelector('[data-api-toast]') as HTMLElement;
    expect(el.textContent).toContain('Boom');
    expect(el.getAttribute('role')).toBe('status');

    (f.nativeElement.querySelector('[data-api-toast-close]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-api-toast]')).toBeNull();
  });

  it('never renders a toast for 402', async () => {
    const f = TestBed.createComponent(ApiToastComponent);
    TestBed.inject(ApiErrorService).report(new ApiError(402, 'upgrade_required', 'up'));
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-api-toast]')).toBeNull();
  });
});
