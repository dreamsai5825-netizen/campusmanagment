import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  slugify,
  generateClassId,
  generateSubjectId,
  generateTeacherId,
  generateStudentDocId,
  generateAnnouncementId,
  generateTimetableId,
  generateParentId,
  generateNotificationId,
  generateAssignmentId,
} from './id-utils';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips non-alphanumeric', () => {
    expect(slugify('BCA Section 2nd Sem!')).toBe('bca-section-2nd-sem');
  });

  it('returns "item" for empty result', () => {
    expect(slugify('!!!')).toBe('item');
  });

  it('trims and collapses multiple hyphens', () => {
    expect(slugify('  a   b  ')).toBe('a-b');
  });
});

describe('ID generators', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generateClassId returns class-{slug}-{uniq}', () => {
    const id = generateClassId('Grade 8 A');
    expect(id).toMatch(/^class-grade-8-a-[a-z0-9]{6}$/);
  });

  it('generateSubjectId returns subject-{slug}-{uniq}', () => {
    const id = generateSubjectId('Hindi');
    expect(id).toMatch(/^subject-hindi-[a-z0-9]{6}$/);
  });

  it('generateTeacherId returns teacher-{slug}-{uniq}', () => {
    const id = generateTeacherId('Mrs. Davis');
    expect(id).toMatch(/^teacher-mrs-davis-[a-z0-9]{6}$/);
  });

  it('generateStudentDocId returns student-{safeId}', () => {
    expect(generateStudentDocId('S0001')).toBe('student-S0001');
    expect(generateStudentDocId('S 00 01')).toBe('student-S-00-01');
  });

  it('generateAnnouncementId returns announcement-{uniq}', () => {
    const id = generateAnnouncementId();
    expect(id).toMatch(/^announcement-[a-z0-9]{6}$/);
  });

  it('generateTimetableId returns timetable-{slug}-{uniq}', () => {
    const id = generateTimetableId('Grade 8');
    expect(id).toMatch(/^timetable-grade-8-[a-z0-9]{6}$/);
  });

  it('generateParentId includes studentId and slug', () => {
    const id = generateParentId('S0001', 'John Doe');
    expect(id).toMatch(/^parent-S0001-john-doe-[a-z0-9]{6}$/);
  });

  it('generateNotificationId returns notification-{uniq}', () => {
    const id = generateNotificationId();
    expect(id).toMatch(/^notification-[a-z0-9]{6}$/);
  });

  it('generateAssignmentId returns assignment-{slug}-{uniq}', () => {
    const id = generateAssignmentId('Math Homework');
    expect(id).toMatch(/^assignment-math-homework-[a-z0-9]{6}$/);
  });
});
