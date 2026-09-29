import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FILLED_ICONS, iconPath } from './icons';

/** A drawn (SVG) toolbar icon: strokes follow the text colour, sizes follow `size`. */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" [class.filled]="filled()" aria-hidden="true" focusable="false"><path [attr.d]="d()" /></svg>`,
  styles: [
    `
      :host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; pointer-events: none; }
      svg { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      svg.filled { fill: currentColor; }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly d = computed(() => iconPath(this.name()));
  readonly filled = computed(() => FILLED_ICONS.has(this.name()));
}
