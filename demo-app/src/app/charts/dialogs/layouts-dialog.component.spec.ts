import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LayoutService } from '../../core/services/layout.service';
import { LayoutsDialogComponent } from './layouts-dialog.component';

describe('LayoutsDialogComponent (11.17)', () => {
  let fixture: ComponentFixture<LayoutsDialogComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector(s) as T;
  const state: any = { symbol: 'msft' };

  beforeEach(() => {
    localStorage.clear();
    TestBed.inject(LayoutService).save('Main', state, {});
    TestBed.inject(LayoutService).save('Tech', state, {});
    fixture = TestBed.createComponent(LayoutsDialogComponent);
    fixture.detectChanges();
  });

  it('lists the layouts; Load / Delete emit the name', () => {
    expect(Array.from(el().querySelectorAll('[data-layout-row]')).map((r) => r.textContent)).toEqual([expect.stringContaining('Main'), expect.stringContaining('Tech')]);
    const log: string[] = [];
    fixture.componentInstance.load.subscribe((n) => log.push(`load:${n}`));
    fixture.componentInstance.remove.subscribe((n) => log.push(`rm:${n}`));
    el().querySelectorAll<HTMLButtonElement>('[data-layout-load]')[1].click();
    el().querySelectorAll<HTMLButtonElement>('[data-layout-delete]')[0].click();
    expect(log).toEqual(['load:Tech', 'rm:Main']);
  });

  it('Save needs a name; emits it (a clicked layout name fills the box so it can be overwritten)', () => {
    expect(q<HTMLButtonElement>('[data-layout-save]').disabled).toBe(true);
    const saved: string[] = [];
    fixture.componentInstance.save.subscribe((n) => saved.push(n));
    const i = q<HTMLInputElement>('[data-layout-name]');
    i.value = 'New one'; i.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-layout-save]').click();
    expect(saved).toEqual(['New one']);
  });
});
