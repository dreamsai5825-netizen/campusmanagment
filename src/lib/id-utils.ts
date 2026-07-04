/**
 * Generates readable, consistent Firestore document IDs instead of auto-generated ones.
 */

/** Slugify text for use in IDs: lowercase, alphanumeric + hyphen only. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'item';
}

/** Short unique suffix (base36 timestamp, ~6 chars). */
function uniq(): string {
  return Date.now().toString(36).slice(-6);
}

/** class-{slug}-{uniq} e.g. class-bca-section-2nd-sem-a1b2c3 */
export function generateClassId(name: string): string {
  return `class-${slugify(name)}-${uniq()}`;
}

/** subject-{slug}-{uniq} e.g. subject-hindi-a1b2c3 */
export function generateSubjectId(name: string): string {
  return `subject-${slugify(name)}-${uniq()}`;
}

/** teacher-{slug}-{uniq} e.g. teacher-mrs-davis-a1b2c3 */
export function generateTeacherId(name: string): string {
  return `teacher-${slugify(name)}-${uniq()}`;
}

/** student-{studentId} e.g. student-S0001 (studentId is already unique) */
export function generateStudentDocId(studentId: string): string {
  const safe = studentId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
  return `student-${safe}`;
}

/** announcement-{uniq} e.g. announcement-m5k2n1 */
export function generateAnnouncementId(): string {
  return `announcement-${uniq()}`;
}

/** timetable-{slug}-{uniq} e.g. timetable-grade-8-a1b2c3 */
export function generateTimetableId(name: string): string {
  return `timetable-${slugify(name)}-${uniq()}`;
}

/** parent-{studentId}-{slug}-{uniq} e.g. parent-S0001-john-doe-a1b2c3 */
export function generateParentId(studentId: string, parentName: string): string {
  const safeStudent = studentId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
  return `parent-${safeStudent}-${slugify(parentName)}-${uniq()}`;
}

/** transaction-{uniq} e.g. transaction-m5k2n1 */
export function generateTransactionId(): string {
  return `transaction-${uniq()}`;
}

/** notification-{uniq} */
export function generateNotificationId(): string {
  return `notification-${uniq()}`;
}

/** assignment-{slug}-{uniq} */
export function generateAssignmentId(title: string): string {
  return `assignment-${slugify(title)}-${uniq()}`;
}
