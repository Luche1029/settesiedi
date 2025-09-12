import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyMenus } from './weekly-menus';

describe('WeeklyMenus', () => {
  let component: WeeklyMenus;
  let fixture: ComponentFixture<WeeklyMenus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyMenus]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeeklyMenus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
