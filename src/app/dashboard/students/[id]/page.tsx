'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student } from '@/lib/types';

/**
 * Backward compatibility redirect
 * Old route: /dashboard/students/[studentId]
 * New route: /dashboard/students/class/[classId]/[studentId]
 */
export default function StudentProfileRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;

    // Try to find the student and get their classId
    const unsub = onSnapshot(doc(db, 'students', id), (snap) => {
      if (snap.exists()) {
        const student = snap.data() as Student;
        // Redirect to the new nested route
        router.replace(`/dashboard/students/class/${student.classId}/${id}`);
      } else {
        // Student not found, redirect to students list
        router.replace('/dashboard/students');
      }
    });

    return () => unsub();
  }, [id, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
