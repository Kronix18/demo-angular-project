import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ChartDataService } from './chart-data.service';

/**
 * Task 2.1 — Stooq test-data pipeline specs (written RED, before the fix).
 *
 * Contract (API-BACKEND-SPEC.md):
 *  - files live at test-data/<lowercase symbol>.us.txt (served from public/)
 *  - symbols normalize: MSFT / msft / msft.us / MSFT.US -> msft
 *  - timestamps are Unix epoch MILLISECONDS: Date.UTC(y, m-1, d[, hh, mm, ss])
 *  - header line is skipped, malformed rows are skipped
 *  - rows sort newest-first, limit applied after the sort
 *  - 404 / empty -> Observable of([])
 */
describe('ChartDataService (Stooq test-data pipeline)', () => {
  // The ONLY correct URL for Microsoft, regardless of how the caller spells it.
  const MSFT_URL = 'test-data/msft.us.txt';

  const HEADER = '<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>';
  /** Build a CRLF Stooq file body from data rows (header always first). */
  const stooq = (rows: string[]) => [HEADER, ...rows].join('\r\n');

  let service: ChartDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Explicit reset: when a RED assertion leaves an unflushed request, the
    // afterEach verify() throws and the framework's own reset can be skipped —
    // reset here so every test fails (or passes) on its own merits.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChartDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const requestMsft = (limit = 100) => firstValueFrom(service.getOHLCV('msft', '1d', limit));
  const flushMsft = (csv: string) => httpMock.expectOne(MSFT_URL).flush(csv);

  describe('URL building / symbol normalization', () => {
    it('builds test-data/msft.us.txt from the bare lowercase symbol', async () => {
      const promise = requestMsft();
      const req = httpMock.expectOne(MSFT_URL);
      expect(req.request.url).toBe(MSFT_URL);
      req.flush('');
      expect(await promise).toEqual([]);
    });

    it('normalizes MSFT, msft.us and MSFT.US to the same URL', () => {
      for (const variant of ['MSFT', 'msft.us', 'MSFT.US']) {
        service.getOHLCV(variant, '1d').subscribe();
        const req = httpMock.expectOne(MSFT_URL);
        expect(req.request.url).toBe(MSFT_URL);
        req.flush('');
      }
    });
  });

  describe('parseStockData', () => {
    it('parses a Stooq row into OHLCV with the documented fields', async () => {
      const promise = requestMsft();
      flushMsft(stooq(['MSFT.US,D,20240115,000000,100,110,95,105,1000,0']));
      const rows = await promise;
      expect(rows.length).toBe(1);
      expect(rows[0].open).toBe(100);
      expect(rows[0].high).toBe(110);
      expect(rows[0].low).toBe(95);
      expect(rows[0].close).toBe(105);
      expect(rows[0].volume).toBe(1000);
    });

    it('converts YYYYMMDD + 000000 to Date.UTC epoch milliseconds', async () => {
      const promise = requestMsft();
      flushMsft(stooq(['MSFT.US,D,20240115,000000,100,110,95,105,1000,0']));
      const rows = await promise;
      expect(rows[0].timestamp).toBe(Date.UTC(2024, 0, 15));
    });

    it('adds hh/mm/ss to the timestamp when time is not 000000', async () => {
      const promise = requestMsft();
      flushMsft(stooq(['MSFT.US,D,20240115,093000,100,110,95,105,1000,0']));
      const rows = await promise;
      expect(rows[0].timestamp).toBe(Date.UTC(2024, 0, 15, 9, 30, 0));
    });

    it('skips the <TICKER> header line and malformed rows', async () => {
      const promise = requestMsft();
      flushMsft(stooq([
        'MSFT.US,D,20240115,000000,100,110,95,105,1000,0', // valid
        'garbage',                                         // not CSV at all
        'MSFT.US,D,20240114,000000,1,2,3',                 // fewer than 10 fields
        'MSFT.US,D,20241301,000000,1,2,3,4,5,0',           // impossible date (month 13)
        'MSFT.US,D,20240113,000000,1,2,3,NaN,5,0',          // non-numeric close
      ]));
      const rows = await promise;
      expect(rows.length).toBe(1);
      expect(rows[0].timestamp).toBe(Date.UTC(2024, 0, 15));
    });

    it('returns [] when the file contains only the header line', async () => {
      const promise = requestMsft();
      flushMsft(HEADER);
      expect(await promise).toEqual([]);
    });

    it('sorts newest-first and applies the limit after sorting', async () => {
      const promise = requestMsft(3);
      flushMsft(stooq([
        'MSFT.US,D,20240103,000000,3,3,3,3,30,0',
        'MSFT.US,D,20240101,000000,1,1,1,1,10,0',
        'MSFT.US,D,20240115,000000,5,5,5,5,50,0',
        'MSFT.US,D,20240110,000000,4,4,4,4,40,0',
        'MSFT.US,D,20240102,000000,2,2,2,2,20,0',
      ]));
      const rows = await promise;
      expect(rows.map(r => r.timestamp)).toEqual([
        Date.UTC(2024, 0, 15),
        Date.UTC(2024, 0, 10),
        Date.UTC(2024, 0, 3),
      ]);
    });
  });

  describe('error handling', () => {
    it('emits [] on 404 (symbol without a data file)', async () => {
      const promise = firstValueFrom(service.getOHLCV('aapl', '1d')); // no AAPL in test data
      httpMock.expectOne('test-data/aapl.us.txt')
        .flush('', { status: 404, statusText: 'Not Found' });
      expect(await promise).toEqual([]);
    });

    it('emits [] for an empty file body', async () => {
      const promise = requestMsft();
      flushMsft('');
      expect(await promise).toEqual([]);
    });
  });
});
