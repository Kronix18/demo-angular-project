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
    const btn = el.querySelector('.toolbar-group:not(.range-group) button');
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

  it('typing in the symbol input does NOT write the store (submit semantics)', () => {
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    input.value = 'n';
    input.dispatchEvent(new Event('input'));
    input.value = 'nv';
    input.dispatchEvent(new Event('input'));
    input.value = 'nvda';
    input.dispatchEvent(new Event('input'));
    expect(store.snapshot().symbol).toBe('msft'); // store untouched while typing
  });

  it('pressing Enter writes the store (single source of truth)', () => {
    const input = fixture.nativeElement.querySelector('#symbol') as HTMLInputElement;
    input.value = 'nvda';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(store.snapshot().symbol).toBe('nvda'); // the STORE is the output
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
    const updateBtn = fixture.nativeElement.querySelector(
      '.toolbar-group:not(.range-group) button'
    ) as HTMLButtonElement;
    updateBtn.click();
    expect(store.snapshot().symbol).toBe('qqq');
  });

  it('interval select change writes the store (string value, no events)', () => {
    const select = fixture.nativeElement.querySelector('#interval') as HTMLSelectElement;
    select.value = '1w';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(store.snapshot().interval).toBe('1w'); // the STORE is the output
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

  it('has no dead FormBuilder injection (store is the only dep, and it is used)', () => {
    // FormBuilder was injected but never used (2.3 dead code) — removed.
    // 4.2: the constructor takes exactly the store, and submitSymbol uses it.
    expect(component.constructor.length).toBe(1);
    // live use: writing via the store works (proven by the other tests)
    expect(typeof (component as any).store).toBe('object');
  });
});
