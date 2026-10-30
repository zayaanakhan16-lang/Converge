/** Date and text formatting used across screens. */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function parseIso(value: string): Date {
  return new Date(value);
}

export function formatTime(iso: string): string {
  const date = parseIso(iso);
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const date = parseIso(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDateRange(startIso: string, endIso: string): string {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${formatDate(startIso)} · ${formatTime(startIso)}–${formatTime(endIso)}`;
  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

/** Compact relative time for conversation lists and message bubbles. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = parseIso(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24 && then.getDate() === now.getDate()) return `${diffHours}h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return WEEKDAYS[then.getDay()];
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

export function formatCount(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** 12-hour clock time, used on message bubbles and delivery receipts. */
export function formatClockTime(iso: string): string {
  const date = parseIso(iso);
  const hours = date.getHours();
  const suffix = hours < 12 ? 'am' : 'pm';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${date.getMinutes().toString().padStart(2, '0')}${suffix}`;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Human-friendly relative time for events, e.g. "in 3 days". */
export function formatCountdown(iso: string, now: Date = new Date()): string {
  const diffMs = parseIso(iso).getTime() - now.getTime();
  if (diffMs < 0) return 'Finished';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  if (days < 7) return `in ${days} ${days === 1 ? 'day' : 'days'}`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
}
