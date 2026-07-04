import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { DEFAULT_NEW_USER_PASSWORD } from '@/lib/default-user-password';

async function verifyPrincipalCollege(token: string) {
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
      return { error: 'Forbidden: principal only' as const, status: 403 as const };
    }
    collegeId = byEmail.docs[0].data()?.collegeId;
  }
  if (!collegeId) {
    return { error: 'College not found for principal' as const, status: 403 as const };
  }
  return { adminAuth, adminDb, collegeId };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const principal = await verifyPrincipalCollege(token);
    if ('error' in principal) {
      return NextResponse.json({ error: principal.error }, { status: principal.status });
    }

    const { adminAuth, adminDb, collegeId } = principal;

    const studentSnap = await adminDb
      .collection('students')
      .where('collegeId', '==', collegeId)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (studentSnap.empty) {
      return NextResponse.json(
        { error: 'No student record found with this email in your college' },
        { status: 404 }
      );
    }

    try {
      await adminAuth.getUserByEmail(email);
      // Existing Auth user: do not change password
      return NextResponse.json({
        created: false,
        skipped: true,
        email,
        message:
          'Login already exists for this email. Existing password was not changed.',
      });
    } catch {
      try {
        await adminAuth.createUser({
          email,
          password: DEFAULT_NEW_USER_PASSWORD,
          emailVerified: false,
        });
        return NextResponse.json({
          created: true,
          skipped: false,
          email,
          message: `Student login created. Sign in with this email and default password ${DEFAULT_NEW_USER_PASSWORD}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg, email }, { status: 500 });
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create login';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
