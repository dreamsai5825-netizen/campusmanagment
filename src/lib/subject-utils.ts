import type { Class, Teacher, Subject } from './types';

/** Get subject names for a class (from subjectIds or legacy subject). */
export function getClassSubjectNames(c: Class, allSubjects: Subject[]): string[] {
  if (c.subjectIds?.length) {
    return c.subjectIds
      .map((id) => allSubjects.find((s) => s.id === id)?.name)
      .filter((n): n is string => Boolean(n));
  }
  if (c.subject) return [c.subject];
  return [];
}

/** Get subject names for a teacher (from subjectIds or legacy subjectSpecialty). */
export function getTeacherSubjectNames(t: Teacher, allSubjects: Subject[]): string[] {
  if (t.subjectIds?.length) {
    return t.subjectIds
      .map((id) => allSubjects.find((s) => s.id === id)?.name)
      .filter((n): n is string => Boolean(n));
  }
  if (t.subjectSpecialty) return [t.subjectSpecialty];
  return [];
}

/** Display string for class subjects (comma-separated). */
export function getClassSubjectsDisplay(c: Class, allSubjects: Subject[]): string {
  const names = getClassSubjectNames(c, allSubjects);
  return names.length ? names.join(', ') : '—';
}

/** Display string for teacher subjects (comma-separated). */
export function getTeacherSubjectsDisplay(t: Teacher, allSubjects: Subject[]): string {
  const names = getTeacherSubjectNames(t, allSubjects);
  return names.length ? names.join(', ') : '—';
}
