import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const adminDb = getAdminFirestore();

    const resultsList: any[] = Array.isArray(body.results)
      ? body.results
      : body.result
      ? [body.result]
      : [];

    if (resultsList.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Write in chunks of 400 (Firestore batch limit is 500)
    const chunkSize = 400;
    for (let i = 0; i < resultsList.length; i += chunkSize) {
      const chunk = resultsList.slice(i, i + chunkSize);
      const batch = adminDb.batch();
      for (const item of chunk) {
        const id = item.id || adminDb.collection('omr_results').doc().id;
        const ref = adminDb.collection('omr_results').doc(id);
        batch.set(ref, { ...item, id }, { merge: true });
      }
      await batch.commit();
    }

    return NextResponse.json({ success: true, count: resultsList.length });
  } catch (error: any) {
    console.error('[API /api/omr/save-results Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save OMR results' },
      { status: 500 }
    );
  }
}
