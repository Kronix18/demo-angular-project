import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal.component';

@Component({
  standalone: true,
  imports: [ModalComponent],
  template: `<app-modal title="My dialog" (closed)="closes = closes + 1"><input id="first" /><p id="body">content</p></app-modal>`,
})
class Host { closes = 0; }

describe('ModalComponent', () => {
  let fixture: ComponentFixture<Host>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('is an accessible modal dialog with a title and projected content', () => {
    const d = el().querySelector('[role="dialog"]')!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBe('My dialog');
    expect(el().querySelector('h2')!.textContent).toContain('My dialog');
    expect(el().querySelector('#body')!.textContent).toBe('content');
  });

  it('closes on Escape, on the ✕ button and on backdrop click — but not when clicking inside', () => {
    const host = fixture.componentInstance;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closes).toBe(1);
    (el().querySelector('[data-modal-close]') as HTMLButtonElement).click();
    expect(host.closes).toBe(2);
    (el().querySelector('[role="dialog"]') as HTMLElement).click();
    expect(host.closes).toBe(2);
    (el().querySelector('[data-backdrop]') as HTMLElement).click();
    expect(host.closes).toBe(3);
  });

  it('moves focus to the first field on open', () => {
    expect(document.activeElement?.id).toBe('first');
  });
});
