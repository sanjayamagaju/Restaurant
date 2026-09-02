import { elapsedLabel, isToday, urgency } from './order-timing';

describe('order-timing', () => {
  it('formats elapsed time as MM:SS under an hour', () => {
    const now = Date.now();
    const createdAt = new Date(now - 5 * 60_000 - 12_000).toISOString();
    expect(elapsedLabel(createdAt, now)).toBe('05:12');
  });

  it('formats elapsed time as H:MM:SS past an hour', () => {
    const now = Date.now();
    const createdAt = new Date(now - 65 * 60_000).toISOString();
    expect(elapsedLabel(createdAt, now)).toBe('1:05:00');
  });

  it('classifies urgency by elapsed minutes', () => {
    const now = Date.now();
    expect(urgency(new Date(now - 2 * 60_000).toISOString(), now)).toBe('normal');
    expect(urgency(new Date(now - 12 * 60_000).toISOString(), now)).toBe('warning');
    expect(urgency(new Date(now - 25 * 60_000).toISOString(), now)).toBe('delayed');
  });

  it('isToday compares against the reference date, not the real clock', () => {
    const referenceNow = new Date(2026, 0, 15, 10, 0, 0).getTime();
    const sameDay = new Date(2026, 0, 15, 2, 0, 0).toISOString();
    const previousDay = new Date(2026, 0, 14, 23, 59, 0).toISOString();

    expect(isToday(sameDay, referenceNow)).toBeTrue();
    expect(isToday(previousDay, referenceNow)).toBeFalse();
    expect(isToday(null, referenceNow)).toBeFalse();
  });
});
