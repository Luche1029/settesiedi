import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventsAdmin } from './events-admin';

describe('EventsAdmin', () => {
  let component: EventsAdmin;
  let fixture: ComponentFixture<EventsAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsAdmin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventsAdmin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
