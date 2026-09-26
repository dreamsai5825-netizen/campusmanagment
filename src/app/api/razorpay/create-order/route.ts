import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      collegeId,
      amountInRupees,
      studentId,
      studentName = 'Student',
      feeType = 'Online Fee Payment',
      keyId: providedKeyId,
      keySecret: providedKeySecret,
      collegeName: providedCollegeName,
    } = body;

    if (!collegeId) {
      return NextResponse.json({ success: false, error: 'College ID is required.' }, { status: 400 });
    }
    const numAmount = Number(amountInRupees);
    if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
      return NextResponse.json({ success: false, error: 'Payment amount must be greater than zero.' }, { status: 400 });
    }

    let keyId = providedKeyId ? String(providedKeyId).trim() : '';
    let keySecret = providedKeySecret ? String(providedKeySecret).trim() : '';
    let collegeName = providedCollegeName ? String(providedCollegeName).trim() : 'Institution';
    let linkedAccountId: string | undefined;

    try {
      const { getAdminFirestore } = await import('@/lib/firebase-admin');
      const adminDb = getAdminFirestore();
      const collegeDoc = await adminDb.collection('colleges').doc(collegeId).get();

      if (collegeDoc.exists) {
        const collegeData = collegeDoc.data();
        collegeName = collegeData?.name || collegeName;

        // 1. Check if college has bankAccountDetails with linkedAccountId (Razorpay Route)
        if (collegeData?.bankAccountDetails?.linkedAccountId) {
          linkedAccountId = String(collegeData.bankAccountDetails.linkedAccountId).trim();
        }

        // 2. Direct college razorpaySettings if present and enabled
        const directRzp = collegeData?.razorpaySettings;
        if (directRzp?.enabled && directRzp?.keyId && directRzp?.keySecret) {
          if (!keyId) keyId = directRzp.keyId.trim();
          if (!keySecret) keySecret = directRzp.keySecret.trim();
        }

        // 3. If keys not found, check parent Institution / College Admin
        if (!keyId || !keySecret) {
          const instId = collegeData?.institutionId;
          const instCode = collegeData?.institutionCode;

          if (instId) {
            const adminDoc = await adminDb.collection('college_admins').doc(instId).get();
            if (adminDoc.exists) {
              const adminRzp = adminDoc.data()?.razorpaySettings;
              if (adminRzp?.enabled && adminRzp?.keyId && adminRzp?.keySecret) {
                keyId = adminRzp.keyId.trim();
                keySecret = adminRzp.keySecret.trim();
              }
            }
          }

          if ((!keyId || !keySecret) && instCode) {
            const adminQuery = await adminDb
              .collection('college_admins')
              .where('institutionCode', '==', String(instCode).toUpperCase().trim())
              .limit(1)
              .get();
            if (!adminQuery.empty) {
              const adminRzp = adminQuery.docs[0].data()?.razorpaySettings;
              if (adminRzp?.enabled && adminRzp?.keyId && adminRzp?.keySecret) {
                keyId = adminRzp.keyId.trim();
                keySecret = adminRzp.keySecret.trim();
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch college via admin DB:', err);
    }

    if (!keyId || !keySecret) {
      return NextResponse.json({
        success: false,
        error: 'Razorpay Payment Gateway is not configured or enabled by your institution College Admin.',
      }, { status: 400 });
    }

    const amountInPaise = Math.round(numAmount * 100);
    const receipt = `FEE_${String(studentId || '').replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

    // Build order payload
    const orderPayload: any = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt.slice(0, 40),
      notes: {
        studentId: String(studentId || ''),
        studentName: String(studentName || ''),
        collegeId: String(collegeId || ''),
        feeType: String(feeType || ''),
        collegeName: String(collegeName || ''),
      },
    };

    // If Razorpay Route Linked Account is configured for this college, route 100% funds directly to it!
    if (linkedAccountId && linkedAccountId.startsWith('acc_')) {
      orderPayload.transfers = [
        {
          account: linkedAccountId,
          amount: amountInPaise,
          currency: 'INR',
          on_hold: 0,
          notes: {
            collegeId: String(collegeId || ''),
            studentId: String(studentId || ''),
            feeType: String(feeType || ''),
          },
        },
      ];
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      console.error('Razorpay API Order Error:', errJson);
      return NextResponse.json({
        success: false,
        error: errJson.error?.description || 'Failed to create order with Razorpay.',
      }, { status: 400 });
    }

    const order = await response.json();

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      collegeName,
      routedToAccount: linkedAccountId || null,
    });
  } catch (error: any) {
    console.error('Error creating Razorpay order API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'An error occurred while creating the Razorpay order.',
    }, { status: 500 });
  }
}
