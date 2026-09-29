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

  describe('templates (11.17)', () => {
    const q = <T extends HTMLElement>(sel: string) => el().querySelector(sel) as T;
    beforeEach(() => {
      localStorage.clear();
      fixture = TestBed.createComponent(IndicatorsDialogComponent);
      fixture.componentRef.setInput('current', [{ type: 'sma', period: 20 }, { type: 'rsi', period: 14 }]);
      fixture.detectChanges();
    });
    const name = (v: string) => { const i = q<HTMLInputElement>('[data-tpl-name]'); i.value = v; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };

    it('saves the indicators on the chart as a named template, lists it, applies it and deletes it', () => {
      expect(q<HTMLButtonElement>('[data-tpl-save]').disabled).toBe(true);
      name('My set');
      q<HTMLButtonElement>('[data-tpl-save]').click();
      fixture.detectChanges();
      expect(el().querySelectorAll('[data-tpl-row]').length).toBe(1);
      expect(q('[data-tpl-row]').textContent).toContain('My set');
      expect(q('[data-tpl-row]').textContent).toContain('2 indicators');
      const applied: unknown[] = [];
      fixture.componentInstance.applyTemplate.subscribe((e) => applied.push(e));
      q<HTMLButtonElement>('[data-tpl-apply]').click();
      expect(applied).toEqual([[{ type: 'sma', period: 20 }, { type: 'rsi', period: 14 }]]);
      q<HTMLButtonElement>('[data-tpl-delete]').click();
      fixture.detectChanges();
      expect(el().querySelectorAll('[data-tpl-row]').length).toBe(0);
    });

    it('nothing to save when the chart has no indicators', () => {
      fixture.componentRef.setInput('current', []);
      fixture.detectChanges();
      name('x');
      expect(q<HTMLButtonElement>('[data-tpl-save]').disabled).toBe(true);
    });
  });
});
