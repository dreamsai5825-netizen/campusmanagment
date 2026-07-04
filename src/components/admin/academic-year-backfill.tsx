'use client';

import { useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useToast } from '@/hooks/use-toast';
import {
  markAcademicYearBackfillDone,
  runAcademicYearBackfill,
} from '@/lib/backfill-academic-year-client';

/** One-time backfill: tag students/teachers missing academicYear with the current year. */
export function AcademicYearBackfill() {
  const principal = useCurrentPrincipal();
  const { currentAcademicYear } = useAcademicYear();
  const { toast } = useToast();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!principal?.collegeId || startedRef.current) return;

    const user = auth.currentUser;
    if (!user) return;

    const storageKey = `academicYearBackfill:v2:${principal.collegeId}`;
    if (typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'done') {
      return;
    }

    startedRef.current = true;

    (async () => {
      const result = await runAcademicYearBackfill(currentAcademicYear);
      if (result.error) {
        console.warn('Academic year backfill failed:', result.error);
        startedRef.current = false;
        return;
      }

      if (result.studentsUpdated > 0 || result.teachersUpdated > 0) {
        toast({
          title: 'Academic year assigned',
          description: result.message,
        });
      }

      markAcademicYearBackfillDone(principal.collegeId);
    })();
  }, [principal?.collegeId, currentAcademicYear, toast]);

  return null;
}
