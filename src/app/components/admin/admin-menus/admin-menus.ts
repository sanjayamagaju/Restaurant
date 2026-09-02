import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {NgClass} from '@angular/common';
import {CURRENCY} from '../../../utils/constants';
import {RestaurantService} from '../../../services/restaurant.service';
import {FormsModule} from '@angular/forms';
import {MenuCategory, MenuItem, MenuItemOption, MenuItemOptionGroup} from '../../../models/types';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

type AvailabilityFilter = 'all' | 'available' | 'soldout';
type SpecialFilter = 'all' | 'special' | 'regular';
type SortBy = 'displayOrder' | 'name' | 'price';

interface MenuItemFormModel {
  name: string;
  price: number;
  description: string;
  isSpecial: boolean;
  imageUrl: string;
  category: string;
  available: boolean;
  preparationTime: number | null;
  displayOrder: number;
}

interface CategoryFormModel {
  id?: string;
  name: string;
  description: string;
  displayOrder: number;
  active: boolean;
}

interface OptionGroupFormModel {
  id?: string;
  name: string;
  required: boolean;
  minSelection: number;
  maxSelection: number;
}

interface OptionFormModel {
  id?: string;
  groupId: string;
  name: string;
  additionalPrice: number;
}

function blankItemForm(): MenuItemFormModel {
  return {
    name: '', price: 0, description: '', isSpecial: false, imageUrl: '',
    category: '', available: true, preparationTime: null, displayOrder: 0,
  };
}

@Component({
  selector: 'app-admin-menus',
  imports: [FormsModule, NgClass],
  templateUrl: './admin-menus.html',
  styleUrl: './admin-menus.css',
})
export class AdminMenus implements OnInit {
  restaurantService = inject(RestaurantService);
  protected readonly CURRENCY = CURRENCY;

  activeTab = signal<'items' | 'categories'>('items');

  // --- Items: search / filter / sort ---
  searchQuery = signal('');
  categoryFilter = signal<string>('all');
  availabilityFilter = signal<AvailabilityFilter>('all');
  specialFilter = signal<SpecialFilter>('all');
  sortBy = signal<SortBy>('displayOrder');

  filteredItems = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    let items = this.restaurantService.menuItems();

