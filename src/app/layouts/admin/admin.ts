import {Component} from '@angular/core';
import {DatePipe, NgClass} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';


interface NavItem {
  key: string;
  name: string;
  icon: string;
  route: string;
}


@Component({
  selector: 'app-admin',
  imports: [
    FormsModule,
    RouterLink,
    RouterOutlet,
    RouterLinkActive,
    NgClass
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
navItems = [
    {
      key: 'orders',
      name: 'Orders',
      icon: '',
      route: 'orders',
    },
    {
      key: 'menus',
      name: 'Menus',
      icon: '',
      route: 'menus',
    },
  ]

  trackByKey(index: number) {
    return index;
  }

}
