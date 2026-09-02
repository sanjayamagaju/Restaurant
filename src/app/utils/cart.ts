import { SelectedOption } from '../models/types';

/** A deterministic identity for a cart line: same menu item + same chosen
 *  options + same note collapses into one line (quantity bumps); anything
 *  different becomes a separate line, even for the same dish. */
export function cartLineKey(menuItemId: string, selectedOptions: SelectedOption[], specialInstructions: string): string {
  const optionsKey = selectedOptions
    .map(o => o.optionId)
    .sort((a, b) => a.localeCompare(b))
    .join(',');
  return `${menuItemId}|${optionsKey}|${specialInstructions.trim()}`;
}
