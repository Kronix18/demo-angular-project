# Task 7: AuthService — GET /api/auth/profile

## Scope: A single endpoint call that fetches the current user profile.

### Deliverable: `src/app/core/auth/auth.service.ts` (existing file, add one method)

Add a new method:

```ts
getProfile(): Observable<UserProfile> {
  return this.api.get('/api/auth/profile').pipe(
    shareReTakeUntil(first(this.profile$)),
    catchError((err) => this.handleError(err))
  );
}
```

### First step — write tests:

Write a unit test that asserts:

- Calling `getProfile()` subscribes to an external observable and emits a mocked profile object.
- The observable emits `null` when no token is found in localStorage (unauthenticated state).
- When an `error` event fires from the HTTP client, unsubscribe cleanly and throw an error.
