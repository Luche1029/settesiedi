import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpensesList } from './expenses-list';

describe('ExpensesList', () => {
  let component: ExpensesList;
  let fixture: ComponentFixture<ExpensesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpensesList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpensesList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
