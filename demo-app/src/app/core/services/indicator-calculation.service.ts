import { Injectable } from '@angular/core';
import { OHLCV } from '../models/ohlcv.model';
import {
  ATR, BOB_MARLEY, DEFAULT_DEFINITIONS, IndicatorDefinition, MOVING_AVERAGE, ParamValue, RSI, WEBBY_RSI,
} from '../indicators/indicator-definitions';
import { CalcOutputs, Params, atr, bobMarley, movingAverage, rsi, webbyRsi } from '../indicators/indicator-calculators';

export type IndicatorOutputs = Record<string, (number | null)[]>;

type Calculator = (bars: OHLCV[], params: Params) => CalcOutputs;

const CALCULATORS: Record<string, Calculator> = {
  [MOVING_AVERAGE.id]: movingAverage,
  [ATR.id]: atr,
  [RSI.id]: rsi,
  [WEBBY_RSI.id]: webbyRsi,
  [BOB_MARLEY.id]: bobMarley,
};

/**
 * Registry-shaped indicator engine (mirrors Python `IndicatorRegistry`).
 * Outputs are NaN-padded to input length; NaN/Infinity are exposed as `null`
 * (Chart.js treats null as a gap).
 */
@Injectable({ providedIn: 'root' })
export class IndicatorCalculationService {
  /** Definitions sorted by (category, name) — drives the Add-Indicator menu. */
  supportedIndicators(): IndicatorDefinition[] {
    return [...DEFAULT_DEFINITIONS].sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
  }

  definition(id: string): IndicatorDefinition {
    const def = DEFAULT_DEFINITIONS.find((d) => d.id === id);
    if (!def) throw new Error(`Unknown indicator: ${id}`);
    return def;
  }

  /** Fills missing params from defaults; never overwrites provided values. */
  normalizeParams(id: string, params: Record<string, unknown> = {}): Record<string, ParamValue> {
    const merged: Record<string, ParamValue> = {};
    for (const spec of this.definition(id).parameters) merged[spec.key] = spec.default;
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) merged[k] = v as ParamValue;
    return merged;
  }

  /** Human label, e.g. "SMA 50 close" (falls back to the definition name). */
  displayName(id: string, params: Record<string, unknown> = {}): string {
    const def = this.definition(id);
    if (!def.labelTemplate) return def.name;
    const p = this.normalizeParams(id, params);
    return def.labelTemplate.replace(/\{(\w+)\}/g, (_m, k: string) => (k in p ? String(p[k]) : def.name));
  }

  calculate(type: string, params: Record<string, unknown>, ohlcv: OHLCV[]): IndicatorOutputs {
    const def = this.definition(type);
    const raw = CALCULATORS[def.id](ohlcv, this.normalizeParams(def.id, params));
    const result: IndicatorOutputs = {};
    for (const [key, series] of Object.entries(raw)) {
      result[key] = series.map((v) => (Number.isFinite(v) ? v : null));
    }
    return result;
  }
}
