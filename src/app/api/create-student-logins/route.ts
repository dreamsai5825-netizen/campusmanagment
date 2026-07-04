import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

function randomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < length; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const principalSnap = await adminDb.collection('principals').doc(uid).get();
    let collegeId: string | undefined;
    if (principalSnap.exists) {
      collegeId = principalSnap.data()?.collegeId;
    } else {
      const byEmail = await adminDb.collection('principals').where('email', '==', decoded.email ?? '').limit(1).get();
      if (byEmail.empty) {
        return NextResponse.json({ error: 'Forbidden: principal only' }, { status: 403 });
      }
      collegeId = byEmail.docs[0].data()?.collegeId;
    }
    if (!collegeId) {
      return NextResponse.json({ error: 'College not found for principal' }, { status: 403 });
    }

    const studentsSnap = await adminDb.collection('students').where('collegeId', '==', collegeId).get();
    const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; email?: string }));
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const s of students) {
      const email = (s.email ?? '').trim().toLowerCase();
      if (!email) {
        skipped++;
        continue;
      }
      try {
        await adminAuth.getUserByEmail(email);
        skipped++;
      } catch {
        try {
          await adminAuth.createUser({
            email,
            password: randomPassword(),
            emailVerified: false,
          });
          created++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${email}: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      created,
      skipped,
      total: students.length,
      errors: errors.length ? errors : undefined,
      message: `Created ${created} logins, ${skipped} already had accounts. Students can use "Forgot password" on the login page to set their password.`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create logins';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
