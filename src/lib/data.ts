/**
 * Runtime data is empty; all app data comes from Firestore in real time.
 */

export type { Principal, Teacher, Class, Student, Assignment, Announcement, Notification, Parent, TimetableEvent, Timetable, Transaction, Subject } from './types';

export const classes: { id: string; name: string; subject: string }[] = [];
export const students: import('./types').Student[] = [];
export const assignments: { id: string; title: string; classId: string; dueDate: string; status: string }[] = [];
export const announcements: { id: string; title: string; content: string; date: string }[] = [];
export const notifications: import('./types').Notification[] = [];
export const parents: import('./types').Parent[] = [];
export const timetables: import('./types').Timetable[] = [];
export const transactions: import('./types').Transaction[] = [];
export const subjects: { id: string; name: string }[] = [];
