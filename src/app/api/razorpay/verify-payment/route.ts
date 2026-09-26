import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      collegeId,
      orderId,
      paymentId,
      signature,
      studentId,
      amountPaid,
      receiptNumber,
      remarks,
      keySecret: providedKeySecret,
    } = body;

    if (!collegeId || !orderId || !paymentId || !signature || !studentId) {
      return NextResponse.json({ success: false, error: 'Missing payment verification parameters.' }, { status: 400 });
    }

    let keySecret = providedKeySecret ? String(providedKeySecret).trim() : '';

    if (!keySecret) {
      try {
        const { getAdminFirestore } = await import('@/lib/firebase-admin');
        const adminDb = getAdminFirestore();
        const collegeDoc = await adminDb.collection('colleges').doc(collegeId).get();
        if (collegeDoc.exists) {
          const collegeData = collegeDoc.data();
          keySecret = collegeData?.razorpaySettings?.keySecret?.trim();

          if (!keySecret) {
            const instId = collegeData?.institutionId;
            const instCode = collegeData?.institutionCode;

            if (instId) {
              const adminDoc = await adminDb.collection('college_admins').doc(instId).get();
              if (adminDoc.exists) {
                keySecret = adminDoc.data()?.razorpaySettings?.keySecret?.trim();
              }
            }

            if (!keySecret && instCode) {
              const adminQuery = await adminDb
                .collection('college_admins')
                .where('institutionCode', '==', String(instCode).toUpperCase().trim())
                .limit(1)
                .get();
              if (!adminQuery.empty) {
                keySecret = adminQuery.docs[0].data()?.razorpaySettings?.keySecret?.trim();
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch secret via admin DB:', err);
      }
    }

    if (!keySecret) {
      return NextResponse.json({ success: false, error: 'Institution Razorpay Secret Key is missing.' }, { status: 400 });
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      console.error('Razorpay Signature Mismatch:', { generatedSignature, signature });
      return NextResponse.json({ success: false, error: 'Payment signature verification failed. Invalid transaction signature.' }, { status: 400 });
    }

    // Attempt server-side update if possible
    try {
      const { getAdminFirestore } = await import('@/lib/firebase-admin');
      const adminDb = getAdminFirestore();
      const studentRef = adminDb.collection('students').doc(studentId);
      const studentSnap = await studentRef.get();

      if (studentSnap.exists) {
        const studentData = studentSnap.data() || {};
        const existingFees = studentData.fees || {};
        const currentPaid = existingFees.paid || 0;
        const currentTotal = existingFees.totalFees || (currentPaid + Number(amountPaid || 0));
        const newPaid = currentPaid + Number(amountPaid || 0);
        const newBalance = Math.max(0, currentTotal - newPaid);
        const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';

        const paymentDate = new Date().toISOString();
        const newPaymentRecord = {
          id: paymentId,
          amount: Number(amountPaid || 0),
          date: paymentDate,
          method: 'Online',
          receiptNumber: receiptNumber || paymentId,
          remarks: remarks || `Razorpay Online Payment (Order: ${orderId})`,
        };

        const updatedPaymentHistory = [...(existingFees.paymentHistory || []), newPaymentRecord];

        await studentRef.update({
          'fees.paid': newPaid,
          'fees.balance': newBalance,
          'fees.status': newStatus,
          'fees.paymentHistory': updatedPaymentHistory,
        });
      }
    } catch (e) {
      console.warn('Server fee update skipped (will update on client):', e);
    }

    return NextResponse.json({
      success: true,
      verified: true,
      paymentId,
      amountPaid,
    });
  } catch (error: any) {
    console.error('Error verifying Razorpay payment API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Payment signature verification failed.',
    }, { status: 500 });
  }
}
