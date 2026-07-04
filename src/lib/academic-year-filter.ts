import { matchesAcademicYear } from '@/lib/academic-year';

export function filterByAcademicYear<T extends { academicYear?: string }>(
  data: T[],
  selectedAcademicYear: string
): T[] {
  if (!selectedAcademicYear) return data;
  return data.filter((item) =>
    matchesAcademicYear(item.academicYear, selectedAcademicYear)
  );
}
