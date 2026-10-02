import { TestBed } from '@angular/core/testing';
import { CURSOR_TOOLS, TOOL_DEFS } from '../../charts/drawings/drawing-tools';
import { IconComponent } from './icon.component';
import { FILLED_ICONS, ICONS, STAMPS, iconPath } from './icons';

describe('icons (drawn, not pictures)', () => {
  const NEEDED = [
    ...TOOL_DEFS.map((t) => t.id), ...CURSOR_TOOLS.map((t) => t.id),
    'measure', 'zoom', 'zoomin', 'zoomout', 'magnet', 'keep', 'lock', 'eye', 'eyeoff', 'trash', 'chevron', 'close', 'plus', 'gear', 'undo', 'redo', 'panel',
    'compare', 'replay', 'layouts', 'camera', 'fullscreen', 'reset', 'indicators', 'calendar', 'fit', 'invert', 'percent', 'play', 'pause', 'stepforward', 'stepback',
    'bring', 'clone', 'candles', 'ohlcbars', 'columns', 'linechart', 'back', 'sun', 'moon', 'contrast', 'sortboth', 'sortup', 'sortdown',
  ];

  it('every tool, cursor and toolbar button has an icon', () => {
    expect(NEEDED.filter((n) => !ICONS[n])).toEqual([]);
  });

  it('paths are plain SVG path data (numbers and path commands only)', () => {
    for (const [name, d] of Object.entries(ICONS)) expect(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/.test(d), name).toBe(true);
    for (const [name, d] of Object.entries(ICONS)) expect(d.includes('NaN') || d.includes('undefined'), name).toBe(false);
  });

  it('no two tools share the same drawing (they must be tellable apart)', () => {
    const seen = new Map<string, string>();
    for (const n of NEEDED.filter((x) => x !== 'zoomin')) { // zoom-in is the plus sign
      const d = ICONS[n];
      if (seen.has(d)) throw new Error(`${n} looks exactly like ${seen.get(d)}`);
      seen.set(d, n);
    }
  });

  it('every stamp of the picker is a drawn icon', () => {
    expect(STAMPS.filter((n) => !ICONS[n])).toEqual([]);
    expect(new Set(STAMPS.map((n) => ICONS[n])).size).toBe(STAMPS.length);
  });

  it('filled icons all exist', () => {
    for (const n of FILLED_ICONS) expect(ICONS[n], n).toBeTruthy();
  });

  it('<app-icon> renders an aria-hidden svg with the path; a solid icon is filled; an unknown name draws nothing', () => {
    const f = TestBed.createComponent(IconComponent);
    f.componentRef.setInput('name', 'iconstar');
    f.componentRef.setInput('size', 30);
    f.detectChanges();
    const svg = f.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('30');
    expect(svg.classList.contains('filled')).toBe(true);
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(iconPath('iconstar'));
    f.componentRef.setInput('name', 'trend');
    f.detectChanges();
    expect(svg.classList.contains('filled')).toBe(false);
    f.componentRef.setInput('name', 'nope');
    f.detectChanges();
    expect(svg.querySelector('path')!.getAttribute('d')).toBe('');
  });
});
