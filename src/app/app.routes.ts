import { Routes } from '@angular/router';
import {Admin} from './layouts/admin/admin';
import {Customer} from './layouts/customer/customer';
import {AdminOrders} from './components/admin/admin-orders/admin-orders';
import {AdminMenus} from './components/admin/admin-menus/admin-menus';

export const routes: Routes = [
  {
    path: '',
    component: Customer,
    children: []
  },
  {
    path: 'admin',
    component: Admin,
    children: [
      {
        path: '',
        redirectTo: 'orders',
        pathMatch: 'full',
      },
      {
        path: 'orders',
        component: AdminOrders,
        canActivate: [],
      },
      {
        path: 'menus',
        component: AdminMenus,
        canActivate: [],
      },
    ]
  },
  {
    path: '**', redirectTo: ''
  },
];
