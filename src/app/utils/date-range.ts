import { DateRange, DateRangePreset } from '../models/analytics';

export interface PresetOption {
  key: DateRangePreset;
  label: string;
}

export const DATE_RANGE_PRESETS: PresetOption[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'prev_month', label: 'Previous Month' },
  { key: 'custom', label: 'Custom Range' },
];

/** Local calendar date as YYYY-MM-DD. Deliberately not `toISOString()`, which
 *  would shift the date backwards for anyone east of UTC. */
export function toIsoDate(value: Date): string {
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

/** Resolve a preset to the inclusive calendar dates it covers.
 *
 * These drive the selector UI and are sent to the backend as-is; the backend
 * turns them into the authoritative half-open datetime range in the
 * restaurant's timezone, so both ends stay fully included. */
export function resolvePreset(preset: DateRangePreset, today = new Date()): DateRange {
  const iso = toIsoDate(today);

  switch (preset) {
    case 'today':
      return { preset, from: iso, to: iso };
    case 'yesterday': {
      const yesterday = toIsoDate(addDays(today, -1));
      return { preset, from: yesterday, to: yesterday };
    }
    case 'last7':
      return { preset, from: toIsoDate(addDays(today, -6)), to: iso };
    case 'last30':
      return { preset, from: toIsoDate(addDays(today, -29)), to: iso };
    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { preset, from: toIsoDate(first), to: iso };
    }
    case 'prev_month': {
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      const firstDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1);
      return { preset, from: toIsoDate(firstDay), to: toIsoDate(lastDay) };
    }
    case 'custom':
      // Seeded with the last 7 days; the user then edits both ends.
      return { preset, from: toIsoDate(addDays(today, -6)), to: iso };
  }
}

export function presetLabel(preset: DateRangePreset): string {
  return DATE_RANGE_PRESETS.find(option => option.key === preset)?.label ?? '';
}

export function isValidCustomRange(from: string, to: string): boolean {
  if (!from || !to) return false;
  return from <= to;
}
