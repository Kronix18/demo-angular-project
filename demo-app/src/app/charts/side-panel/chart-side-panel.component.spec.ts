import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartSidePanelComponent } from './chart-side-panel.component';

describe('ChartSidePanelComponent (11.14)', () => {
  let fixture: ComponentFixture<ChartSidePanelComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector(s) as T;
  const qa = <T extends HTMLElement>(s: string) => Array.from(el().querySelectorAll(s)) as T[];
  const setInputs = (o: Record<string, unknown>) => { for (const [k, v] of Object.entries(o)) fixture.componentRef.setInput(k, v); fixture.detectChanges(); };

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartSidePanelComponent);
    setInputs({
      tab: 'objects',
      indicators: [{ index: 0, label: 'SMA 20', color: 'rgb(1, 2, 3)', hidden: false }, { index: 1, label: 'RSI 14', color: 'rgb(4, 5, 6)', hidden: true }],
      drawings: [{ id: 'a', label: 'Trend line', hidden: false, locked: false }, { id: 'b', label: 'Fib retracement', hidden: true, locked: true }],
      selectedId: 'a',
      data: { date: 'Sep 22, 26', rows: [{ label: 'Open', value: '100.00' }, { label: 'SMA 20', value: '99.10', color: 'rgb(1, 2, 3)' }] },
      watch: [{ symbol: 'msft', last: 500, pct: 1.5 }, { symbol: 'nvda', last: undefined, pct: undefined }],
      current: 'msft',
      alerts: [{ id: 'x', symbol: 'msft', price: 480, triggered: false }, { id: 'y', symbol: 'msft', price: 520, triggered: true }],
    });
  });

  it('has four tabs and shows the selected one; tab clicks are emitted', () => {
    expect(qa('[data-tab]').map((t) => t.dataset['tab'])).toEqual(['objects', 'data', 'watchlist', 'alerts']);
    expect(q('[data-tab="objects"]').getAttribute('aria-selected')).toBe('true');
    const tabs: string[] = [];
    fixture.componentInstance.tabChange.subscribe((t) => tabs.push(t));
    q<HTMLButtonElement>('[data-tab="data"]').click();
    expect(tabs).toEqual(['data']);
  });

  it('objects: indicator and drawing rows with eye, lock, delete; a row click selects the drawing', () => {
    expect(qa('[data-obj-indicator]').map((r) => r.textContent!.trim())).toEqual([expect.stringContaining('SMA 20'), expect.stringContaining('RSI 14')]);
    expect(qa('[data-obj-drawing]').length).toBe(2);
    expect(qa('[data-obj-drawing]')[0].classList.contains('selected')).toBe(true);
    expect(qa('[data-obj-drawing]')[1].classList.contains('hidden')).toBe(true);
    const c = fixture.componentInstance;
    const log: string[] = [];
    c.indicatorToggle.subscribe((i) => log.push(`ind-eye:${i}`));
    c.indicatorRemove.subscribe((i) => log.push(`ind-del:${i}`));
    c.indicatorSettings.subscribe((i) => log.push(`ind-set:${i}`));
    c.drawingSelect.subscribe((id) => log.push(`sel:${id}`));
    c.drawingToggleHidden.subscribe((id) => log.push(`hide:${id}`));
    c.drawingToggleLocked.subscribe((id) => log.push(`lock:${id}`));
    c.drawingRemove.subscribe((id) => log.push(`del:${id}`));
    c.drawingOrder.subscribe((o) => log.push(`order:${o.id}:${o.how}`));
    qa<HTMLButtonElement>('[data-obj-indicator] [data-obj-eye]')[1].click();
    qa<HTMLButtonElement>('[data-obj-indicator] [data-obj-delete]')[0].click();
    qa<HTMLButtonElement>('[data-obj-indicator] [data-obj-settings]')[0].click();
    qa<HTMLElement>('[data-obj-drawing]')[1].click();
    qa<HTMLButtonElement>('[data-obj-drawing] [data-obj-eye]')[0].click();
    qa<HTMLButtonElement>('[data-obj-drawing] [data-obj-lock]')[0].click();
    qa<HTMLButtonElement>('[data-obj-drawing] [data-obj-delete]')[1].click();
    qa<HTMLButtonElement>('[data-obj-drawing] [data-obj-front]')[0].click();
    expect(log).toEqual(['ind-eye:1', 'ind-del:0', 'ind-set:0', 'sel:b', 'hide:a', 'lock:a', 'del:b', 'order:a:front']);
    expect(qa('[data-obj-drawing] [data-obj-lock]')[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('data window: the hovered bar\\'s date and values', () => {
    setInputs({ tab: 'data' });
    expect(q('[data-data-date]').textContent).toContain('Sep 22, 26');
    expect(qa('[data-data-row]').map((r) => r.textContent!.replace(/\\s+/g, ' ').trim())).toEqual(['Open 100.00', 'SMA 20 99.10']);
  });

  it('watchlist: quotes, active symbol, pick / add / remove', () => {
    setInputs({ tab: 'watchlist' });
    const rows = qa('[data-watch-row]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('MSFT');
    expect(rows[0].textContent).toContain('500.00');
    expect(rows[0].textContent).toContain('+1.50%');
    expect(rows[0].classList.contains('active')).toBe(true);
    expect(rows[1].textContent).toContain('–'); // quote still loading
    const c = fixture.componentInstance;
    const log: string[] = [];
    c.watchPick.subscribe((s) => log.push(`pick:${s}`));
    c.watchAdd.subscribe((s) => log.push(`add:${s}`));
    c.watchRemove.subscribe((s) => log.push(`rm:${s}`));
    rows[1].click();
    q<HTMLButtonElement>('[data-watch-remove]').click();
    const input = q<HTMLInputElement>('[data-watch-input]');
    input.value = ' qqq.us '; input.dispatchEvent(new Event('input'));
    q<HTMLButtonElement>('[data-watch-add]').click();
    expect(log).toEqual(['pick:nvda', 'rm:msft', 'add:qqq']);
  });

  it('alerts: list with triggered state; add at a price; remove', () => {
    setInputs({ tab: 'alerts' });
    const rows = qa('[data-alert-row]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('480.00');
    expect(rows[1].classList.contains('triggered')).toBe(true);
    const c = fixture.componentInstance;
    const log: string[] = [];
    c.alertAdd.subscribe((p) => log.push(`add:${p}`));
    c.alertRemove.subscribe((id) => log.push(`rm:${id}`));
    const input = q<HTMLInputElement>('[data-alert-input]');
    input.value = '512.5'; input.dispatchEvent(new Event('input'));
    q<HTMLButtonElement>('[data-alert-add]').click();
    input.value = 'abc'; input.dispatchEvent(new Event('input'));
    q<HTMLButtonElement>('[data-alert-add]').click(); // not a number: ignored
    qa<HTMLButtonElement>('[data-alert-remove]')[1].click();
    expect(log).toEqual(['add:512.5', 'rm:y']);
  });
});
