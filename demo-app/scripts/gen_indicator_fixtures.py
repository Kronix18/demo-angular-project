"""Generate golden-value fixtures for the TS indicator port (task 5.1).

Runs the REAL Python calculators (screener/viewingApp/indicators/calculators/)
over a fixed slice of msft.us.txt and dumps {input_hash, params, output[]} JSON
into demo-app/src/app/core/indicators/__fixtures__/.

Run manually from the screener repo venv (screener repo is read-only for code —
this script only READS the calculators and WRITES fixtures into demo-app):

    cd /c/Users/kevin/Documents/Programming/screener
    ./.venv/Scripts/python.exe ../demo-angular-project/demo-app/scripts/gen_indicator_fixtures.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

# screener repo root (contains viewingApp/) — script lives in demo-app/scripts/,
# so Programming = parents[3]
SCREENER = Path(__file__).resolve().parents[3] / "screener"
DEMO_APP = Path(__file__).resolve().parents[1]
DATA_FILE = SCREENER.parent / "test data" / "msft.us.txt"
OUT_DIR = DEMO_APP / "src" / "app" / "core" / "indicators" / "__fixtures__"
N_BARS = 120  # fixture slice: last 120 bars (2022-2026 era, real data)

sys.path.insert(0, str(SCREENER))

import pandas as pd  # noqa: E402

from viewingApp.indicators.calculators.moving_average import (  # noqa: E402
    MovingAverageCalculator,
)
from viewingApp.indicators.calculators.rsi import RSICalculator  # noqa: E402
from viewingApp.indicators.calculators.atr import ATRCalculator  # noqa: E402
from viewingApp.indicators.calculators.webby_rsi import (  # noqa: E402
    WebbyRSICalculator,
)
from viewingApp.indicators.calculators.bob_marley import (  # noqa: E402
    BobMarleyCalculator,
)


def load_msft() -> pd.DataFrame:
    rows = []
    with open(DATA_FILE, "r", encoding="utf-8") as fh:
        for line in fh:
            parts = line.strip().split(",")
            if len(parts) < 9 or parts[0] == "<TICKER>":
                continue
            # Stooq format: TICKER,PER,DATE,TIME,OPEN,HIGH,LOW,CLOSE,VOL,OPENINT
            d = parts[2]
            rows.append(
                {
                    "date": pd.Timestamp(
                        year=int(d[0:4]), month=int(d[4:6]), day=int(d[6:8])
                    ),
                    "open": float(parts[4]),
                    "high": float(parts[5]),
                    "low": float(parts[6]),
                    "close": float(parts[7]),
                    "volume": float(parts[8]),
                }
            )
    df = pd.DataFrame(rows)
    return df.tail(N_BARS).reset_index(drop=True)


def dump(name: str, params: dict, outputs: dict, df: pd.DataFrame) -> None:
    payload = {
        "description": f"Golden fixture for {name}: last {N_BARS} bars of msft.us.txt",
        "input_hash": hashlib.sha256(
            df.to_csv(index=False).encode("utf-8")
        ).hexdigest(),
        "n": int(len(df)),
        "params": params,
        # NaN -> null for JSON; TS compares with tolerance
        "outputs": {
            k: [None if v != v else round(float(v), 10) for v in arr]
            for k, arr in outputs.items()
        },
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}.json"
    path.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    n_vals = sum(len(a) for a in outputs.values())
    first_valid = next(
        (i for i, v in enumerate(list(outputs.values())[0]) if v == v), "none"
    )
    print(f"  {name}: {len(outputs)} outputs, {n_vals} values, first valid idx={first_valid}")


def dump_input(df: pd.DataFrame, name: str = "fixture_input") -> None:
    """The OHLCV input itself (epoch-ms timestamps) — the TS tests run the SAME
    bytes the Python calculators ran over."""
    payload = [
        {
            "timestamp": int(d.date.timestamp() * 1000),
            "open": float(d.open),
            "high": float(d.high),
            "low": float(d.low),
            "close": float(d.close),
            "volume": float(d.volume),
        }
        for d in df.itertuples()
    ]
    path = OUT_DIR / f"{name}.json"
    path.write_text(json.dumps(payload, indent=0), encoding="utf-8")
    h = hashlib.sha256(df.to_csv(index=False).encode("utf-8")).hexdigest()
    print(f"  {name}: {len(payload)} bars (epoch-ms), csv sha256={h[:16]}...")


def main() -> None:
    df = load_msft()
    print(f"Fixture: {len(df)} bars, {df['date'].iloc[0].date()} -> {df['date'].iloc[-1].date()}")

    # Edge fixtures: 16 bars so min_periods=14 fires after the diff's leading NaN
    # (pandas counts non-NaN observations; 14 bars -> all-NaN, verified live).
    flat_df = df.iloc[:16].assign(close=100.0, open=100.0, high=100.0, low=100.0).reset_index(drop=True)
    rise_df = df.iloc[:16].sort_values("close").assign(
        high=lambda d: d["high"] * 5, low=lambda d: d["low"] * 5, close=lambda d: d["close"] * 5
    ).reset_index(drop=True)  # monotonic rising closes -> avg_loss = 0 -> RSI 100

    dump("moving_average_sma50", {"method": "SMA", "source": "close", "length": 50, "offset": 0},
         MovingAverageCalculator.calculate(df, {"method": "SMA", "source": "close", "length": 50, "offset": 0}), df)
    dump("moving_average_ema21", {"method": "EMA", "source": "close", "length": 21, "offset": 0},
         MovingAverageCalculator.calculate(df, {"method": "EMA", "source": "close", "length": 21, "offset": 0}), df)
    dump("moving_average_wma10", {"method": "WMA", "source": "close", "length": 10, "offset": 0},
         MovingAverageCalculator.calculate(df, {"method": "WMA", "source": "close", "length": 10, "offset": 0}), df)
    dump("moving_average_rma14", {"method": "RMA", "source": "close", "length": 14, "offset": 0},
         MovingAverageCalculator.calculate(df, {"method": "RMA", "source": "close", "length": 14, "offset": 0}), df)
    dump("rsi14", {"source": "close", "length": 14, "overbought": 70.0, "oversold": 30.0},
         RSICalculator.calculate(df, {"source": "close", "length": 14, "overbought": 70.0, "oversold": 30.0}), df)
    dump("rsi_flat", {"source": "close", "length": 14, "overbought": 70.0, "oversold": 30.0},
         RSICalculator.calculate(flat_df, {"source": "close", "length": 14, "overbought": 70.0, "oversold": 30.0}), flat_df)
    dump("rsi_noloss", {"source": "close", "length": 14, "overbought": 70.0, "oversold": 30.0},
         RSICalculator.calculate(rise_df, {"source": "close", "length": 14, "overbought": 70.0, "oversold": 30.0}), rise_df)
    dump("atr14_rma", {"length": 14, "smoothing": "RMA"},
         ATRCalculator.calculate(df, {"length": 14, "smoothing": "RMA"}), df)
    dump("atr14_sma", {"length": 14, "smoothing": "SMA"},
         ATRCalculator.calculate(df, {"length": 14, "smoothing": "SMA"}), df)
    dump("webby_rsi_5150", {"mode": "5.150", "ema_length": 21, "sma_length": 10, "atr_length": 50, "stretched_level": 3.0},
         WebbyRSICalculator.calculate(df, {"mode": "5.150", "ema_length": 21, "sma_length": 10, "atr_length": 50, "stretched_level": 3.0}), df)
    dump("webby_rsi_original", {"mode": "Original", "ema_length": 21, "signal_length": 10, "positive_only": True},
         WebbyRSICalculator.calculate(df, {"mode": "Original", "ema_length": 21, "signal_length": 10, "positive_only": True}), df)
    dump("bob_marley_52w", {"high_reference": "52_week", "source": "low", "atr_length": 21, "green_max": 4.0, "yellow_max": 8.0},
         BobMarleyCalculator.calculate(df, {"high_reference": "52_week", "source": "low", "atr_length": 21, "green_max": 4.0, "yellow_max": 8.0}), df)

    dump_input(df)
    dump_input(flat_df, "fixture_input_flat")
    dump_input(rise_df, "fixture_input_rising")
    print("DONE")


if __name__ == "__main__":
    main()
