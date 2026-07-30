import { Routes } from '@angular/router';
import { User } from './components/user/user';
import {Admin} from './layouts/admin/admin';
import {AdminOrders} from './components/admin-orders/admin-orders';
import {AdminDashboard} from './components/admin-dashboard/admin-dashboard';

export const routes: Routes = [
  {
    path: '', component: User
  },
  {
    path: 'admin',
    component: Admin,
    children: [
      {
        path: 'orders-placed',
        component: AdminOrders,
        canActivate: [],
      },
      {
        path: 'orders-completed',
        component: AdminOrders,
        canActivate: [],
      },
      {
        path: 'menu',
        component: AdminDashboard,
        canActivate: [],
      },
    ]
  },
  {
    path: '**', redirectTo: ''
  },
];
