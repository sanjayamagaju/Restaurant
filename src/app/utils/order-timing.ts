export type Urgency = 'normal' | 'warning' | 'delayed';

export function elapsedMs(iso: string, now: number): number {
  return Math.max(0, now - new Date(iso).getTime());
}

export function elapsedLabel(iso: string, now: number): string {
  const totalSeconds = Math.floor(elapsedMs(iso, now) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function urgency(iso: string, now: number): Urgency {
  const minutes = elapsedMs(iso, now) / 60000;
  if (minutes >= 20) return 'delayed';
  if (minutes >= 10) return 'warning';
  return 'normal';
}

export function isToday(iso: string | null | undefined, referenceNow: number): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date(referenceNow).toDateString();
}
