/** Returns the current academic year label (e.g. "2025-2026"). Year starts in June. */
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 5) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/** List of selectable academic years centered on the current year. */
export function getAvailableAcademicYears(past = 5, future = 5): string[] {
  const current = getCurrentAcademicYear();
  const startYear = parseInt(current.split('-')[0], 10);
  const years: string[] = [];
  for (let i = -past; i <= future; i++) {
    const y = startYear + i;
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

/** Normalize year formats for comparison (e.g. "2025-26" vs "2025-2026"). */
export function normalizeAcademicYearFormats(year: string): string[] {
  const formats = new Set<string>([year]);
  const parts = year.split('-');
  if (parts.length === 2) {
    const start = parts[0];
    const end = parts[1];
    if (end.length === 2 && start.length === 4) {
      formats.add(`${start}-20${end}`);
      formats.add(`${start}-${parseInt(start, 10) + 1}`);
    }
    if (end.length === 4 && start.length === 4) {
      formats.add(`${start}-${end.slice(2)}`);
    }
  }
  return Array.from(formats);
}

/** Whether a record's academic year matches the selected year. */
export function matchesAcademicYear(
  itemYear: string | undefined,
  selectedAcademicYear: string
): boolean {
  if (!selectedAcademicYear) return true;
  if (!itemYear) {
    return selectedAcademicYear === getCurrentAcademicYear();
  }

  const selectedFormats = normalizeAcademicYearFormats(selectedAcademicYear);
  const itemFormats = normalizeAcademicYearFormats(itemYear);
  if (selectedFormats.some((f) => itemFormats.includes(f))) return true;

  const selectedStart = selectedAcademicYear.split('-')[0];
  return itemYear.startsWith(selectedStart);
}
