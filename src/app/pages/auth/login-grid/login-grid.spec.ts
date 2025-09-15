import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginGrid } from './login-grid';

describe('LoginGrid', () => {
  let component: LoginGrid;
  let fixture: ComponentFixture<LoginGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginGrid]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
