import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShoppingAddForm } from './shopping-add-form';

describe('ShoppingAddForm', () => {
  let component: ShoppingAddForm;
  let fixture: ComponentFixture<ShoppingAddForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShoppingAddForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShoppingAddForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
