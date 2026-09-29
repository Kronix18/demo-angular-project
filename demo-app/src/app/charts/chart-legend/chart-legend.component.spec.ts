import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartLegendComponent, LegendGroup } from './chart-legend.component';

const groups = (): LegendGroup[] => [
  {
    key: 'price', top: 0,
    header: { symbol: 'MSFT', interval: '1D', ohlc: { o: '100.00', h: '110.00', l: '95.00', c: '105.00', v: '1.2M', change: '+5.00 (+5.00%)', up: true } },
    rows: [{ key: 'sma', label: 'SMA 20', value: '101.25', color: 'rgb(1, 2, 3)', hidden: false, index: 0 }],
  },
  { key: 'volume', top: 300, rows: [{ key: 'vol', label: 'Volume', value: '1.2M', color: 'rgb(9, 9, 9)', hidden: false }] },
  { key: 'ind0', top: 400, rows: [{ key: 'rsi', label: 'RSI 14', value: '55.10', color: 'rgb(4, 5, 6)', hidden: true, index: 1 }] },
];

describe('ChartLegendComponent (10.2)', () => {
  let fixture: ComponentFixture<ChartLegendComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartLegendComponent);
    fixture.componentRef.setInput('groups', groups());
    fixture.detectChanges();
  });

  it('renders the header: symbol · interval and the hovered bar O/H/L/C with change, coloured by direction', () => {
    const head = el().querySelector('[data-legend-header]')!;
    expect(head.textContent).toContain('MSFT');
    expect(head.textContent).toContain('1D');
    for (const v of ['100.00', '110.00', '95.00', '105.00', '1.2M', '+5.00 (+5.00%)']) expect(head.textContent).toContain(v);
    expect(el().querySelector('[data-ohlc]')!.classList.contains('up')).toBe(true);
  });

  it('positions each group at its pane top', () => {
    const tops = Array.from(el().querySelectorAll<HTMLElement>('[data-legend-group]')).map((g) => g.style.top);
    expect(tops).toEqual(['0px', '300px', '400px']);
  });

  it('indicator rows show label, colour chip, live value, eye + remove; non-indicator rows have no controls', () => {
    const rows = Array.from(el().querySelectorAll('[data-indicator-row]'));
    expect(rows.length).toBe(2); // volume has no controls / is not an indicator row
    expect(rows[0].textContent).toContain('SMA 20');
    expect(rows[0].textContent).toContain('101.25');
    expect((rows[0].querySelector('[data-chip]') as HTMLElement).style.background).toBe('rgb(1, 2, 3)');
    expect(rows[1].classList.contains('hidden')).toBe(true);
    expect(el().querySelectorAll('[data-eye]').length).toBe(2);
    expect(el().querySelectorAll('[data-remove]').length).toBe(2);
    expect(el().querySelector('[data-legend-group="volume"]')!.textContent).toContain('1.2M');
  });

  it('eye toggles and remove emit the STATE index of the row', () => {
    const toggled: number[] = [];
    const removed: number[] = [];
    fixture.componentInstance.toggle.subscribe((i) => toggled.push(i));
    fixture.componentInstance.remove.subscribe((i) => removed.push(i));
    (el().querySelectorAll('[data-eye]')[1] as HTMLButtonElement).click();
    (el().querySelectorAll('[data-remove]')[0] as HTMLButtonElement).click();
    expect(toggled).toEqual([1]);
    expect(removed).toEqual([0]);
  });

  it('eye buttons expose state (aria-pressed) and an accessible name', () => {
    const eyes = Array.from(el().querySelectorAll<HTMLButtonElement>('[data-eye]'));
    expect(eyes.map((e) => e.getAttribute('aria-pressed'))).toEqual(['true', 'false']); // pressed = visible
    expect(eyes[0].getAttribute('aria-label')).toMatch(/hide SMA 20/i);
    expect(eyes[1].getAttribute('aria-label')).toMatch(/show RSI 14/i);
  });

  it('gear button and double-clicking a row emit the settings request for that indicator', () => {
    const asked: number[] = [];
    fixture.componentInstance.settings.subscribe((i) => asked.push(i));
    (el().querySelectorAll('[data-settings]')[1] as HTMLButtonElement).click();
    (el().querySelectorAll('[data-indicator-row]')[0] as HTMLElement).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(asked).toEqual([1, 0]);
    expect(el().querySelectorAll('[data-settings]')[0].getAttribute('aria-label')).toMatch(/Settings for SMA 20/);
  });
});
