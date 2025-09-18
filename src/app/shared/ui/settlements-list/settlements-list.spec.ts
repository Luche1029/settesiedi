import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettlementsList } from './settlements-list';

describe('SettlementsList', () => {
  let component: SettlementsList;
  let fixture: ComponentFixture<SettlementsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettlementsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettlementsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
