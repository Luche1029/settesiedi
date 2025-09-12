import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalsReview } from './proposals-review';

describe('ProposalsReview', () => {
  let component: ProposalsReview;
  let fixture: ComponentFixture<ProposalsReview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalsReview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProposalsReview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
