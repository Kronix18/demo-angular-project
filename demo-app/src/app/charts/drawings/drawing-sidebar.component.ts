import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { Tool } from './drawing-controller';
import { TOOL_GROUPS, ToolDef, ToolGroup, anyToolDef, toolsInGroup } from './drawing-tools';

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
      @for (g of groups; track g.id) {
        <div class="grp">
          <button type="button" class="draw-btn" [attr.data-group]="g.id" [attr.data-tool]="current(g.id).id" [attr.aria-pressed]="groupOf(tool()) === g.id"
            [attr.aria-label]="current(g.id).label" [title]="g.label + ': ' + current(g.id).label" (click)="choose(current(g.id).id)">{{ current(g.id).icon }}</button>
          <button type="button" class="chev" [attr.data-flyout]="g.id" [attr.aria-expanded]="open() === g.id" [attr.aria-label]="'All ' + g.label + ' tools'"
            (click)="toggleFlyout(g.id, $event)">›</button>
        </div>
      }
      <span class="draw-sep" aria-hidden="true"></span>
      <button type="button" class="draw-btn" data-tool="measure" [attr.aria-pressed]="tool() === 'measure'"
        aria-label="Measure (ruler): drag to read price change, bars and time" title="Measure (ruler): drag to read price change, bars and time" (click)="choose('measure')">📏</button>
      <button type="button" class="draw-btn" data-tool="zoom" [attr.aria-pressed]="tool() === 'zoom'"
        aria-label="Zoom in: drag a region to zoom into it" title="Zoom in: drag a region to zoom into it" (click)="choose('zoom')">🔍</button>
      <span class="draw-sep" aria-hidden="true"></span>
      <button type="button" class="draw-btn" data-magnet [attr.aria-pressed]="magnet()" aria-label="Magnet: snap the crosshair and new drawings to the bar's OHLC"
        title="Magnet: snap the crosshair and new drawings to the bar's OHLC" (click)="magnetToggle.emit()">🧲</button>
      <button type="button" class="draw-btn" data-keep [attr.aria-pressed]="keep()" aria-label="Stay in drawing mode"
        title="Stay in drawing mode after each drawing" (click)="keepToggle.emit()">⟳</button>
      <button type="button" class="draw-btn" data-lock [attr.aria-pressed]="locked()" aria-label="Lock all drawings"
        title="Lock all drawings (no selecting, moving or deleting)" (click)="lockToggle.emit()">🔒</button>
      <button type="button" class="draw-btn" data-hide [attr.aria-pressed]="hidden()" aria-label="Hide all drawings"
        title="Hide all drawings" (click)="hideToggle.emit()">👁</button>
      <div class="grp">
        <button type="button" class="draw-btn" data-tool-clear aria-label="Delete all drawings on this symbol"
          title="Delete all drawings on this symbol" (click)="clear.emit()">🗑</button>
        <button type="button" class="chev" data-flyout="remove" [attr.aria-expanded]="open() === 'remove'" aria-label="More remove options"
          (click)="toggleFlyout('remove', $event)">›</button>
      </div>
    </div>
    @if (open() === 'remove') {
      <div class="flyout" role="menu" data-flyout-menu="remove" [style.top.px]="flyoutPos().top" [style.left.px]="flyoutPos().left">
        <div class="flyout-title">Remove</div>
        <button type="button" role="menuitem" class="fly-item" data-remove="drawings" (click)="remove('drawings')">Remove drawings</button>
        <button type="button" role="menuitem" class="fly-item" data-remove="indicators" (click)="remove('indicators')">Remove indicators</button>
        <button type="button" role="menuitem" class="fly-item" data-remove="all" (click)="remove('all')">Remove drawings &amp; indicators</button>
      </div>
    } @else if (open(); as g) {
      <div class="flyout" role="menu" [attr.data-flyout-menu]="g" [style.top.px]="flyoutPos().top" [style.left.px]="flyoutPos().left">
        <div class="flyout-title">{{ groupLabel(g) }}</div>
        @if (g === 'icons') {
          <div class="emoji-grid" data-emoji-grid>
            @for (e of emojis; track e) { <button type="button" class="emoji" [attr.data-emoji]="e" [attr.aria-label]="'Stamp ' + e" (click)="pickEmoji(e)">{{ e }}</button> }
          </div>
        }
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
      :host {
        display: flex; flex: none; flex-direction: column; width: 46px; overflow: hidden auto;
        background: var(--c-surface); border-right: 1px solid var(--c-pane-border);
      }
      .draw-tools { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; }
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
        position: fixed; z-index: 20; min-width: 230px; max-height: 70vh; overflow: auto; padding: 4px;
        background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low);
      }
      .flyout-title { padding: 4px 8px; font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--c-text-muted); }
      .fly-item {
        display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 4px 8px; border: none; border-radius: var(--border-radius-sm);
        background: transparent; color: var(--c-text); cursor: pointer; font-size: 0.8125rem; text-align: left;
      }
      .fly-item:hover { background: var(--c-primary-tint); color: var(--c-primary); }
      .fly-item[aria-current='true'] { font-weight: 600; color: var(--c-primary); }
      .emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 2px 4px 6px; }
      .emoji { padding: 2px; border: none; border-radius: var(--border-radius-sm); background: transparent; cursor: pointer; font-size: 1.1rem; }
      .emoji:hover { background: var(--c-primary-tint); }
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
  readonly removeIndicators = output<void>();
  readonly removeAll = output<void>();
  readonly emojiPick = output<string>();
  readonly emojis = ['😀', '😂', '😍', '🤔', '😎', '😱', '😡', '😭', '👍', '👎', '👏', '🙏', '💪', '🤝', '👀', '🧠', '❤', '💔', '🔥', '⭐', '✨', '💡', '🚀', '🎯', '🏆', '💰', '💵', '📈', '📉', '📊', '🐂', '🐻', '🦄', '🐳', '🦈', '🚩', '⚠', '⛔', '✅', '❌', '❓', '❗', '💎', '🕐', '📌', '🔔', '🎉', '🌙', '☀'];

  readonly groups = TOOL_GROUPS;
  readonly open = signal<ToolGroup | 'remove' | null>(null);
  /** The tool each group's button currently stands for (the last one picked from it). */
  private readonly last = signal<Partial<Record<ToolGroup, string>>>({});
  readonly flyoutPos = signal({ top: 0, left: 0 });

  constructor() {
    effect(() => {
      const def = anyToolDef(this.tool());
      if (def) this.last.update((l) => (l[def.group] === def.id ? l : { ...l, [def.group]: def.id }));
    });
  }

  current(g: ToolGroup): ToolDef { return anyToolDef(this.last()[g] ?? '') ?? toolsInGroup(g)[0]; }
  groupOf(t: Tool): ToolGroup | null { return anyToolDef(t)?.group ?? null; }
  toolsOf(g: string): ToolDef[] { return toolsInGroup(g as ToolGroup); }
  groupLabel(g: string): string { return TOOL_GROUPS.find((x) => x.id === g)?.label ?? ''; }
  toggleFlyout(g: ToolGroup | 'remove', e?: Event): void {
    if (this.open() === g) { this.open.set(null); return; }
    const r = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
    if (r) this.flyoutPos.set({ top: Math.max(4, Math.min(r.top - 4, window.innerHeight - 320)), left: r.right + 6 });
    this.open.set(g);
  }

  pickEmoji(e: string): void {
    this.open.set(null);
    this.emojiPick.emit(e);
  }

  remove(what: 'drawings' | 'indicators' | 'all'): void {
    this.open.set(null);
    if (what === 'drawings') this.clear.emit();
    else if (what === 'indicators') this.removeIndicators.emit();
    else this.removeAll.emit();
  }

  choose(t: string): void {
    this.open.set(null);
    this.pick.emit(t as Tool);
  }
}
