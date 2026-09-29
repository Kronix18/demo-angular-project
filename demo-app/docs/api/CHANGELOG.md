# API contract changelog

Rules: additive changes only (new optional fields, new endpoints, new enum values); anything else needs a new path version. Every deviation the backend needs from this contract is recorded here **before** it ships; front-end PR template asks "contract changed?".

## 2026-09-29 — v2 initial specification
- Files 00–10, conventions (`README.md`), integration papers (`../integration/`).
- Decisions: all prices split-adjusted only (`meta.price_basis`, `meta.volume_basis`, `meta.source`); ratings are model estimates with per-rating `effective_dates`, `unrated` reasons and `display_names`; benchmark and market indices from `GET /api/meta.benchmarks` (**interim: `TSX` replaces the S&P 500; market engine = `NDQ` + `TSX`**); index catalogue of 60 Stooq indices (`GET /api/indices`); news design (`07` §2); real SEC fundamentals tables mapped in `04`; anonymous demo symbols and `api_access=false`.
