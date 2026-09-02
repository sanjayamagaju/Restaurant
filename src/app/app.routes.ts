import { Routes } from '@angular/router';
import {Admin} from './layouts/admin/admin';
import {Customer} from './layouts/customer/customer';
import {Kitchen} from './layouts/kitchen/kitchen';
import {AdminOrders} from './components/admin/admin-orders/admin-orders';
import {AdminMenus} from './components/admin/admin-menus/admin-menus';
import {AdminTables} from './components/admin/admin-tables/admin-tables';
import {AdminLogin} from './components/admin-login/admin-login';
import {authGuard} from './services/auth.guard';
import {kitchenGuard} from './services/kitchen.guard';

export const routes: Routes = [
  {
    path: '',
    component: Customer,
    children: []
  },
  {
    path: 'admin-login',
    component: AdminLogin,
  },
  {
    // Sibling of the 'admin' route (not a child of the Admin component) so it
    // renders full-screen, without the admin sidebar/dashboard chrome - the
    // kitchen display is meant to be distraction-free on its own tablet/monitor.
    path: 'admin/kitchen',
    component: Kitchen,
    canActivate: [kitchenGuard],
  },
  {
    path: 'admin',
    component: Admin,
    canActivate: [authGuard],
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
      {
        path: 'tables',
        component: AdminTables,
        canActivate: [],
      },
    ]
  },
  {
    path: '**', redirectTo: ''
  },
];
