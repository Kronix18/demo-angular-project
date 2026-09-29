import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IndicatorsDialogComponent } from './indicators-dialog.component';
import { INDICATOR_CATALOG } from '../../core/indicators/indicator-catalog';

describe('IndicatorsDialogComponent (indicator picker)', () => {
  let fixture: ComponentFixture<IndicatorsDialogComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const items = () => Array.from(el().querySelectorAll<HTMLElement>('[data-add-indicator]')).map((b) => b.dataset['addIndicator']);
  const type = (q: string) => {
    const input = el().querySelector('input[type="search"]') as HTMLInputElement;
    input.value = q;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(IndicatorsDialogComponent);
    fixture.detectChanges();
  });

  it('lists every catalog indicator, grouped by category with descriptions', () => {
    expect(items()).toEqual(INDICATOR_CATALOG.map((c) => c.type));
    const cats = Array.from(el().querySelectorAll('[data-category]')).map((c) => c.textContent!.trim());
    expect(cats).toEqual(expect.arrayContaining(['Trend', 'Momentum', 'Volatility', 'IBD / CANSLIM']));
    expect(el().textContent).toContain('Relative Strength Index');
  });

  it('search filters by name, description and category (case-insensitive) and shows an empty state', () => {
    type('rsi');
    expect(items()).toEqual(expect.arrayContaining(['rsi', 'webby_rsi']));
    expect(items()).not.toContain('sma');
    type('MOMENTUM');
    expect(items()).toEqual(['rsi']);
    type('smoothed');
    expect(items()).toContain('rma');
    type('zzzz');
    expect(items()).toEqual([]);
    expect(el().querySelector('[data-empty]')).toBeTruthy();
    type('');
    expect(items().length).toBe(INDICATOR_CATALOG.length);
  });

  it('clicking an indicator emits its type and keeps the dialog open (add several in a row)', () => {
    const added: string[] = [];
    let closed = 0;
    fixture.componentInstance.add.subscribe((t) => added.push(t));
    fixture.componentInstance.closed.subscribe(() => closed++);
    (el().querySelector('[data-add-indicator="rsi"]') as HTMLButtonElement).click();
    (el().querySelector('[data-add-indicator="sma"]') as HTMLButtonElement).click();
    expect(added).toEqual(['rsi', 'sma']);
    expect(closed).toBe(0);
  });

  it('Enter in the search box adds the first match', () => {
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((t) => added.push(t));
    type('atr');
    (el().querySelector('input[type="search"]') as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(added).toEqual(['atr']);
  });
});
