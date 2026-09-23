import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartViewerComponent } from './chart-viewer.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ChartViewerComponent', () => {
  let component: ChartViewerComponent;
  let fixture: ComponentFixture<ChartViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartViewerComponent, FormsModule],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: (key: string) => { return key === 'symbol' ? 'AAPL' : null; } }) } }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartViewerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should contain toolbar elements in the template', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // Check for the toolbar container
    expect(compiled.querySelector('.toolbar')).toBeTruthy();
    // Check for the symbol input
    expect(compiled.querySelector('input[id=\"symbol\"]')).toBeTruthy();
    // Check for the interval select
    expect(compiled.querySelector('select[id=\"interval\"]')).toBeTruthy();
    // Check for the update button
    expect(compiled.querySelector('button')).toBeTruthy();
  });
});