# 05 — CAN SLIM, bases/patterns, trade levels, sell signals

Backing (**all PLAN**): `canslim_component_scores`, `canslim_score_history`, `detected_bases`, `base_features`, `base_pivots`,
`breakouts`, `sell_signals`. Plan §22–§42.

## 1. CAN SLIM

### `GET /api/stocks/{symbol}/canslim?as_of=`
```json
{
  "security_id": 4821, "effective_date": "2026-09-22", "canslim_score": 91,
  "components": {
    "c": { "score": 95, "passed": true,  "reasons": [ { "code": "eps_yoy_ge_25", "passed": true, "value": 48.2, "threshold": 25, "label": "Quarterly EPS +48% vs +25% required" } ] },
    "a": { "score": 88, "passed": true,  "reasons": [ … ] },
    "n": { "score": 80, "passed": true,  "reasons": [ … ] },
    "s": { "score": 72, "passed": true,  "reasons": [ … ] },
    "l": { "score": 96, "passed": true,  "reasons": [ … ] },
    "i": { "score": 90, "passed": true,  "reasons": [ … ] },
    "m": { "score": 100, "passed": true, "reasons": [ … ] } },
  "meta": { "model_version": { "canslim": "CANSLIM_V1" } }
}
```
`reasons[]` is mandatory (plan §46.2 "show why each score passed / failed"): `code` stable identifier, `passed`, `value`, `threshold`, `label`
(server-rendered English; the client may translate by `code`). Tables: `canslim_component_scores(security_id, effective_date, component char(1),
score smallint, passed bool, reasons jsonb, model_version)`, `canslim_score_history(security_id, effective_date, score, model_version)`.

`GET /api/stocks/{symbol}/canslim/history?from=&to=` — columnar `effective_date`, `canslim_score`, `c`…`m`.

## 2. Bases / patterns

### `GET /api/stocks/{symbol}/patterns?status=active|all&from=&to=&types=&as_of=`
```json
{ "data": [ {
    "base_id": 991245, "pattern_type": "cup_with_handle", "confidence": 0.86, "stage": 2,
    "base_start": "2026-04-02", "base_end": "2026-09-18",
    "depth_pct": 24.0, "length_weeks": 11, "prior_uptrend_pct": 62.0,
    "handle_depth_pct": 7.0, "handle_length_days": 8,
    "pivot": 121.50, "buy_zone_low": 121.50, "buy_zone_high": 127.58,
    "state": "below_pivot", "distance_to_pivot_pct": -1.4, "distance_to_pivot_atr": -0.6,
    "volume_dryup_score": 78, "breakout_volume_ratio": null, "rs_line_strength": 84, "symmetry_score": 80, "tightness_score": 74,
    "support_at_50dma": true, "distribution_days_in_base": 2, "fault_count": 1,
    "base_quality_score": 91, "breakout_quality_score": null,
    "geometry": {
      "points": [ { "t": 1743552000000, "p": 118.3, "role": "left_peak" }, { "t": 1750000000000, "p": 91.2, "role": "cup_low" },
                  { "t": 1757000000000, "p": 121.5, "role": "right_peak" }, { "t": 1758000000000, "p": 113.0, "role": "handle_low" } ],
      "lines": [ { "role": "pivot", "p": 121.5, "t1": 1757000000000, "t2": null } ] },
    "breakout": null } ],
  "meta": { "as_of": "…", "model_version": { "patterns": "PATTERNS_V1" } } }
```
| Enum | Values |
|---|---|
| `pattern_type` | `cup_with_handle`, `cup_without_handle`, `double_bottom`, `flat_base`, `ascending_base`, `three_weeks_tight`, `ipo_base`, `high_tight_flag`, `saucer`, `saucer_with_handle`, `base_on_base` |
| `state` | `below_pivot`, `at_pivot`, `in_buy_zone`, `extended`, `failed_breakout` |
| `geometry.points[].role` | `left_peak`, `cup_low`, `right_peak`, `handle_high`, `handle_low`, `first_low`, `middle_peak`, `second_low`, `base_high`, `base_low` |

`geometry` is the reason this endpoint exists: the chart draws cup path, handle, double-bottom points and flat-base range **from server
points** instead of guessing. Points are `{t: epoch-ms, p: price}` so they map straight to chart scales.

`breakout` when it happened: `{ "date":"2026-09-19","price":122.1,"volume_ratio":1.9,"quality_score":94,"failed":false,"failed_date":null,"early_entry":false }`.

`GET /api/patterns/{base_id}` — single base with full feature set. `GET /api/patterns/recent-breakouts?days=5&min_quality=70&limit=50` — feeds screener presets and the market page.

## 3. Trade levels

### `GET /api/stocks/{symbol}/trade-levels?entry=&base_id=`
Optional `entry` (user's purchase price) to get personal stop / target; otherwise anchored on the active base's pivot.
```json
{ "pivot": 121.5, "entry_price": 122.1,
  "stops": { "max_loss_7pct": 113.55, "max_loss_8pct": 112.33, "pivot_failure": 117.9, "handle_low": 113.0, "base_low": 91.2,
             "ema_21": 116.2, "sma_50": 110.4, "sma_10w": 112.0, "atr": 114.8, "trailing": 117.0 },
  "targets": { "profit_20pct": 145.8, "profit_25pct": 151.9, "max_gain_since_breakout_pct": 14.0, "days_to_20pct": null },
  "eight_week_hold": { "candidate": false, "hold_until": null } }
```
Configurable max-loss (`loss_pct=7`) as a query param; the chart draws stop zone (red) and 20–25 % profit zone (green) from these.

## 4. Sell signals

### `GET /api/stocks/{symbol}/sell-signals?from=&to=`
```json
{ "data": [ { "date": "2026-09-10", "signal": "break_below_50dma_heavy_volume", "severity": "warning", "price": 118.4, "detail": "Closed 2.1% below 50DMA on 1.8× volume" } ] }
```
`signal`: `failed_breakout`, `break_below_21ema`, `break_below_50dma_heavy_volume`, `break_below_10wma`, `largest_decline_since_breakout`,
`largest_volume_decline`, `climax_top`, `exhaustion_gap`, `late_stage_failed_base`, `rs_line_deterioration`, `distribution_cluster`,
`round_trip_gain`, `parabolic_extension`, `multiple_failed_breakouts`, `heavy_volume_reversal`, `key_support_failure`.
`severity`: `info | warning | sell`. Suppression by the eight-week rule is done server-side (`suppressed_by: "eight_week_hold"`).

## 5. Chart overlay contract (what the front end draws)
Base start/end box, cup path, handle, double-bottom points, flat range, pivot line, buy zone band, breakout / failed-breakout markers, stop zone,
profit zone, sell markers — each from the fields above; no calculation client-side. Server-drawn objects are read-only, tagged `source:"system"`,
and never saved into the user's drawings.
