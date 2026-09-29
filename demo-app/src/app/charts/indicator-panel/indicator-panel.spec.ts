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

  it('is only the add form now: the active-indicator rows live in the chart legend (10.2)', () => {
    state.addIndicator({ type: 'sma', period: 20 });
    fixture.detectChanges();
    expect(el().querySelector('[data-indicator-row]')).toBeNull();
    expect(el().querySelector('[data-add]')).toBeTruthy();
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

  const setPeriod = (v: string) => {
    const period = el().querySelector('input[name="indicatorPeriod"]') as HTMLInputElement;
    period.value = v;
    period.dispatchEvent(new Event('input'));
  };
  const clickAdd = () => (el().querySelector('[data-add]') as HTMLButtonElement).click();
  const errorText = () => el().querySelector('[data-error]')?.textContent?.trim() ?? null;

  it('shows an inline error (no alert) for period < 2 or > 500 or non-integer, and does not add', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    for (const bad of ['1', '501', '2.5', '']) {
      setPeriod(bad);
      clickAdd();
      fixture.detectChanges();
      expect(errorText(), `period "${bad}"`).toMatch(/2.*500/);
    }
    expect(state.snapshot().indicators).toEqual([]);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows an inline error on a duplicate add and clears it on the next valid add', () => {
    setPeriod('20');
    clickAdd();
    clickAdd();
    fixture.detectChanges();
    expect(errorText()).toMatch(/already/i);
    expect(state.snapshot().indicators.length).toBe(1);
    setPeriod('50');
    clickAdd();
    fixture.detectChanges();
    expect(errorText()).toBeNull();
    expect(state.snapshot().indicators.length).toBe(2);
  });

  it('offers WMA and RMA moving averages too', () => {
    const values = Array.from(el().querySelectorAll('select[name="indicatorType"] option')).map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(expect.arrayContaining(['sma', 'ema', 'wma', 'rma']));
  });
});
