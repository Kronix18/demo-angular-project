// Chart.js setup: registration MUST happen before chartjs-chart-financial is
// imported anywhere (its module reads Chart.helpers at load time; ESM import
// hoisting makes same-file ordering impossible). Import this module FIRST —
// before 'chartjs-chart-financial' — everywhere.
//
// NOTE (verified empirically under ng test + node, 2026-09-24): the financial
// plugin's SIDE-EFFECT import registers its controllers/elements onto a
// different chart.js module instance (ESM/CJS dual-package hazard) — the
// side-effect import alone is NOT reliable. The named exports resolve to this
// copy, so ALL financial types are registered explicitly here:
// CandlestickController + CandlestickElement (candlesticks), plus the OHLC
// pair for future use.
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns'; // time scale adapter (before any time-scale chart)
import zoomPlugin from 'chartjs-plugin-zoom';
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
} from 'chartjs-chart-financial';

Chart.register(
  ...registerables,
  zoomPlugin,
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement,
);
