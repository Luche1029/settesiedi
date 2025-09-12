import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventItems } from './event-items';

describe('EventItems', () => {
  let component: EventItems;
  let fixture: ComponentFixture<EventItems>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventItems]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventItems);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
