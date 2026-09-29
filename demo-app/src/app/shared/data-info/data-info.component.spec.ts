import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import meta from '../../../../docs/api/fixtures/meta.json';
import { MetaService } from '../../core/api/meta.service';
import { DataInfoComponent } from './data-info.component';

describe('DataInfoComponent (tasks 12.11 + 12.12)', () => {
  function make(metaBody: unknown | null, now = '2026-09-23T09:00:00Z') {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(now));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const f = TestBed.createComponent(DataInfoComponent);
    if (metaBody) {
      TestBed.inject(MetaService).load();
      TestBed.inject(HttpTestingController).expectOne('http://192.168.1.111:3000/api/meta').flush(metaBody);
    }
    f.detectChanges();
    return f;
  }
  afterEach(() => vi.useRealTimers());
  const q = (f: any, s: string) => f.nativeElement.querySelector(s) as HTMLElement | null;

  it('hidden entirely when the backend gave no meta', () => {
    expect(q(make(null), '[data-info-btn]')).toBeNull();
  });

  it('button opens a popover with as-of dates, model versions, split-adjusted note and interim benchmark; Esc closes', () => {
    const f = make(meta);
    expect(q(f, '[data-info-pop]')).toBeNull();
    q(f, '[data-info-btn]')!.click();
    f.detectChanges();
    const pop = q(f, '[data-info-pop]')!;
    expect(pop.textContent).toContain('2026-09-22');
    expect(pop.textContent).toContain('EPS_V5_3');
    expect(pop.textContent).toContain('TECHNICAL_DAILY_V1');
    expect(pop.textContent).toContain('split-adjusted');
    expect(pop.textContent).toContain('TSX');
    expect(pop.textContent).toContain('interim');
    pop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(q(f, '[data-info-pop]')).toBeNull();
  });

  it('freshness chip: shows the date; adds a stale warning after 3 business days; never says live', () => {
    const fresh = make(meta, '2026-09-23T09:00:00Z');
    expect(q(fresh, '[data-fresh]')!.textContent).toContain('2026-09-22');
    expect(q(fresh, '[data-stale]')).toBeNull();
    TestBed.resetTestingModule();
    const stale = make(meta, '2026-09-29T09:00:00Z');
    expect(q(stale, '[data-stale]')).not.toBeNull();
    expect(q(stale, '[data-fresh]')!.textContent!.toLowerCase()).not.toContain('live');
  });

  it('button is a real accessible control', () => {
    const f = make(meta);
    const b = q(f, '[data-info-btn]')!;
    expect(b.getAttribute('aria-label')).toBe('Data information');
    expect(b.getAttribute('aria-expanded')).toBe('false');
  });
});
