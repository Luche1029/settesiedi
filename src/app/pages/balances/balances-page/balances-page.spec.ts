import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalancesPage } from './balances-page';

describe('BalancesPage', () => {
  let component: BalancesPage;
  let fixture: ComponentFixture<BalancesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalancesPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BalancesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
