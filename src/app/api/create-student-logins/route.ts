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

    let collegeId: string | undefined;

    // Check if principal snap exists
    const principalSnap = await adminDb.collection('principals').doc(uid).get();
    if (principalSnap.exists) {
      collegeId = principalSnap.data()?.collegeId;
    } else {
      // Check if clerk snap exists
      const clerkSnap = await adminDb.collection('clerks').doc(uid).get();
      if (clerkSnap.exists) {
        collegeId = clerkSnap.data()?.collegeId;
      } else {
        // Look up principal by email
        const email = decoded.email ?? '';
        const byEmailPrincipal = await adminDb
          .collection('principals')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (!byEmailPrincipal.empty) {
          collegeId = byEmailPrincipal.docs[0].data()?.collegeId;
        } else {
          // Look up clerk by email
          const byEmailClerk = await adminDb
            .collection('clerks')
            .where('email', '==', email)
            .limit(1)
            .get();
          
          if (!byEmailClerk.empty) {
            collegeId = byEmailClerk.docs[0].data()?.collegeId;
          }
        }
      }
    }

    if (!collegeId) {
      return NextResponse.json({ error: 'Forbidden: principal or clerk only' }, { status: 403 });
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
