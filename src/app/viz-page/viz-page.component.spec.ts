import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VizPageComponent } from './viz-page.component';

describe('VizPageComponent', () => {
  let component: VizPageComponent;
  let fixture: ComponentFixture<VizPageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [VizPageComponent]
    });
    fixture = TestBed.createComponent(VizPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
