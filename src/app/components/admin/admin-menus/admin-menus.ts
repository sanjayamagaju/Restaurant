import {Component, inject} from '@angular/core';
import {CURRENCY} from '../../../utils/constants';
import {DatePipe} from '@angular/common';
import {RestaurantService} from '../../../services/restaurant.service';
import {FormsModule} from '@angular/forms';


@Component({
  selector: 'app-admin-menus',
  imports: [
    FormsModule
  ],
  templateUrl: './admin-menus.html',
  styleUrl: './admin-menus.css',
})
export class AdminMenus {
  restaurantService = inject(RestaurantService);

  newItem = {
    name: '',
    price: 0,
    description: '',
    isSpecial: false,
    imageUrl: '',
  };


  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.newItem.imageUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  addMenuItem() {
    if (this.newItem.name && this.newItem.price > 0) {
      this.restaurantService.addMenuItem(this.newItem);
      // Reset form
      this.newItem = {
        name: '',
        price: 0,
        description: '',
        isSpecial: false,
        imageUrl: '',
      };
    }
  }




  protected readonly CURRENCY = CURRENCY;
}
