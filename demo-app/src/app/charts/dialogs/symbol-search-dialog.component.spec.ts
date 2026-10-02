import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SymbolSearchDialogComponent } from './symbol-search-dialog.component';

describe('SymbolSearchDialogComponent (type-to-search)', () => {
  let fixture: ComponentFixture<SymbolSearchDialogComponent>;
  let picked: string[];
  let closed: number;
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLElement>('[data-symbol-option]')).map((r) => r.dataset['symbolOption']);
  const input = () => el().querySelector('input[type="search"]') as HTMLInputElement;
  const type = (v: string) => { input().value = v; input().dispatchEvent(new Event('input')); fixture.detectChanges(); };
  const key = (k: string) => { input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); fixture.detectChanges(); };

  function open(initial = '', current = 'msft') {
    fixture = TestBed.createComponent(SymbolSearchDialogComponent);
    fixture.componentRef.setInput('initial', initial);
    fixture.componentRef.setInput('current', current);
    picked = [];
    closed = 0;
    fixture.componentInstance.pick.subscribe((s) => picked.push(s));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.detectChanges();
  }

  it('lists all demo symbols when empty and marks the current one', () => {
    open('');
    expect(rows()).toEqual(['ia', 'msft', 'mu', 'nvda', 'pltr', 'qqew', 'qqq', 'qqqe']);
    expect(el().querySelector('[data-symbol-option="msft"]')!.classList.contains('current')).toBe(true);
  });

  it('opens with the typed character already in the box (type-to-search) and filters live', () => {
    open('n');
    expect(input().value).toBe('n');
    expect(rows()).toEqual(['nvda']);
    type('q');
    expect(rows()).toEqual(['qqew', 'qqq', 'qqqe']);
    type('QQQ');
    expect(rows()).toEqual(['qqq', 'qqqe']); // case-insensitive, best (exact/prefix) match first
  });

  it('Enter picks the highlighted symbol; arrows move the highlight; wraps around', () => {
    open('qq');
    key('Enter');
    expect(picked).toEqual(['qqew']);
    open('qq');
    key('ArrowDown');
    key('ArrowDown');
    key('Enter');
    expect(picked).toEqual(['qqq']);
    open('qq');
    key('ArrowUp'); // wraps to the last entry
    key('Enter');
    expect(picked).toEqual(['qqqe']);
  });

  it('clicking a row picks it', () => {
    open('');
    (el().querySelector('[data-symbol-option="nvda"]') as HTMLElement).click();
    expect(picked).toEqual(['nvda']);
  });

  it('an unknown query offers "Go to SYMBOL" and Enter opens it (the chart shows the unknown-symbol card)', () => {
    open('aapl');
    expect(rows()).toEqual([]);
    expect(el().querySelector('[data-go]')!.textContent).toContain('AAPL');
    key('Enter');
    expect(picked).toEqual(['aapl']);
  });

  it('sanitises free text (trim, lower-case, exchange suffix) and ignores empty input', () => {
    open('');
    type('  MSFT.US ');
    key('Enter');
    expect(picked).toEqual(['msft']);
    open('   ');
    key('Enter');
    expect(picked.length).toBe(0);
  });

  it('Esc closes', () => {
    open('');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(1);
  });
});
