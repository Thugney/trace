const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function extractDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(DATE_ONLY_PATTERN);
  return match ? match[0] : null;
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  const dateOnly = extractDateOnly(value);
  if (!dateOnly) {
    return null;
  }

  const [year, month, day] = dateOnly.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateKey(date: Date = new Date()): string {
  return formatDateOnly(date);
}

export function formatDateOnlyForDisplay(
  value: string | null | undefined,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return value || '';
  }

  return parsed.toLocaleDateString(locale, options);
}

export function differenceInDateOnlyDays(
  value: string | null | undefined,
  referenceValue: string = getLocalDateKey()
): number {
  const target = parseDateOnly(value);
  const reference = parseDateOnly(referenceValue);

  if (!target || !reference) {
    return 0;
  }

  return Math.round((target.getTime() - reference.getTime()) / 86400000);
}
