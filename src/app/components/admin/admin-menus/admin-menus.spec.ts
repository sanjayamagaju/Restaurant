import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AdminMenus } from './admin-menus';

describe('AdminMenus', () => {
  let component: AdminMenus;
  let fixture: ComponentFixture<AdminMenus>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminMenus, HttpClientTestingModule]
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(AdminMenus);
    component = fixture.componentInstance;

    httpMock.expectOne(req => req.url.endsWith('/menu-items/')).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
