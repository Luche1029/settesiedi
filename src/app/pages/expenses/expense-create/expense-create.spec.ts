import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpenseCreate } from './expense-create';

describe('ExpenseCreate', () => {
  let component: ExpenseCreate;
  let fixture: ComponentFixture<ExpenseCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExpenseCreate);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
