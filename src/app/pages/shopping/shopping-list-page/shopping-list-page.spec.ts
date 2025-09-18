import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShoppingListPage } from './shopping-list-page';

describe('ShoppingListPage', () => {
  let component: ShoppingListPage;
  let fixture: ComponentFixture<ShoppingListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShoppingListPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShoppingListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
