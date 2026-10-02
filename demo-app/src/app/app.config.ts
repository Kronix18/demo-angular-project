import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { errorInterceptor } from './core/api/errors';
import { authInterceptor } from './core/api/auth-interceptor';
import { etagCacheInterceptor } from './core/api/etag-cache';
import { retryInterceptor } from './core/api/retry-interceptor';
import { entitlementInterceptor } from './core/api/upgrade';
import { MetaService } from './core/api/meta.service';
import { SymbolCapabilities } from './core/api/symbol-capabilities';
import { EntitlementsService } from './core/api/entitlements.service';
import { OhlcvApiClient } from './core/api/ohlcv-api.client';
import { ChartDataService } from './core/services/chart-data.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor, entitlementInterceptor, retryInterceptor, etagCacheInterceptor, authInterceptor])),
    provideAppInitializer(() => { inject(MetaService).load(); inject(SymbolCapabilities); inject(EntitlementsService).load(); inject(OhlcvApiClient); }), // not awaited: never blocks first render; SymbolCapabilities instantiated so its e2e hook exists
    ChartDataService
  ]
};