# Task 4: Write Auth Interceptor — Attach and Remove JWT Bearer Token

## Scope: Interceptor that attaches the JWT Bearer header on every outgoing request.

### Deliverable: `src/app/core/interceptors/auth.interceptor.ts`

A single Angular `HttpInterceptor` class that:

1. Extracts `token = localStorage.getItem('auth_token')` at request time (no premature read).
2. Attaches it to the `Authorization` header as a Bearer token.
3. Logs a simple trace event using Angular's `console.debug` for debugging.
4. Does **not** modify the response.

### First step — write tests:

**Not applicable**, however, a unit test that runs in isolation can assert that when a mocked token is set on localStorage, the outbound interceptor call adds `Authorization: Bearer <TOKEN>` to the cloned request, and removes it afterward (or preserves any existing token if present).

## Completion Criteria

- Interceptor compiles.
- Intercept order ensures this fires before any other HTTP interceptor in the pipeline.
- Token is extracted at request time (not on module load) so stale values are read fresh per-call.
