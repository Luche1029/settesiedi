import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpensesHome } from './expenses-home';

describe('ExpensesHome', () => {
  let component: ExpensesHome;
  let fixture: ComponentFixture<ExpensesHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpensesHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
