import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem, MenuItemOptionGroup, SelectedOption } from '../../models/types';
import { CURRENCY } from '../../utils/constants';

export interface AddToCartEvent {
  selectedOptions: SelectedOption[];
  quantity: number;
  specialInstructions: string;
}

export interface CartLineSelection {
  selectedOptions: SelectedOption[];
  quantity: number;
  specialInstructions: string;
}

@Component({
  selector: 'app-menu-item-detail',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './menu-item-detail.html',
  styleUrl: './menu-item-detail.css',
  // The modal is appended at the end of customer.html, outside the `.food-theme`
  // wrapper - without these it would fall back to Bootstrap's default light
  // theme instead of matching the rest of the app.
  host: {
    class: 'food-theme',
    'data-bs-theme': 'dark',
  },
})
export class MenuItemDetail implements OnChanges {
  @Input({ required: true }) menuItem!: MenuItem;
  @Input() initialSelection: CartLineSelection | null = null;
  @Output() addToCart = new EventEmitter<AddToCartEvent>();
  @Output() closed = new EventEmitter<void>();

  readonly CURRENCY = CURRENCY;

  quantity = signal(1);
  specialInstructions = signal('');
  selectionsByGroup = signal<Record<string, string[]>>({});
  touchedGroups = signal<Set<string>>(new Set());

  unitPrice = computed(() => {
    const map = this.selectionsByGroup();
    let total = this.menuItem.price;
    for (const group of this.menuItem.optionGroups) {
      for (const optionId of map[group.id] ?? []) {
        const option = group.options.find(o => o.id === optionId);
        if (option) total += option.additionalPrice;
      }
    }
    return total;
  });

  totalPrice = computed(() => this.unitPrice() * this.quantity());

  selectedOptionsList = computed<SelectedOption[]>(() => {
    const map = this.selectionsByGroup();
    const result: SelectedOption[] = [];
    for (const group of this.menuItem.optionGroups) {
      for (const optionId of map[group.id] ?? []) {
        const option = group.options.find(o => o.id === optionId);
        if (option) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            additionalPrice: option.additionalPrice,
          });
        }
      }
    }
    return result;
  });

  get isEditing(): boolean {
    return this.initialSelection !== null;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['menuItem'] || changes['initialSelection']) {
      this.resetForItem();
    }
  }

  private resetForItem() {
    this.quantity.set(this.initialSelection?.quantity ?? 1);
    this.specialInstructions.set(this.initialSelection?.specialInstructions ?? '');

    const map: Record<string, string[]> = {};
    for (const group of this.menuItem.optionGroups ?? []) {
      map[group.id] = [];
    }
    for (const selection of this.initialSelection?.selectedOptions ?? []) {
      map[selection.groupId] = [...(map[selection.groupId] ?? []), selection.optionId];
    }
    this.selectionsByGroup.set(map);
    this.touchedGroups.set(new Set());
  }

  activeGroups(): MenuItemOptionGroup[] {
    return (this.menuItem.optionGroups ?? []).filter(g => g.active);
  }

  activeOptions(group: MenuItemOptionGroup) {
    return group.options.filter(o => o.active);
  }

  isSelected(groupId: string, optionId: string): boolean {
    return (this.selectionsByGroup()[groupId] ?? []).includes(optionId);
  }

  selectionCount(group: MenuItemOptionGroup): number {
    return (this.selectionsByGroup()[group.id] ?? []).length;
  }

  selectSingle(group: MenuItemOptionGroup, optionId: string) {
    this.selectionsByGroup.update(map => ({ ...map, [group.id]: [optionId] }));
    this.markTouched(group.id);
  }

  toggleMulti(group: MenuItemOptionGroup, optionId: string) {
    this.selectionsByGroup.update(map => {
      const current = map[group.id] ?? [];
      const isSel = current.includes(optionId);
      if (!isSel && current.length >= group.maxSelection) return map;
      const next = isSel ? current.filter(id => id !== optionId) : [...current, optionId];
      return { ...map, [group.id]: next };
    });
    this.markTouched(group.id);
  }

  private markTouched(groupId: string) {
    this.touchedGroups.update(set => new Set(set).add(groupId));
  }

  groupError(group: MenuItemOptionGroup): string | null {
    const count = this.selectionCount(group);
    if (group.required && count < 1) return 'Please choose an option.';
    if (count < group.minSelection) return `Please select at least ${group.minSelection} option(s).`;
    if (count > group.maxSelection) return `Please select at most ${group.maxSelection} option(s).`;
    return null;
  }

  showGroupError(group: MenuItemOptionGroup): boolean {
    return this.touchedGroups().has(group.id) && this.groupError(group) !== null;
  }

  incrementQty() {
    this.quantity.update(q => q + 1);
  }

  decrementQty() {
    this.quantity.update(q => Math.max(1, q - 1));
  }

  submit() {
    this.touchedGroups.set(new Set(this.activeGroups().map(g => g.id)));
    const hasError = this.activeGroups().some(g => this.groupError(g) !== null);
    if (hasError || !this.menuItem.available) return;

    this.addToCart.emit({
      selectedOptions: this.selectedOptionsList(),
      quantity: this.quantity(),
      specialInstructions: this.specialInstructions().trim(),
    });
  }
}
