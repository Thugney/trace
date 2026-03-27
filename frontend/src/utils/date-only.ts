const DATE_ONLY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

function createLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function extractDateOnly(value?: string | null): string {
  if (!value) return '';

  const match = value.match(DATE_ONLY_PREFIX);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return getLocalDateKey(parsed);
}

export function parseDateOnly(value?: string | null): Date | null {
  const normalized = extractDateOnly(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split('-').map(Number);
  return createLocalDate(year, month, day);
}

export type DateOnlyRelation = 'none' | 'past' | 'today' | 'future';

export function getDateOnlyRelation(value?: string | null, today = new Date()): DateOnlyRelation {
  const normalized = extractDateOnly(value);
  if (!normalized) return 'none';

  const todayKey = getLocalDateKey(today);
  if (normalized < todayKey) return 'past';
  if (normalized > todayKey) return 'future';
  return 'today';
}

export function formatDateOnlyForDisplay(value?: string | null, locale?: string): string {
  const parsed = parseDateOnly(value);
  return parsed ? parsed.toLocaleDateString(locale) : '';
}
