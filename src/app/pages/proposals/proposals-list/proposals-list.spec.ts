import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalsList } from './proposals-list';

describe('ProposalsList', () => {
  let component: ProposalsList;
  let fixture: ComponentFixture<ProposalsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProposalsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
