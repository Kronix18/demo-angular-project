import { OhlcController, OhlcElement } from 'chartjs-chart-financial';

// the plugin ships no usable typings for its classes
const OhlcElementBase: any = OhlcElement;
const OhlcControllerBase: any = OhlcController;

/**
 * TradingView-style bar element: OHLC bars, HLC bars (no open tick) and
 * High-low bars. Replaces the plugin's `ohlc` element, which (a) has its
 * up/down colours swapped and (b) offers neither HLC nor High-low.
 * Colours come from the dataset's `borderColors` ({up, down, unchanged}).
 */
export class TvBarElement extends OhlcElementBase {
  static id = 'tvbar';
  static defaults = { ...OhlcElementBase.defaults, barStyle: 'ohlc', lineWidth: 1.5 };

  draw(ctx: CanvasRenderingContext2D): void {
    const me = this as any;
    const { x, open, high, low, close } = me;
    const colors = me.options?.borderColors ?? {};
    const color = close > open ? colors.up : close < open ? colors.down : (colors.unchanged ?? colors.up);
    const half = (me.width ?? 6) * 0.4;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = me.options?.lineWidth ?? 1.5;
    if (me.options?.barStyle === 'highlow') {
      ctx.fillRect(x - half, Math.min(high, low), half * 2, Math.max(1, Math.abs(low - high)));
    } else {
      ctx.beginPath();
      ctx.moveTo(x, high);
      ctx.lineTo(x, low);
      if (me.options?.barStyle !== 'hlc') { ctx.moveTo(x - half, open); ctx.lineTo(x, open); }
      ctx.moveTo(x, close);
      ctx.lineTo(x + half, close);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export class TvBarController extends OhlcControllerBase {
  static id = 'tvbar';
  static defaults = { ...OhlcControllerBase.defaults, dataElementType: TvBarElement.id };
}
