import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { errorInterceptor } from './core/api/errors';
import { authInterceptor } from './core/api/auth-interceptor';
import { etagCacheInterceptor } from './core/api/etag-cache';
import { retryInterceptor } from './core/api/retry-interceptor';
import { ChartDataService } from './core/services/chart-data.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([errorInterceptor, retryInterceptor, etagCacheInterceptor, authInterceptor])),
    ChartDataService
  ]
};