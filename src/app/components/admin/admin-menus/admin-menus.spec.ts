import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMenus } from './admin-menus';

describe('AdminMenus', () => {
  let component: AdminMenus;
  let fixture: ComponentFixture<AdminMenus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMenus]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminMenus);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
