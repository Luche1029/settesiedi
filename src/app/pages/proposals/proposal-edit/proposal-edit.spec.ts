import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalEdit } from './proposal-edit';

describe('ProposalEdit', () => {
  let component: ProposalEdit;
  let fixture: ComponentFixture<ProposalEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProposalEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
