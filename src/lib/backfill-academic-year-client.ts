import { auth } from '@/lib/firebase';

export type BackfillAcademicYearResult = {
  academicYear: string;
  studentsUpdated: number;
  teachersUpdated: number;
  studentsTotal: number;
  teachersTotal: number;
  message: string;
  error?: string;
};

export async function runAcademicYearBackfill(
  academicYear: string
): Promise<BackfillAcademicYearResult> {
  const user = auth.currentUser;
  if (!user) {
    return {
      academicYear,
      studentsUpdated: 0,
      teachersUpdated: 0,
      studentsTotal: 0,
      teachersTotal: 0,
      message: '',
      error: 'Not signed in',
    };
  }

  const token = await user.getIdToken();
  const res = await fetch('/api/backfill-academic-year', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ academicYear }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      academicYear,
      studentsUpdated: 0,
      teachersUpdated: 0,
      studentsTotal: 0,
      teachersTotal: 0,
      message: '',
      error: data.error ?? 'Backfill failed',
    };
  }
  return data as BackfillAcademicYearResult;
}

export function markAcademicYearBackfillDone(collegeId: string) {
  localStorage.setItem(`academicYearBackfill:v2:${collegeId}`, 'done');
}
