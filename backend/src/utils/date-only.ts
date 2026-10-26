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

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateOnly(): string {
  return formatDateOnly(new Date());
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  const match = raw.match(DATE_ONLY_PREFIX);
  if (match) {
    return createLocalDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfLocalDay(parsed);
}

export function normalizeDateOnlyInput(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const parsed = parseDateOnly(raw);
  if (!parsed) {
    throw new Error('Invalid date-only value');
  }

  return formatDateOnly(parsed);
}
