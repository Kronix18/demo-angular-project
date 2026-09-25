import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartToolbarComponent } from './chart-toolbar.component';
import { FormsModule } from '@angular/forms';
import { ChartStateService } from '../../core/services/chart-state.service';

describe('ChartToolbarComponent — store wiring (task 4.2)', () => {
  let fixture: ComponentFixture<ChartToolbarComponent>;
  let component: ChartToolbarComponent;
  let store: ChartStateService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ChartToolbarComponent, FormsModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartToolbarComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(ChartStateService);
    fixture.detectChanges();
  });

  afterEach(() => {
    sessionStorage.clear();
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

  it('typing in the symbol input does NOT emit per keystroke and does NOT write the store', () => {
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
    expect(store.snapshot().symbol).toBe('msft'); // store untouched while typing
  });

  it('pressing Enter writes the store (single source of truth) — no @Output events remain', () => {
    const emissions: string[] = [];
    component.symbolChange.subscribe((s) => emissions.push(s));
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    input.value = 'nvda';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(store.snapshot().symbol).toBe('nvda'); // the STORE is the output
    expect(emissions.length).toBe(0); // no EventEmitter emissions
  });

  it('interval select change writes the store', () => {
    const select = fixture.nativeElement.querySelector('#interval') as HTMLSelectElement;
    select.value = '1w';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(store.snapshot().interval).toBe('1w');
  });

  it('Update button click writes the store with the current input value', () => {
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    input.value = 'qqq';
    input.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(store.snapshot().symbol).toBe('qqq');
  });

  it('interval select change emits intervalChange with the string value and writes the store', () => {
    const emissions: string[] = [];
    component.intervalChange.subscribe((v) => emissions.push(v));
    const select = fixture.nativeElement.querySelector('#interval') as HTMLSelectElement;
    select.value = '1w';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(emissions).toEqual(['1w']); // string value (event-object bug stays fixed)
    expect(store.snapshot().interval).toBe('1w'); // AND the store is written
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
