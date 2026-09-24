export interface OHLCV {
  timestamp: number;   // Unix epoch MILLISECONDS (UTC) — Date.UTC(y, m-1, d); see API-BACKEND-SPEC.md
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}