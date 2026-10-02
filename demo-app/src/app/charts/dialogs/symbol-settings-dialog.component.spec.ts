import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SymbolSettingsDialogComponent } from './symbol-settings-dialog.component';

describe('SymbolSettingsDialogComponent (11.6)', () => {
  let fixture: ComponentFixture<SymbolSettingsDialogComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector(s) as T;
  const input = (s: string, v: string) => { const i = q<HTMLInputElement>(s); i.value = v; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };
  const change = (s: string, v: string) => { const i = q<HTMLSelectElement>(s); i.value = v; i.dispatchEvent(new Event('change')); fixture.detectChanges(); };
  let saved: any[];
  let closed: number;

  function open(kind: 'price' | 'volume', settings: any = {}, lineLike = false) {
    fixture = TestBed.createComponent(SymbolSettingsDialogComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('settings', settings);
    fixture.componentRef.setInput('lineLike', lineLike);
    saved = []; closed = 0;
    fixture.componentInstance.save.subscribe((s) => saved.push(s));
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.detectChanges();
  }

  it('price: up / down colour, previous-close checkbox and width; source + line colour only for line styles', () => {
    open('price');
    expect(q('h2').textContent).toContain('Symbol');
    for (const k of ['up', 'down', 'prev', 'width']) expect(q(`[data-set="${k}"]`), k).toBeTruthy();
    expect(q('[data-set="source"]')).toBeNull();
    expect(q('[data-set="line"]')).toBeNull();
    open('price', {}, true);
    expect(q('[data-set="source"]')).toBeTruthy();
    expect(q('[data-set="line"]')).toBeTruthy();
    expect(q('[data-set="up"]')).toBeNull(); // no up/down colours on a plain line
  });

  it('OK emits exactly what was edited', () => {
    open('price', { up: '#00ff00' });
    input('[data-set="down"]', '#ff0000');
    (q('[data-set="prev"]') as HTMLInputElement).click();
    change('[data-set="width"]', '3');
    q<HTMLButtonElement>('[data-ok]').click();
    expect(saved).toEqual([{ up: '#00ff00', down: '#ff0000', byPrevClose: true, width: 3 }]);
    expect(closed).toBe(1);
  });

  it('line styles: source and line colour', () => {
    open('price', {}, true);
    change('[data-set="source"]', 'hlc3');
    input('[data-set="line"]', '#abcdef');
    q<HTMLButtonElement>('[data-ok]').click();
    expect(saved).toEqual([{ source: 'hlc3', line: '#abcdef' }]);
  });

  it('volume: colours + previous-close only; Reset clears; Cancel and Esc discard', () => {
    open('volume', { up: '#00ff00' });
    expect(q('h2').textContent).toContain('Volume');
    expect(q('[data-set="width"]')).toBeNull();
    (q('[data-set="prev"]') as HTMLInputElement).click();
    q<HTMLButtonElement>('[data-reset]').click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-ok]').click();
    expect(saved).toEqual([{}]);
    open('volume');
    q<HTMLButtonElement>('[data-cancel]').click();
    expect(saved).toEqual([]);
    expect(closed).toBe(1);
  });

  it('hidden state survives an edit (only the eye changes it)', () => {
    open('price', { hidden: true, up: '#00ff00' });
    input('[data-set="up"]', '#111111');
    q<HTMLButtonElement>('[data-ok]').click();
    expect(saved).toEqual([{ hidden: true, up: '#111111' }]);
  });
});
