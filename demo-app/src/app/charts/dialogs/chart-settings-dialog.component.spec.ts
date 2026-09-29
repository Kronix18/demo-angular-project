import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartSettingsDialogComponent } from './chart-settings-dialog.component';

describe('ChartSettingsDialogComponent (11.11)', () => {
  let fixture: ComponentFixture<ChartSettingsDialogComponent>;
  const q = <T extends HTMLElement>(s: string) => (fixture.nativeElement as HTMLElement).querySelector(s) as T;
  let saved: any[]; let closed: number;
  const open = (view: any) => {
    fixture = TestBed.createComponent(ChartSettingsDialogComponent);
    fixture.componentRef.setInput('view', view);
    saved = []; closed = 0;
    fixture.componentInstance.save.subscribe((v) => saved.push(v));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.detectChanges();
  };
  const ALL = { gridH: true, gridV: true, crosshair: true, lastPrice: true, ohlc: true };

  it('has a checkbox per option, checked as configured; OK emits the edited set', () => {
    open({ ...ALL, gridV: false });
    for (const k of ['gridH', 'gridV', 'crosshair', 'lastPrice', 'ohlc']) expect(q(`[data-view="${k}"]`), k).toBeTruthy();
    expect(q<HTMLInputElement>('[data-view="gridV"]').checked).toBe(false);
    q<HTMLInputElement>('[data-view="gridH"]').click();
    q<HTMLInputElement>('[data-view="gridV"]').click();
    q<HTMLButtonElement>('[data-ok]').click();
    expect(saved).toEqual([{ ...ALL, gridH: false }]);
    expect(closed).toBe(1);
  });

  it('Reset turns everything back on; Cancel discards', () => {
    open({ gridH: false, gridV: false, crosshair: false, lastPrice: false, ohlc: false });
    q<HTMLButtonElement>('[data-reset]').click();
    fixture.detectChanges();
    expect(q<HTMLInputElement>('[data-view="ohlc"]').checked).toBe(true);
    q<HTMLButtonElement>('[data-cancel]').click();
    expect(saved).toEqual([]);
    expect(closed).toBe(1);
  });
});
