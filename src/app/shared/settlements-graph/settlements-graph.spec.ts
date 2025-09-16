import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettlementsGraph } from './settlements-graph';

describe('SettlementsGraph', () => {
  let component: SettlementsGraph;
  let fixture: ComponentFixture<SettlementsGraph>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettlementsGraph]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettlementsGraph);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
