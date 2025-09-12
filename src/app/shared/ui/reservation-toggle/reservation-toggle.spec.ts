import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReservationToggle } from './reservation-toggle';

describe('ReservationToggle', () => {
  let component: ReservationToggle;
  let fixture: ComponentFixture<ReservationToggle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationToggle]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReservationToggle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
