import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { ScreenerService } from './screener.service';
import { StockService } from './stock.service';
import { UserService } from './user.service';

/** Thin backend wrappers: assert the endpoint contract they hand to ApiService. */
describe('backend service wrappers (coverage gate 7.1)', () => {
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    api = { get: vi.fn(() => of({})), post: vi.fn(() => of({})), put: vi.fn(() => of({})), delete: vi.fn(() => of({})) };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('ScreenerService: filters GET, run POST with a 45s timeout', () => {
    const s = TestBed.inject(ScreenerService);
    s.getFilters().subscribe();
    expect(api.get).toHaveBeenCalledWith('api/screener/filters');
    s.runScreener({ sector: 'Tech' }, 10).subscribe();
    expect(api.post).toHaveBeenCalledWith('api/screener/run', { filters: { sector: 'Tech' }, limit: 10 }, 45000);
    s.runScreener({}).subscribe();
    expect(api.post).toHaveBeenLastCalledWith('api/screener/run', { filters: {}, limit: 50 }, 45000);
  });

  it('UserService: profile get/update, account delete', () => {
    const s = TestBed.inject(UserService);
    s.getProfile().subscribe();
    expect(api.get).toHaveBeenCalledWith('api/user/profile');
    s.updateProfile({ name: 'N' }).subscribe();
    expect(api.put).toHaveBeenCalledWith('api/user/profile', { name: 'N' });
    s.deleteAccount().subscribe();
    expect(api.delete).toHaveBeenCalledWith('api/user/account');
  });

  it('StockService: endpoints, encoded search, filter query string', () => {
    const s = TestBed.inject(StockService);
    s.getStocks().subscribe();
    expect(api.get).toHaveBeenCalledWith('stocks');
    s.getStock('MSFT').subscribe();
    expect(api.get).toHaveBeenCalledWith('api/stocks/MSFT');
    s.searchStocks('a&b c').subscribe();
    expect(api.get).toHaveBeenCalledWith('api/stocks/search?q=a%26b%20c');
    s.getSectors().subscribe();
    expect(api.get).toHaveBeenCalledWith('api/stocks/sectors');
    s.filterStocks({ minPrice: 1, maxPrice: 2, minPE: 3, maxPE: 4, minDividend: 5, sector: 'Tech', minVolume: 6 }).subscribe();
    expect(api.get).toHaveBeenLastCalledWith(
      'api/stocks/filter?minPrice=1&maxPrice=2&minPE=3&maxPE=4&minDividend=5&sector=Tech&minVolume=6');
    s.filterStocks({}).subscribe();
    expect(api.get).toHaveBeenLastCalledWith('api/stocks/filter?');
    s.filterStocks({ minPrice: 0 }).subscribe(); // 0 is a real value, not "unset"
    expect(api.get).toHaveBeenLastCalledWith('api/stocks/filter?minPrice=0');
  });
});
