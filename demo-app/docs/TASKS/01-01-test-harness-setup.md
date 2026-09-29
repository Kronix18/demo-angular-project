# Task 1: Test Harness Setup

## Scope: Create a shared test utility module for the Angular application.

### Deliverable: `src/app/core/test/utils.ts`

A TypeScript module that provides:

- A base class or interface for all fixtures/mocks used across test cases.
- Helper functions for generating synthetic data arrays (OHLC bars, price histories, screener results).
- Utilities for mocking the `HttpClient` to intercept requests in isolation.

### Dependencies: none (pure utility module)

### First step — write tests: **NOT APPLICABLE** (this is a foundational utility; acceptance comes from successful integration by subsequent tasks).

## Completion Criteria

When this task is done, every other unit test file can `import { fakeHttpClient, buildOHLCBar, ... }` from `utils.ts`.

**Graphify step:** After code commit, run the project's `.pre-commit` / post-commit hook which invokes `/graphify . --mode deep --dir ../graphify-out` to regenerate the knowledge graph with this new utility file added.
