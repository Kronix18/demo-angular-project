import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GotoDateDialogComponent } from './goto-date-dialog.component';

describe('GotoDateDialogComponent (11.13)', () => {
  let fixture: ComponentFixture<GotoDateDialogComponent>;
  const q = <T extends HTMLElement>(s: string) => (fixture.nativeElement as HTMLElement).querySelector(s) as T;
  let picked: number[]; let closed: number;
  const open = () => {
    fixture = TestBed.createComponent(GotoDateDialogComponent);
    fixture.componentRef.setInput('min', Date.UTC(2020, 0, 1));
    fixture.componentRef.setInput('max', Date.UTC(2026, 8, 22));
    picked = []; closed = 0;
    fixture.componentInstance.pick.subscribe((t) => picked.push(t));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.detectChanges();
  };
  const type = (v: string) => { const i = q<HTMLInputElement>('[data-goto-input]'); i.value = v; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };

  it('emits the timestamp (UTC midnight) of a valid date and closes', () => {
    open();
    expect(q<HTMLInputElement>('[data-goto-input]').min).toBe('2020-01-01');
    expect(q<HTMLInputElement>('[data-goto-input]').max).toBe('2026-09-22');
    type('2024-03-15');
    q<HTMLButtonElement>('[data-ok]').click();
    expect(picked).toEqual([Date.UTC(2024, 2, 15)]);
    expect(closed).toBe(1);
  });

  it('OK stays disabled without a valid date; dates outside the data are clamped into it; Enter submits', () => {
    open();
    expect(q<HTMLButtonElement>('[data-ok]').disabled).toBe(true);
    type('not a date');
    expect(q<HTMLButtonElement>('[data-ok]').disabled).toBe(true);
    type('1999-01-01');
    q<HTMLInputElement>('[data-goto-input]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(picked).toEqual([Date.UTC(2020, 0, 1)]);
  });
});
