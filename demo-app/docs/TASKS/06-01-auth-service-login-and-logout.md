# Task 6: AuthService — Read/Write Authentication State

## Scope: A single class that manages authentication state.

### Deliverable: `src/app/core/auth/auth.service.ts`

A single-service class with a small, focused API:

- `login(email: string, password: string): Promise<void>` — sends a POST to `/api/auth/login`, stores the resulting JWT token in `localStorage`.
- `logout(): void` — clears `localStorage` keys for the auth token.
- `isLoggedIn(): boolean` — checks whether a valid token is present on disk.
- `getProfile(): Observable<UserProfile | null>` — makes a GET request to `/api/auth/profile`.

### First step — write tests:

Write a unit test that mocks the HTTP client's `post("/auth/login", { email, password })` and asserts that calling `login(email, password)` calls `localStorage.setItem('token', <JWT>)` with the mocked token value.
