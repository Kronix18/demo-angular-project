import { TestBed } from '@angular/core/testing';
import { API_URL, DEFAULT_API_URL } from './api-url';
import { ApiService } from './services/api.service';

describe('API_URL', () => {
  afterEach(() => document.querySelectorAll('meta[name="api-url"]').forEach((m) => m.remove()));

  it('defaults to the local backend on localhost:3000', () => {
    expect(DEFAULT_API_URL).toBe('http://localhost:3000');
    expect(TestBed.inject(API_URL)).toBe(DEFAULT_API_URL);
  });

  it('can be set per deployment with a meta tag (trailing slashes ignored)', () => {
    const m = document.createElement('meta');
    m.name = 'api-url'; m.content = ' https://api.example.com/// ';
    document.head.appendChild(m);
    expect(TestBed.inject(API_URL)).toBe('https://api.example.com');
  });

  it('the ApiService builds its URLs from it', () => {
    TestBed.configureTestingModule({ providers: [{ provide: API_URL, useValue: 'https://x.test' }] });
    expect((TestBed.inject(ApiService) as any).apiUrl).toBe('https://x.test');
  });
});
