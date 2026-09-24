import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartToolbarComponent } from './chart-toolbar.component';
import { FormsModule } from '@angular/forms';

describe('ChartToolbarComponent — submit semantics + real demo symbols (task 2.3)', () => {
  let fixture: ComponentFixture<ChartToolbarComponent>;
  let component: ChartToolbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartToolbarComponent, FormsModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders symbol input, interval select, and Update button', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#symbol')).toBeTruthy();
    expect(el.querySelector('#interval')).toBeTruthy();
    const btn = el.querySelector('button');
    expect(btn?.textContent).toContain('Update');
  });

  it('defaults to a symbol that EXISTS in the demo data (msft, not AAPL)', () => {
    expect(component.symbol.toLowerCase()).toBe('msft');
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    expect(input.value.toLowerCase()).toBe('msft');
  });

  it('symbol datalist offers only symbols with demo data (no fake GOOGL/AMZN/TSLA/META/NFLX)', () => {
    const fake = ['googl', 'amzn', 'tsla', 'meta', 'nflx'];
    const offered = component.symbols.map((s) => s.toLowerCase());
    for (const f of fake) {
      expect(offered).not.toContain(f);
    }
    // real demo symbols present
    for (const real of ['msft', 'qqq', 'nvda', 'pltr']) {
      expect(offered).toContain(real);
    }
  });

  it('typing in the symbol input does NOT emit per keystroke (submit semantics)', () => {
    const emissions: string[] = [];
    component.symbolChange.subscribe((s) => emissions.push(s));
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    input.value = 'n';
    input.dispatchEvent(new Event('input'));
    input.value = 'nv';
    input.dispatchEvent(new Event('input'));
    input.value = 'nvda';
    input.dispatchEvent(new Event('input'));
    expect(emissions.length).toBe(0); // nothing until submit
  });

  it('pressing Enter in the symbol input emits symbolChange ONCE with the full value', () => {
    const emissions: string[] = [];
    component.symbolChange.subscribe((s) => emissions.push(s));
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    input.value = 'nvda';
    input.dispatchEvent(new Event('input')); // update ngModel
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(emissions).toEqual(['nvda']);
  });

  it('Update button click emits symbolChange ONCE with the current input value', () => {
    const emissions: string[] = [];
    component.symbolChange.subscribe((s) => emissions.push(s));
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    input.value = 'qqq';
    input.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(emissions).toEqual(['qqq']);
  });

  it('interval select change emits intervalChange with the string value (not event object)', () => {
    const emissions: string[] = [];
    component.intervalChange.subscribe((v) => emissions.push(v));
    const select = fixture.nativeElement.querySelector('#interval') as HTMLSelectElement;
    select.value = '1w';
    select.dispatchEvent(new Event('change'));
    expect(emissions).toEqual(['1w']); // a string, not '[object Object]' or undefined
  });

  it('interval select offers 1d and 1w; intraday options (1m/5m/1h) are DISABLED with a hint', () => {
    const select = fixture.nativeElement.querySelector('#interval') as HTMLSelectElement;
    const options = Array.from(select.options);
    const byValue = (v: string) => options.find((o) => o.value === v);
    // demo-servable: enabled
    expect(byValue('1d')?.disabled).toBe(false);
    expect(byValue('1w')?.disabled).toBe(false);
    // backend-only (demo data is daily-only): disabled until backend exists (0.3 spec)
    expect(byValue('1m')?.disabled).toBe(true);
    expect(byValue('5m')?.disabled).toBe(true);
    expect(byValue('1h')?.disabled).toBe(true);
  });

  it('has no dead FormBuilder/symbols-as-AAPL code (constructor takes no deps)', () => {
    // FormBuilder was injected but never used (dead code) — constructor must be empty of deps
    expect(component.constructor.length).toBe(0);
  });
});
