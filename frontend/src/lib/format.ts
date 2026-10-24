export const OIL = '#f0a63a';
export const GAS = '#51d3c2';
export const WATER = '#5b9dff';
export const DOWNTIME = '#f0736d';
export const FORECAST = '#b49bff';
export const FIELD_COLORS = ['#f0a63a', '#51d3c2', '#5b9dff', '#b49bff', '#f0736d', '#88c46a'];

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function fmtInt(value: number | null | undefined): string {
  return integer.format(Number(value ?? 0));
}

export function fmtNum(value: number | null | undefined, digits = 0): string {
  if (digits === 1) return oneDecimal.format(Number(value ?? 0));
  if (digits === 2) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value ?? 0));
  return integer.format(Number(value ?? 0));
}

export function fmtCompact(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${oneDecimal.format(n / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${oneDecimal.format(n / 1_000_000)}M`;
  if (abs >= 10_000) return `${oneDecimal.format(n / 1_000)}k`;
  if (abs >= 1_000) return `${oneDecimal.format(n / 1_000)}k`;
  return integer.format(n);
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  return `${fmtNum(value, digits)}%`;
}

export function fmtDelta(value: number | null | undefined, digits = 1): string {
  const n = Number(value ?? 0);
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmtNum(n, digits)}%`;
}

export function parseDate(value: string): Date {
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseDate(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDateShort(value);
}

export function toDateInput(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function toDateTimeInput(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function addDays(dateString: string, days: number): string {
  const date = parseDate(dateString);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function monthTick(value: string): string {
  return parseDate(value).toLocaleDateString('en-US', { month: 'short' });
}

export function fullMonthTick(value: string): string {
  return parseDate(value).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