    if (query) {
      items = items.filter(i =>
        i.name.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query) ||
        (i.categoryName ?? '').toLowerCase().includes(query),
      );
    }
    if (this.categoryFilter() !== 'all') {
      items = items.filter(i => i.category === this.categoryFilter());
    }
    if (this.availabilityFilter() === 'available') items = items.filter(i => i.available);
    if (this.availabilityFilter() === 'soldout') items = items.filter(i => !i.available);
    if (this.specialFilter() === 'special') items = items.filter(i => i.isSpecial);
    if (this.specialFilter() === 'regular') items = items.filter(i => !i.isSpecial);

    const sortBy = this.sortBy();
    return [...items].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return a.price - b.price;
      return a.displayOrder - b.displayOrder || a.name.localeCompare(b.name);
    });
  });

  // --- Item add/edit form ---
  showItemForm = signal(false);
  editingItemId = signal<string | null>(null);
  itemForm = signal<MenuItemFormModel>(blankItemForm());
  itemFormError = signal<string | null>(null);
  savingItem = signal(false);
  imageError = signal<string | null>(null);

  editingItem = computed(() => this.restaurantService.menuItems().find(i => i.id === this.editingItemId()) ?? null);

  // Angular templates can't contain arrow-function expressions, so every form
  // field's (ngModelChange) calls one of these typed setters instead of
  // inlining `.update(f => ({...f, x: $event}))`.
  setItemField<K extends keyof MenuItemFormModel>(key: K, value: MenuItemFormModel[K]) {
    this.itemForm.update(f => ({...f, [key]: value}));
  }

  setCategoryField<K extends keyof CategoryFormModel>(key: K, value: CategoryFormModel[K]) {
    this.categoryForm.update(f => (f ? {...f, [key]: value} : f));
  }

  setGroupField<K extends keyof OptionGroupFormModel>(key: K, value: OptionGroupFormModel[K]) {
    this.optionGroupForm.update(f => (f ? {...f, [key]: value} : f));
  }

  setOptionField<K extends keyof OptionFormModel>(key: K, value: OptionFormModel[K]) {
    this.optionForm.update(f => (f ? {...f, [key]: value} : f));
  }

  ngOnInit() {
    this.restaurantService.loadMenuItems();
    this.restaurantService.loadCategories();
  }

  // --- Item CRUD ---
  startCreateItem() {
    this.editingItemId.set(null);
    this.itemForm.set(blankItemForm());
    this.itemFormError.set(null);
    this.imageError.set(null);
    this.showItemForm.set(true);
  }

  startEditItem(item: MenuItem) {
    this.editingItemId.set(item.id);
    this.itemForm.set({
      name: item.name,
      price: item.price,
      description: item.description,
      isSpecial: item.isSpecial,
      imageUrl: item.imageUrl ?? '',
      category: item.category ?? '',
      available: item.available,
      preparationTime: item.preparationTime ?? null,
      displayOrder: item.displayOrder,
    });
    this.itemFormError.set(null);
    this.imageError.set(null);
    this.showItemForm.set(true);
  }

  cancelItemForm() {
    this.showItemForm.set(false);
    this.editingItemId.set(null);
    this.itemFormError.set(null);
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.imageError.set('Please choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set('Image is too large - please choose one under 2MB.');
      return;
    }
    this.imageError.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      this.itemForm.update(f => ({...f, imageUrl: reader.result as string}));
    };
    reader.readAsDataURL(file);
  }

  submitItemForm() {
    const form = this.itemForm();
    if (!form.name.trim()) {
      this.itemFormError.set('Name is required.');
      return;
    }
    if (form.price < 0) {
      this.itemFormError.set('Price cannot be negative.');
      return;
    }
    if (form.preparationTime !== null && form.preparationTime < 0) {
      this.itemFormError.set('Preparation time cannot be negative.');
      return;
    }
    if (form.displayOrder < 0) {
      this.itemFormError.set('Display order cannot be negative.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      price: form.price,
      description: form.description,
      isSpecial: form.isSpecial,
      imageUrl: form.imageUrl,
      category: form.category || null,
      available: form.available,
      preparationTime: form.preparationTime,
      displayOrder: form.displayOrder,
    };

    this.savingItem.set(true);
    const editingId = this.editingItemId();
    const request = editingId
      ? this.restaurantService.updateMenuItem(editingId, payload)
      : this.restaurantService.createMenuItem(payload);

    request.subscribe({
      next: () => {
        this.savingItem.set(false);
        this.cancelItemForm();
      },
      error: (err) => {
        this.savingItem.set(false);
        this.itemFormError.set(this.extractError(err, 'Could not save this item.'));
      },
    });
  }

  toggleAvailability(item: MenuItem) {
    this.restaurantService.toggleAvailability(item.id).subscribe();
  }

  toggleSpecial(item: MenuItem) {
    this.restaurantService.updateMenuItem(item.id, {isSpecial: !item.isSpecial}).subscribe();
  }

  deleteItem(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    this.restaurantService.deleteMenuItem(item.id).subscribe({
      error: () => alert('Could not delete this item.'),
    });
    if (this.editingItemId() === item.id) this.cancelItemForm();
  }

  // --- Option group management (nested inside the item edit form) ---
  optionGroupForm = signal<OptionGroupFormModel | null>(null);
  groupFormError = signal<string | null>(null);
  optionForm = signal<OptionFormModel | null>(null);
  optionFormError = signal<string | null>(null);

  startAddGroup() {
    this.optionGroupForm.set({name: '', required: false, minSelection: 0, maxSelection: 1});
    this.groupFormError.set(null);
  }

  startEditGroup(group: MenuItemOptionGroup) {
    this.optionGroupForm.set({
      id: group.id, name: group.name, required: group.required,
      minSelection: group.minSelection, maxSelection: group.maxSelection,
    });
    this.groupFormError.set(null);
  }

  cancelGroupForm() {
    this.optionGroupForm.set(null);
    this.groupFormError.set(null);
  }

  saveGroup() {
    const item = this.editingItem();
    const form = this.optionGroupForm();
    if (!item || !form) return;

    if (!form.name.trim()) {
      this.groupFormError.set('Name is required.');
      return;
    }
    if (form.maxSelection < 1) {
      this.groupFormError.set('Maximum selection must be at least 1.');
      return;
    }
    if (form.maxSelection < form.minSelection) {
      this.groupFormError.set('Maximum selection cannot be less than minimum selection.');
      return;
    }
    if (form.required && form.minSelection < 1) {
      this.groupFormError.set('A required group must require at least 1 selection.');
      return;
    }

    const payload = {
      name: form.name.trim(), required: form.required,
      minSelection: form.minSelection, maxSelection: form.maxSelection,
    };
    const request = form.id
      ? this.restaurantService.updateOptionGroup(form.id, item.id, payload)
      : this.restaurantService.createOptionGroup({menuItemId: item.id, ...payload});

    request.subscribe({
      next: () => this.cancelGroupForm(),
      error: (err) => this.groupFormError.set(this.extractError(err, 'Could not save this option group.')),
    });
  }

  toggleGroupActive(group: MenuItemOptionGroup) {
    const item = this.editingItem();
    if (!item) return;
    this.restaurantService.updateOptionGroup(group.id, item.id, {active: !group.active}).subscribe();
  }

  deleteGroup(group: MenuItemOptionGroup) {
    const item = this.editingItem();
    if (!item) return;
    if (!confirm(`Delete option group "${group.name}"? This also removes its options.`)) return;
    this.restaurantService.deleteOptionGroup(group.id, item.id).subscribe();
  }

  startAddOption(group: MenuItemOptionGroup) {
    this.optionForm.set({groupId: group.id, name: '', additionalPrice: 0});
    this.optionFormError.set(null);
  }

  startEditOption(group: MenuItemOptionGroup, option: MenuItemOption) {
    this.optionForm.set({id: option.id, groupId: group.id, name: option.name, additionalPrice: option.additionalPrice});
    this.optionFormError.set(null);
  }

  cancelOptionForm() {
    this.optionForm.set(null);
    this.optionFormError.set(null);
  }

  saveOption() {
    const item = this.editingItem();
    const form = this.optionForm();
    if (!item || !form) return;

    if (!form.name.trim()) {
      this.optionFormError.set('Name is required.');
      return;
    }
    if (form.additionalPrice < 0) {
      this.optionFormError.set('Additional price cannot be negative.');
      return;
    }

    const payload = {name: form.name.trim(), additionalPrice: form.additionalPrice};
    const request = form.id
      ? this.restaurantService.updateOption(form.id, item.id, payload)
      : this.restaurantService.createOption({optionGroupId: form.groupId, ...payload}, item.id);

    request.subscribe({
      next: () => this.cancelOptionForm(),
      error: (err) => this.optionFormError.set(this.extractError(err, 'Could not save this option.')),
    });
  }

  toggleOptionActive(option: MenuItemOption) {
    const item = this.editingItem();
    if (!item) return;
    this.restaurantService.updateOption(option.id, item.id, {active: !option.active}).subscribe();
  }

  deleteOption(option: MenuItemOption) {
    const item = this.editingItem();
    if (!item) return;
    if (!confirm(`Delete option "${option.name}"?`)) return;
    this.restaurantService.deleteOption(option.id, item.id).subscribe();
  }

  // --- Category tab ---
  categoryForm = signal<CategoryFormModel | null>(null);
  categoryFormError = signal<string | null>(null);

  startAddCategory() {
    const maxOrder = this.restaurantService.categories().reduce((max, c) => Math.max(max, c.displayOrder), -1);
    this.categoryForm.set({name: '', description: '', displayOrder: maxOrder + 1, active: true});
    this.categoryFormError.set(null);
  }

  startEditCategory(category: MenuCategory) {
    this.categoryForm.set({
      id: category.id, name: category.name, description: category.description,
      displayOrder: category.displayOrder, active: category.active,
    });
    this.categoryFormError.set(null);
  }

  cancelCategoryForm() {
    this.categoryForm.set(null);
    this.categoryFormError.set(null);
  }

  saveCategory() {
    const form = this.categoryForm();
    if (!form) return;
    if (!form.name.trim()) {
      this.categoryFormError.set('Name is required.');
      return;
    }

    const payload = {name: form.name.trim(), description: form.description, displayOrder: form.displayOrder, active: form.active};
    const request = form.id
      ? this.restaurantService.updateCategory(form.id, payload)
      : this.restaurantService.createCategory(payload);

    request.subscribe({
      next: () => this.cancelCategoryForm(),
      error: (err) => this.categoryFormError.set(this.extractError(err, 'Could not save this category.')),
    });
  }

  toggleCategoryActive(category: MenuCategory) {
    this.restaurantService.updateCategory(category.id, {active: !category.active}).subscribe();
  }

  deleteCategory(category: MenuCategory) {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    this.restaurantService.deleteCategory(category.id).subscribe({
      error: (err) => alert(this.extractError(err, 'Could not delete this category.')),
    });
  }

  private extractError(err: unknown, fallback: string): string {
    const data = (err as { error?: unknown })?.error;
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (Array.isArray(data) && typeof data[0] === 'string') return data[0];
    if (typeof data === 'object') {
      for (const value of Object.values(data as Record<string, unknown>)) {
        if (typeof value === 'string') return value;
        if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      }
    }
    return fallback;
  }
}
