import { isValidCustomRange, presetLabel, resolvePreset, toIsoDate } from './date-range';

describe('date-range', () => {
  // A Wednesday, mid-month, so month boundaries are unambiguous.
  const today = new Date(2026, 8, 9); // 2026-09-09

  it('formats dates in local time rather than shifting via UTC', () => {
    // 00:30 local would roll back a day under toISOString() east of UTC.
    expect(toIsoDate(new Date(2026, 8, 9, 0, 30))).toBe('2026-09-09');
    expect(toIsoDate(new Date(2026, 8, 9, 23, 30))).toBe('2026-09-09');
  });

  it('resolves Today to a single day', () => {
    expect(resolvePreset('today', today)).toEqual({
      preset: 'today', from: '2026-09-09', to: '2026-09-09',
    });
  });

  it('resolves Yesterday to the previous single day', () => {
    expect(resolvePreset('yesterday', today)).toEqual({
      preset: 'yesterday', from: '2026-09-08', to: '2026-09-08',
    });
  });

  it('resolves Last 7 Days inclusive of today', () => {
    expect(resolvePreset('last7', today)).toEqual({
      preset: 'last7', from: '2026-09-03', to: '2026-09-09',
    });
  });

  it('resolves Last 30 Days inclusive of today', () => {
    expect(resolvePreset('last30', today)).toEqual({
      preset: 'last30', from: '2026-08-11', to: '2026-09-09',
    });
  });

  it('resolves This Month from the 1st to today', () => {
    expect(resolvePreset('this_month', today)).toEqual({
      preset: 'this_month', from: '2026-09-01', to: '2026-09-09',
    });
  });

  it('resolves Previous Month to that whole calendar month', () => {
    expect(resolvePreset('prev_month', today)).toEqual({
      preset: 'prev_month', from: '2026-08-01', to: '2026-08-31',
    });
  });

  it('handles a previous month shorter than the current one', () => {
    // From 31 March, February must not overflow into March.
    expect(resolvePreset('prev_month', new Date(2026, 2, 31))).toEqual({
      preset: 'prev_month', from: '2026-02-01', to: '2026-02-28',
    });
  });

  it('handles a previous month that crosses the year boundary', () => {
    expect(resolvePreset('prev_month', new Date(2026, 0, 15))).toEqual({
      preset: 'prev_month', from: '2025-12-01', to: '2025-12-31',
    });
  });

  it('seeds a custom range with the last 7 days', () => {
    expect(resolvePreset('custom', today)).toEqual({
      preset: 'custom', from: '2026-09-03', to: '2026-09-09',
    });
  });

  it('labels every preset', () => {
    expect(presetLabel('last7')).toBe('Last 7 Days');
    expect(presetLabel('prev_month')).toBe('Previous Month');
  });

  it('accepts a single-day custom range but rejects a reversed or partial one', () => {
    expect(isValidCustomRange('2026-09-01', '2026-09-01')).toBe(true);
    expect(isValidCustomRange('2026-09-01', '2026-09-07')).toBe(true);
    expect(isValidCustomRange('2026-09-07', '2026-09-01')).toBe(false);
    expect(isValidCustomRange('', '2026-09-07')).toBe(false);
    expect(isValidCustomRange('2026-09-07', '')).toBe(false);
  });
});
