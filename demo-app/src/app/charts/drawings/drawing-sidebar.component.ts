import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { Tool } from './drawing-controller';
import { TOOL_GROUPS, ToolDef, ToolGroup, toolDef, toolsInGroup } from './drawing-tools';

/**
 * TradingView-style left sidebar: the cursor, one button per tool GROUP (it shows
 * the group's current tool; the chevron opens a flyout with every tool of the
 * group), measure and zoom, then magnet / stay-in-drawing / lock / hide / delete-all.
 */
@Component({
  selector: 'app-drawing-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="draw-tools" role="group" aria-label="Drawing tools">
      <button type="button" class="draw-btn" data-tool="cursor" [attr.aria-pressed]="tool() === 'cursor'"
        aria-label="Cursor: select / move drawings, pan the chart" title="Cursor: select / move drawings, pan the chart" (click)="choose('cursor')">↖</button>
      <span class="draw-sep" aria-hidden="true"></span>
      @for (g of groups; track g.id) {
        <div class="grp">
          <button type="button" class="draw-btn" [attr.data-group]="g.id" [attr.data-tool]="current(g.id).id" [attr.aria-pressed]="groupOf(tool()) === g.id"
            [attr.aria-label]="current(g.id).label" [title]="g.label + ': ' + current(g.id).label" (click)="choose(current(g.id).id)">{{ current(g.id).icon }}</button>
          <button type="button" class="chev" [attr.data-flyout]="g.id" [attr.aria-expanded]="open() === g.id" [attr.aria-label]="'All ' + g.label + ' tools'"
            (click)="toggleFlyout(g.id)">›</button>
        </div>
      }
      <span class="draw-sep" aria-hidden="true"></span>
      <button type="button" class="draw-btn" data-tool="measure" [attr.aria-pressed]="tool() === 'measure'"
        aria-label="Measure: drag to read price change, bars and time" title="Measure: drag to read price change, bars and time" (click)="choose('measure')">⇔</button>
      <button type="button" class="draw-btn" data-tool="zoom" [attr.aria-pressed]="tool() === 'zoom'"
        aria-label="Zoom: drag a region to zoom into it" title="Zoom: drag a region to zoom into it" (click)="choose('zoom')">⌕</button>
      <span class="draw-sep" aria-hidden="true"></span>
      <button type="button" class="draw-btn" data-magnet [attr.aria-pressed]="magnet()" aria-label="Magnet: snap the crosshair and new drawings to the bar's OHLC"
        title="Magnet: snap the crosshair and new drawings to the bar's OHLC" (click)="magnetToggle.emit()">🧲</button>
      <button type="button" class="draw-btn" data-keep [attr.aria-pressed]="keep()" aria-label="Stay in drawing mode"
        title="Stay in drawing mode after each drawing" (click)="keepToggle.emit()">⟳</button>
      <button type="button" class="draw-btn" data-lock [attr.aria-pressed]="locked()" aria-label="Lock all drawings"
        title="Lock all drawings (no selecting, moving or deleting)" (click)="lockToggle.emit()">🔒</button>
      <button type="button" class="draw-btn" data-hide [attr.aria-pressed]="hidden()" aria-label="Hide all drawings"
        title="Hide all drawings" (click)="hideToggle.emit()">👁</button>
      <button type="button" class="draw-btn" data-tool-clear aria-label="Delete all drawings on this symbol"
        title="Delete all drawings on this symbol" (click)="clear.emit()">⌫</button>
    </div>
    @if (open(); as g) {
      <div class="flyout" role="menu" [attr.data-flyout-menu]="g" [style.top.px]="flyoutTop()">
        <div class="flyout-title">{{ groupLabel(g) }}</div>
        @for (t of toolsOf(g); track t.id) {
          <button type="button" role="menuitem" class="fly-item" [attr.data-flyout-tool]="t.id" [attr.aria-current]="tool() === t.id" (click)="choose(t.id)">
            <span class="fly-icon" aria-hidden="true">{{ t.icon }}</span>{{ t.label }}
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { position: absolute; left: 4px; top: 50%; transform: translateY(-50%); z-index: 4; }
      .draw-tools {
        display: flex; flex-direction: column; gap: 2px; padding: 2px;
        background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius);
      }
      .grp { position: relative; display: flex; }
      .draw-btn {
        width: 28px; height: 28px; padding: 0; border: none; border-radius: var(--border-radius-sm);
        background: transparent; color: var(--c-text); cursor: pointer; font-size: 0.95rem; line-height: 1;
      }
      .draw-btn:hover { background: var(--c-primary-tint); color: var(--c-primary); }
      .draw-btn[aria-pressed='true'] { background: var(--c-primary); color: var(--c-on-primary); }
      .chev { width: 10px; padding: 0; border: none; background: transparent; color: var(--c-text-muted); cursor: pointer; font-size: 0.8rem; }
      .chev:hover, .chev[aria-expanded='true'] { color: var(--c-primary); }
      .draw-sep { height: 1px; margin: 2px 4px; background: var(--c-border); }
      .flyout {
        position: absolute; left: 100%; margin-left: 6px; min-width: 230px; max-height: 70vh; overflow: auto; padding: 4px;
        background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low);
      }
      .flyout-title { padding: 4px 8px; font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--c-text-muted); }
      .fly-item {
        display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 4px 8px; border: none; border-radius: var(--border-radius-sm);
        background: transparent; color: var(--c-text); cursor: pointer; font-size: 0.8125rem; text-align: left;
      }
      .fly-item:hover { background: var(--c-primary-tint); color: var(--c-primary); }
      .fly-item[aria-current='true'] { font-weight: 600; color: var(--c-primary); }
      .fly-icon { width: 1.6rem; text-align: center; }
    `,
  ],
})
export class DrawingSidebarComponent {
  readonly tool = input.required<Tool>();
  readonly magnet = input(false);
  readonly keep = input(false);
  readonly locked = input(false);
  readonly hidden = input(false);
  readonly pick = output<Tool>();
  readonly magnetToggle = output<void>();
  readonly keepToggle = output<void>();
  readonly lockToggle = output<void>();
  readonly hideToggle = output<void>();
  readonly clear = output<void>();

  readonly groups = TOOL_GROUPS;
  readonly open = signal<ToolGroup | null>(null);
  /** The tool each group's button currently stands for (the last one picked from it). */
  private readonly last = signal<Partial<Record<ToolGroup, string>>>({});
  readonly flyoutTop = computed(() => 34 + Math.max(0, TOOL_GROUPS.findIndex((g) => g.id === this.open())) * 30);

  constructor() {
    effect(() => {
      const def = toolDef(this.tool());
      if (def) this.last.update((l) => (l[def.group] === def.id ? l : { ...l, [def.group]: def.id }));
    });
  }

  current(g: ToolGroup): ToolDef { return toolDef(this.last()[g] ?? '') ?? toolsInGroup(g)[0]; }
  groupOf(t: Tool): ToolGroup | null { return toolDef(t)?.group ?? null; }
  toolsOf(g: ToolGroup): ToolDef[] { return toolsInGroup(g); }
  groupLabel(g: ToolGroup): string { return TOOL_GROUPS.find((x) => x.id === g)?.label ?? ''; }
  toggleFlyout(g: ToolGroup): void { this.open.set(this.open() === g ? null : g); }

  choose(t: string): void {
    this.open.set(null);
    this.pick.emit(t as Tool);
  }
}
