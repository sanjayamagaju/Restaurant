import { Routes } from '@angular/router';
import { Admin } from './components/admin/admin';
import { User } from './components/user/user';

export const routes: Routes = [
  { path: '', component: User },
  { path: 'admin', component: Admin },
  { path: '**', redirectTo: '' },
];
