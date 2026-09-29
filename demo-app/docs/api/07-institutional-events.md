# 07 — Institutional sponsorship and news events

## 1. Institutional (13F)  — **PLAN** (`institutional_managers`, `form13f_filings`, `form13f_holdings`, `institutional_metrics`, `fund_quality`)

13F data is quarterly and public **45 days after quarter end**; `as_of` must only include filings filed by then (no look-ahead).

### `GET /api/stocks/{symbol}/institutional?as_of=`
```json
{ "security_id": 4821, "as_of": "2026-09-22", "latest_quarter": "2026-06-30",
  "fund_count": 5120, "fund_count_change_q": 84, "fund_count_change_pct": 1.7,
  "institutional_ownership_pct": 74.2, "shares_held": 5510000000,
  "consecutive_quarters_increase": 4,
  "top_quality_holders": 38, "sponsorship_rating": "A",
  "history": { "quarter": ["2025-09-30","2025-12-31","2026-03-31","2026-06-30"], "fund_count": [ … ], "shares_held": [ … ] } }
```
### `GET /api/stocks/{symbol}/institutional/holders?quarter=2026-06-30&sort=shares:desc&limit=25`
`{ manager_id, manager_name, shares, value_usd, pct_of_shares_out, change_shares, change_pct, is_new, is_sold_out, quality_score, filing_date }`.
Ultimate only (proposal, see `09`) (`feature: "holders"`).
### `GET /api/institutions/{manager_id}` (name, AUM, quality score, top holdings) — later.

## 2. News (TradingView-style) and catalyst events — **PLAN** (`news_articles`, `news_article_symbol`, `company_events`, `event_classifications`)

### 2.1 What "recreate TradingView news" means for the product
TradingView shows (a) a **news feed** (market-wide and per symbol) of headlines with source, time and related tickers, opening the publisher's page or a short preview, (b) **news markers** on the chart, (c) filters (symbol, category, source, language), and (d) a symbol-page news tab. TradingView's content is licensed from wire services; **the equivalent here must not scrape publishers or copy articles**. Contract decision (`../DATA-PLAN.md` §7 L9): the product stores and serves **headline + short snippet (≤ 300 chars, only where the source licence allows) + link-out + our own classification**; never article bodies.

### 2.2 Source recommendation for the backend (owner decides; ranked)
| # | Source | Use | Notes |
|---|---|---|---|
| 1 | **SEC EDGAR 8-K** (already ingested via `sec_filing`) | primary, free, timestamped catalysts (earnings 2.02, management 5.02, agreements 1.01, M&A 2.01, guidance) | 8-K item numbers are not in `sec_filing` yet: add `items` from the submissions feed. |
| 2 | **Alpha Vantage `NEWS_SENTIMENT`** (already in the stack) | per-ticker/topic headline feed with source, summary, ticker relevance and sentiment scores | licensed API; check redistribution terms of the plan you buy; rate-limited (25/day on free — needs a paid key for a universe). |
| 3 | **Company press-release RSS / IR feeds** | primary-source releases for the tracked names | per-company feed list to maintain. |
| 4 | **GDELT DOC 2.0** | free discovery/backfill of articles by company name; not treated as verified catalysts | noisy; needs entity linking. |
| 5 | Yahoo Finance headlines (RSS/API) | fallback for headline coverage | terms of use restrict commercial redistribution; treat as *link-out only* if at all. |
| – | Web scraping of publishers | **not recommended** | copyright/ToS risk; brittle. |
Business Quant is fundamentals-oriented; use its news only if the contract includes it.

### 2.3 Object `NewsItem`
```json
{ "news_id": 9912345, "published_at": "2026-09-22T13:05:00Z", "headline": "Microsoft raises cloud guidance…",
  "snippet": "…", "source": { "key": "reuters_like", "name": "Publisher name", "is_primary": false },
  "url": "https://…", "language": "en",
  "symbols": [ { "security_id": 4821, "symbol": "MSFT", "relevance": 0.94 } ],
  "category": "guidance", "sentiment": { "label": "positive", "score": 0.62 }, "importance": 4,
  "is_sec_filing": false, "filing": null, "provider": "alpha_vantage", "classifier_version": "EVENT_V1" }
```
`category` enum: `earnings`, `guidance`, `analyst_rating`, `merger_acquisition`, `product`, `management`, `contract`, `legal_regulatory`, `insider_buying`, `buyback_dividend`, `fda_trial`, `macro`, `other`. `sentiment.label`: `positive | neutral | negative | null`. `snippet` may be `null` when the licence forbids it. For SEC-derived items: `is_sec_filing: true`, `filing: { form: "8-K", accession_number, items: ["2.02"] }`, `source.is_primary: true`.
Tables: `news_articles(news_id, published_at, headline, snippet, url, source_key, language, provider, provider_id, dedupe_hash, ingested_at)`, `news_article_symbol(news_id, security_id, relevance)`, `event_classifications(news_id, category, sentiment_label, sentiment_score, importance, classifier_version, confidence)`; unique `(provider, provider_id)` and `dedupe_hash` (same headline from several feeds shows once). Indexes: `(published_at desc)`, `(security_id, published_at desc)`.

### 2.4 Endpoints
| Endpoint | Purpose |
|---|---|
| `GET /api/news?symbols=&category=&sentiment=&source=&language=&min_importance=&from=&to=&q=&limit=30&cursor=` | market-wide / filtered feed, newest first; `symbols` up to 50 (watchlist news) |
| `GET /api/stocks/{symbol}/news?…same filters…` | symbol news tab |
| `GET /api/news/{news_id}` | single item (for the reader dialog; same fields) |
| `GET /api/news/sources` | available `source`s and `category`s (drives filter UI) |
| `GET /api/news/unread-count?since=` | badge for the news tab (client passes last-seen timestamp; nothing stored server-side) |
| `GET /api/chart/{symbol}/markers?types=news` | chart markers (one per day, `detail` = top headline, `count`) — see `04` §3 |
| `GET /api/stocks/{symbol}/events?…` | **catalyst events only** (importance ≥ 3, deduped, for the N score and the checkup): `{event_id, date, type, sentiment, importance, headline, url, confidence}` |
| `GET /api/events/recent?types=&min_importance=4&limit=50` | market-wide catalyst feed (screener "N" filter `has_catalyst_60d`) |
List envelope: `{ data: [NewsItem], meta: { total?, next_cursor, as_of, sources: [...] } }`. `Cache-Control: public, max-age=60` (news changes intraday even though prices are EOD); `ETag` supported.
`event.type` (subset of `category` used by the N score): `new_product`, `new_management`, `new_contract`, `earnings_surprise`, `guidance_raise`, `guidance_cut`, `merger_acquisition`, `fda_approval`, `patent`, `buyback`, `insider_buying`, `upgrade`, `downgrade`, `lawsuit`, `regulatory`, `other`.

### 2.5 Tier suggestion
Free: market headlines, last 24 h, 20 items. Plus: per-symbol news (7 days). Pro: filters, sentiment, 90 days, chart markers. Ultimate: full history, watchlist-news feed, news alerts.

### 2.6 Front end
Chart side panel gets a **News tab** (per current symbol) beside watchlist/alerts; a `/news` page with filters; a news-marker layer on the chart; sentiment/category chips; watchlist news; unread badge. All headline links open the publisher in a new tab (`rel="noopener noreferrer"`); no article bodies are rendered.
