/**
 * Registry of the persistent drawing tools (TradingView-style groups). `points`
 * is how many anchors the tool takes: a number, `poly` (clicks until Enter /
 * double-click) or `free` (drag). Measure and Zoom are transient and live in
 * the controller/sidebar, not here.
 */
export type ToolGroup = 'lines' | 'fib' | 'patterns' | 'projection' | 'shapes' | 'text' | 'icons';

export interface ToolDef {
  id: string;
  label: string;
  icon: string;
  group: ToolGroup;
  points: number | 'poly' | 'free';
  /** the viewer opens the inline text editor right after the drawing is placed */
  text?: boolean;
}

export const TOOL_GROUPS: { id: ToolGroup; label: string; icon: string }[] = [
  { id: 'lines', label: 'Trend lines', icon: '⟋' },
  { id: 'fib', label: 'Fib & Gann', icon: 'Fib' },
  { id: 'patterns', label: 'Patterns', icon: 'XABCD' },
  { id: 'projection', label: 'Forecasting & measuring', icon: '⇅' },
  { id: 'shapes', label: 'Brushes & shapes', icon: '✎' },
  { id: 'text', label: 'Text & notes', icon: 'T' },
  { id: 'icons', label: 'Icons', icon: '★' },
];

const t = <I extends string>(id: I, label: string, icon: string, group: ToolGroup, points: ToolDef['points'], text?: boolean) =>
  ({ id, label, icon, group, points, ...(text ? { text } : {}) }) as ToolDef & { id: I };

export const TOOL_DEFS = [
  // trend lines
  t('trend', 'Trend line', '⟋', 'lines', 2),
  t('rayline', 'Ray', '↗', 'lines', 2),
  t('info', 'Info line', 'ⓘ', 'lines', 2),
  t('extended', 'Extended line', '↔', 'lines', 2),
  t('angle', 'Trend angle', '∠', 'lines', 2),
  t('hline', 'Horizontal line', '―', 'lines', 1),
  t('ray', 'Horizontal ray', '⟶', 'lines', 1),
  t('vline', 'Vertical line', '¦', 'lines', 1),
  t('cross', 'Cross line', '+', 'lines', 1),
  t('arrow', 'Arrow', '➚', 'lines', 2),
  t('channel', 'Parallel channel', '⫽', 'lines', 2),
  t('disjoint', 'Disjoint channel', '⧄', 'lines', 4),
  t('regression', 'Regression trend', '≈', 'lines', 2),
  // fib & gann
  t('fib', 'Fib retracement', 'Fib', 'fib', 2),
  t('fibext', 'Trend-based fib extension', 'Fx', 'fib', 3),
  t('fibchannel', 'Fib channel', 'Fc', 'fib', 3),
  t('fibtime', 'Fib time zone', 'Ft', 'fib', 2),
  t('fibfan', 'Fib speed resistance fan', 'Ff', 'fib', 2),
  t('fibcircles', 'Fib circles', '◎', 'fib', 2),
  t('gannbox', 'Gann box', '▦', 'fib', 2),
  t('gannfan', 'Gann fan', '☰', 'fib', 2),
  t('pitchfork', 'Pitchfork', 'ψ', 'fib', 3),
  // patterns
  t('xabcd', 'XABCD pattern', 'XA', 'patterns', 5),
  t('abcd', 'ABCD pattern', 'AB', 'patterns', 4),
  t('triangle', 'Triangle pattern', '◺', 'patterns', 4),
  t('headshoulders', 'Head and shoulders', 'HS', 'patterns', 7),
  t('threedrives', 'Three drives pattern', '3D', 'patterns', 7),
  t('elliottimpulse', 'Elliott impulse wave (12345)', '12', 'patterns', 6),
  t('elliottcorrection', 'Elliott correction wave (ABC)', 'AC', 'patterns', 4),
  t('elliotttriangle', 'Elliott triangle wave (ABCDE)', 'AE', 'patterns', 6),
  // forecasting & measuring
  t('longpos', 'Long position', '⇈', 'projection', 3),
  t('shortpos', 'Short position', '⇊', 'projection', 3),
  t('forecast', 'Forecast', '⤳', 'projection', 2),
  t('daterange', 'Date range', '⇹', 'projection', 2),
  t('pricerange', 'Price range', '⇕', 'projection', 2),
  t('daterangeprice', 'Date and price range', '⛶', 'projection', 2),
  // brushes & shapes
  t('brush', 'Brush', '✎', 'shapes', 'free'),
  t('highlighter', 'Highlighter', '🖍', 'shapes', 'free'),
  t('rect', 'Rectangle', '▭', 'shapes', 2),
  t('rotrect', 'Rotated rectangle', '▱', 'shapes', 3),
  t('circle', 'Circle', '○', 'shapes', 2),
  t('ellipse', 'Ellipse', '◯', 'shapes', 2),
  t('triangleshape', 'Triangle', '△', 'shapes', 3),
  t('polyline', 'Polyline', '⌇', 'shapes', 'poly'),
  t('path', 'Path', '⤴', 'shapes', 'poly'),
  t('curve', 'Curve', '⌒', 'shapes', 3),
  // text & notes
  t('text', 'Text', 'T', 'text', 1, true),
  t('note', 'Note', '🗒', 'text', 1, true),
  t('callout', 'Callout', '💬', 'text', 2, true),
  t('pricelabel', 'Price label', '$', 'text', 1),
  // icons
  t('iconup', 'Arrow up', '▲', 'icons', 1),
  t('icondown', 'Arrow down', '▼', 'icons', 1),
  t('iconcheck', 'Check', '✔', 'icons', 1),
  t('iconcross', 'Cross', '✖', 'icons', 1),
  t('iconstar', 'Star', '★', 'icons', 1),
  t('iconflag', 'Flag', '⚑', 'icons', 1),
] as const;

export type DrawingType = (typeof TOOL_DEFS)[number]['id'];

const BY_ID = new Map<string, ToolDef>(TOOL_DEFS.map((d) => [d.id, d]));
export const toolDef = (id: string): ToolDef | undefined => BY_ID.get(id);
export const isDrawingType = (id: unknown): id is DrawingType => typeof id === 'string' && BY_ID.has(id);
export const toolsInGroup = (g: ToolGroup): ToolDef[] => TOOL_DEFS.filter((d) => d.group === g);
