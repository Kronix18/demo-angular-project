import { InjectionToken } from '@angular/core';

/** Where the backend lives: `<meta name="api-url" content="…">` in index.html (deploy-time), else the LAN dev server. */
export const DEFAULT_API_URL = 'http://192.168.1.111:3000';

export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => {
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="api-url"]')?.getAttribute('content')?.trim() : '';
    return (meta || DEFAULT_API_URL).replace(/\/+$/, '');
  },
});
