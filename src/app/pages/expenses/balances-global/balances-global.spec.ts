import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalancesGlobal } from './balances-global';

describe('BalancesGlobal', () => {
  let component: BalancesGlobal;
  let fixture: ComponentFixture<BalancesGlobal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalancesGlobal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BalancesGlobal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
