import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import type { WriteBatch } from 'firebase-admin/firestore';

const BATCH_LIMIT = 500;

async function commitBatch(batch: WriteBatch, count: number) {
  if (count > 0) await batch.commit();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const academicYear =
      typeof body.academicYear === 'string' && body.academicYear.trim()
        ? body.academicYear.trim()
        : getCurrentAcademicYear();

    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const principalSnap = await adminDb.collection('principals').doc(uid).get();
    let collegeId: string | undefined;
    if (principalSnap.exists) {
      collegeId = principalSnap.data()?.collegeId;
    } else {
      const byEmail = await adminDb
        .collection('principals')
        .where('email', '==', decoded.email ?? '')
        .limit(1)
        .get();
      if (byEmail.empty) {
        return NextResponse.json({ error: 'Forbidden: principal only' }, { status: 403 });
      }
      collegeId = byEmail.docs[0].data()?.collegeId;
    }
    if (!collegeId) {
      return NextResponse.json({ error: 'College not found for principal' }, { status: 403 });
    }

    const [studentsSnap, teachersSnap] = await Promise.all([
      adminDb.collection('students').where('collegeId', '==', collegeId).get(),
      adminDb.collection('teachers').where('collegeId', '==', collegeId).get(),
    ]);

    let studentsUpdated = 0;
    let teachersUpdated = 0;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const docSnap of studentsSnap.docs) {
      const data = docSnap.data();
      if (data.academicYear) continue;
      batch.update(docSnap.ref, { academicYear });
      studentsUpdated++;
      batchCount++;
      if (batchCount >= BATCH_LIMIT) {
        await commitBatch(batch, batchCount);
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    for (const docSnap of teachersSnap.docs) {
      const data = docSnap.data();
      if (data.academicYear) continue;
      batch.update(docSnap.ref, { academicYear });
      teachersUpdated++;
      batchCount++;
      if (batchCount >= BATCH_LIMIT) {
        await commitBatch(batch, batchCount);
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    await commitBatch(batch, batchCount);

    return NextResponse.json({
      academicYear,
      studentsUpdated,
      teachersUpdated,
      studentsTotal: studentsSnap.size,
      teachersTotal: teachersSnap.size,
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
