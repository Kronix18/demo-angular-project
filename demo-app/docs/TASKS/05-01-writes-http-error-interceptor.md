# Task 5: HTTP Error Interceptor — Global 401/403/500 Handling

## Scope: A single HTTP interceptor that treats all HTTP errors according to a small, explicit policy.

### Deliverable: `src/app/core/interceptors/error.interceptor.ts`

This is one class. Responsibilities:

- When `err.status === 401`, store the error in a dedicated `errorService`.
- When `err.status === 403`, also record it there.
- When `err.status === 500`, store it.
- When `err.status !== 2xx` and not one of the above, treat as "unknown server error" — still record it.
- Expose a single public method: `registerError(statusCode: number, err: any)` used by calling code to decide whether to retry or redirect to login.
- Emit any side effects (error toast notifications) using the application's error channel.

### First step — write tests:

Write a unit test that:

1. Mocks the Angular `HttpClient` as part of a fake HTTP client with a `get` stub.
2. Calls `registerError(401, { response: { status: 401, error: { message: "unauthorized" } } })`.
3. Asserts that `errorService.recordError('unauthorized')` was called.
4. Asserts that `errorService.notify('Unauthorized', 'Authentication required.')` is emitted.

## Completion Criteria

- Unit test for status codes 2xx passes (no-op).
- Unit test for 401 passes and records the correct error key.
- Unit test for 503 (server unavailable) passes and triggers a retry-after delay mechanism in a separate module.
- The interceptor itself compiles.
