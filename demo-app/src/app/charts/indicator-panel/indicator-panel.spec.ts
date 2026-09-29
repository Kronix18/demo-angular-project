import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IndicatorPanel } from './indicator-panel';
import { ChartStateService } from '../../core/services/chart-state.service';

describe('IndicatorPanel (5.2)', () => {
  let fixture: ComponentFixture<IndicatorPanel>;
  let state: ChartStateService;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [IndicatorPanel] }).compileComponents();
    state = TestBed.inject(ChartStateService);
    state.reset();
    fixture = TestBed.createComponent(IndicatorPanel);
    fixture.detectChanges();
  });

  it('shows an empty hint when no indicators are active', () => {
    expect(el().querySelectorAll('[data-indicator-row]').length).toBe(0);
    expect(el().querySelector('[data-empty]')).toBeTruthy();
  });

  it('renders one row per active indicator from state, labelled, tagged overlay/pane', async () => {
    state.addIndicator({ type: 'sma', period: 20 });
    state.addIndicator({ type: 'rsi', period: 14 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = Array.from(el().querySelectorAll('[data-indicator-row]'));
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('SMA 20'),
      expect.stringContaining('RSI 14'),
    ]);
    expect(rows[0].getAttribute('data-kind')).toBe('overlay');
    expect(rows[1].getAttribute('data-kind')).toBe('pane');
  });

  it('remove button deletes that indicator from state', async () => {
    state.addIndicator({ type: 'sma', period: 20 });
    state.addIndicator({ type: 'ema', period: 50 });
    fixture.detectChanges();
    (el().querySelectorAll('[data-remove]')[0] as HTMLButtonElement).click();
    expect(state.snapshot().indicators).toEqual([{ type: 'ema', period: 50 }]);
  });

  it('add form adds the chosen type+period to state (deduped)', () => {
    const select = el().querySelector('select[name="indicatorType"]') as HTMLSelectElement;
    select.value = 'ema';
    select.dispatchEvent(new Event('change'));
    const period = el().querySelector('input[name="indicatorPeriod"]') as HTMLInputElement;
    period.value = '34';
    period.dispatchEvent(new Event('input'));
    const add = el().querySelector('[data-add]') as HTMLButtonElement;
    add.click();
    add.click(); // duplicate ignored
    expect(state.snapshot().indicators).toEqual([{ type: 'ema', period: 34 }]);
  });

  it('rejects an invalid period (<1)', () => {
    const period = el().querySelector('input[name="indicatorPeriod"]') as HTMLInputElement;
    period.value = '0';
    period.dispatchEvent(new Event('input'));
    (el().querySelector('[data-add]') as HTMLButtonElement).click();
    expect(state.snapshot().indicators).toEqual([]);
  });
});
