import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { DEFAULT_NEW_USER_PASSWORD } from '@/lib/default-user-password';

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

    const teachersSnap = await adminDb.collection('teachers').where('collegeId', '==', collegeId).get();
    const teachers = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; email?: string }));
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const t of teachers) {
      const email = (t.email ?? '').trim().toLowerCase();
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
            password: DEFAULT_NEW_USER_PASSWORD,
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
      total: teachers.length,
      errors: errors.length ? errors : undefined,
      message: `Created ${created} login(s) with default password ${DEFAULT_NEW_USER_PASSWORD}. ${skipped} already had accounts (passwords not changed).`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create logins';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
