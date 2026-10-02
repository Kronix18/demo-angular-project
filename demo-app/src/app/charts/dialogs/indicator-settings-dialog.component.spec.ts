import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IndicatorSettingsDialogComponent } from './indicator-settings-dialog.component';
import { IndicatorEntry } from '../../core/indicators/indicator-catalog';

describe('IndicatorSettingsDialogComponent', () => {
  let fixture: ComponentFixture<IndicatorSettingsDialogComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector(s) as T;
  const qa = <T extends HTMLElement>(s: string) => Array.from(el().querySelectorAll(s)) as T[];
  const setInput = (s: string, v: string) => { const i = q<HTMLInputElement>(s); i.value = v; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };
  const setSelect = (s: string, v: string) => { const i = q<HTMLSelectElement>(s); i.value = v; i.dispatchEvent(new Event('change')); fixture.detectChanges(); };
  const tab = (name: string) => { q<HTMLButtonElement>(`[data-tab="${name}"]`).click(); fixture.detectChanges(); };
  let saved: Partial<IndicatorEntry>[];
  let closed: number;

  function open(entry: IndicatorEntry) {
    fixture = TestBed.createComponent(IndicatorSettingsDialogComponent);
    fixture.componentRef.setInput('entry', entry);
    saved = [];
    closed = 0;
    fixture.componentInstance.save.subscribe((p) => saved.push(p));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.detectChanges();
  }

  it('Inputs tab is generated from the indicator definition (method, source, length, offset for a moving average)', () => {
    open({ type: 'sma', period: 20 });
    expect(q('h2').textContent).toContain('SMA 20');
    expect(qa('[data-param]').map((p) => p.dataset['param'])).toEqual(['method', 'source', 'length', 'offset']);
    expect(q<HTMLInputElement>('[data-param="length"]').value).toBe('20');
    expect(q<HTMLSelectElement>('[data-param="method"]').value).toBe('SMA');
    expect(qa('[data-param="method"] option').map((o) => (o as HTMLOptionElement).value)).toEqual(['SMA', 'EMA', 'WMA', 'RMA']);
  });

  it('booleans render as checkboxes (Webby RSI positive-only)', () => {
    open({ type: 'webby_rsi', period: 0 });
    expect(q<HTMLInputElement>('[data-param="positive_only"]').type).toBe('checkbox');
    expect(q<HTMLInputElement>('[data-param="positive_only"]').checked).toBe(true);
  });

  it('validates against the parameter bounds: inline error and OK disabled until fixed', () => {
    open({ type: 'sma', period: 20 });
    setInput('[data-param="length"]', '0');
    expect(q('[data-error="length"]').textContent).toMatch(/1.*10000/);
    expect(q<HTMLButtonElement>('[data-ok]').disabled).toBe(true);
    setInput('[data-param="length"]', '2.5');
    expect(q('[data-error="length"]')).toBeTruthy(); // integer parameter
    setInput('[data-param="length"]', '50');
    expect(q('[data-error="length"]')).toBeNull();
    expect(q<HTMLButtonElement>('[data-ok]').disabled).toBe(false);
  });

  it('OK saves params, styles and intervals and closes; Cancel/✕ close without saving', () => {
    open({ type: 'sma', period: 20 });
    setInput('[data-param="length"]', '34');
    setSelect('[data-param="method"]', 'EMA');
    tab('style');
    setInput('[data-style-color="ma"]', '#123456');
    setSelect('[data-style-width="ma"]', '3');
    setSelect('[data-style-dash="ma"]', 'dash');
    tab('visibility');
    q<HTMLInputElement>('[data-interval="1w"]').click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-ok]').click();
    expect(saved).toEqual([{
      params: { method: 'EMA', source: 'close', length: 34, offset: 0 },
      styles: { ma: { color: '#123456', width: 3, dash: 'dash', visible: true } },
      intervals: ['1d'],
    }]);
    expect(closed).toBe(1);
    open({ type: 'sma', period: 20 });
    setInput('[data-param="length"]', '99');
    q<HTMLButtonElement>('[data-cancel]').click();
    expect(saved).toEqual([]);
    expect(closed).toBe(1);
  });

  it('Style tab: one row per output with visibility checkbox; RSI lists rsi + both guide lines', () => {
    open({ type: 'rsi', period: 14 });
    tab('style');
    expect(qa('[data-style-row]').map((r) => r.dataset['styleRow'])).toEqual(['rsi', 'overbought', 'oversold']);
    q<HTMLInputElement>('[data-style-visible="overbought"]').click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-ok]').click();
    expect(saved[0].styles!['overbought'].visible).toBe(false);
    expect(saved[0].styles!['rsi'].visible).toBe(true);
  });

  it('existing overrides are shown; Reset restores defaults', () => {
    open({ type: 'sma', period: 20, params: { length: 77 }, styles: { ma: { color: '#abcdef', width: 4 } }, intervals: ['1w'] });
    expect(q<HTMLInputElement>('[data-param="length"]').value).toBe('77');
    tab('style');
    expect(q<HTMLInputElement>('[data-style-color="ma"]').value).toBe('#abcdef');
    tab('visibility');
    expect(q<HTMLInputElement>('[data-interval="1d"]').checked).toBe(false);
    expect(q<HTMLInputElement>('[data-interval="1w"]').checked).toBe(true);
    q<HTMLButtonElement>('[data-reset]').click();
    fixture.detectChanges();
    tab('inputs');
    expect(q<HTMLInputElement>('[data-param="length"]').value).toBe('20');
    tab('visibility');
    expect(q<HTMLInputElement>('[data-interval="1d"]').checked).toBe(true);
  });

  it('at least one timeframe must stay selected', () => {
    open({ type: 'sma', period: 20 });
    tab('visibility');
    q<HTMLInputElement>('[data-interval="1d"]').click();
    q<HTMLInputElement>('[data-interval="1w"]').click();
    fixture.detectChanges();
    expect(q('[data-error="intervals"]')).toBeTruthy();
    expect(q<HTMLButtonElement>('[data-ok]').disabled).toBe(true);
  });
});
