import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { queryDocuments, setDocument } from '@/lib/firestore-rest-api';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const academicYear =
      typeof body.academicYear === 'string' && body.academicYear.trim()
        ? body.academicYear.trim()
        : getCurrentAcademicYear();

    let collegeId = typeof body.collegeId === 'string' ? body.collegeId.trim() : '';

    // If collegeId not in body, try to resolve from Authorization Bearer token
    if (!collegeId) {
      try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (token) {
          const adminAuth = getAdminAuth();
          const adminDb = getAdminFirestore();
          const decoded = await adminAuth.verifyIdToken(token);
          const uid = decoded.uid;

          const principalSnap = await adminDb.collection('principals').doc(uid).get();
          if (principalSnap.exists) {
            collegeId = principalSnap.data()?.collegeId || '';
          } else if (decoded.email) {
            const byEmail = await adminDb
              .collection('principals')
              .where('email', '==', decoded.email)
              .limit(1)
              .get();
            if (!byEmail.empty) {
              collegeId = byEmail.docs[0].data()?.collegeId || '';
            }
          }
        }
      } catch (authErr) {
        console.warn('Could not resolve collegeId from auth token:', authErr);
      }
    }

    if (!collegeId) {
      return NextResponse.json({ error: 'collegeId is required for backfill' }, { status: 400 });
    }

    const [students, teachers] = await Promise.all([
      queryDocuments('students', 'collegeId', 'EQUAL', collegeId),
      queryDocuments('teachers', 'collegeId', 'EQUAL', collegeId)
    ]);

    let studentsUpdated = 0;
    let teachersUpdated = 0;

    for (const student of students) {
      if (!student.academicYear) {
        await setDocument('students', student.id, { ...student, academicYear });
        studentsUpdated++;
      }
    }

    for (const teacher of teachers) {
      if (!teacher.academicYear) {
        await setDocument('teachers', teacher.id, { ...teacher, academicYear });
        teachersUpdated++;
      }
    }

    return NextResponse.json({
      academicYear,
      studentsUpdated,
      teachersUpdated,
      studentsTotal: students.length,
      teachersTotal: teachers.length,
      message:
        studentsUpdated + teachersUpdated > 0
          ? `Assigned ${studentsUpdated} student(s) and ${teachersUpdated} teacher(s) to ${academicYear}.`
          : `All students and teachers already have an academic year.`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Backfill failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
