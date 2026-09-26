'use server';

import crypto from 'crypto';

export interface CreateRazorpayOrderInput {
  collegeId: string;
  amountInRupees: number;
  studentId: string;
  studentName?: string;
  feeType?: string;
  keyId?: string;
  keySecret?: string;
  collegeName?: string;
}

export interface VerifyRazorpayPaymentInput {
  collegeId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  studentId: string;
  amountPaid: number;
  receiptNumber?: string;
  remarks?: string;
  keySecret?: string;
}

/**
 * Creates an official Razorpay order for online fee payment.
 * Uses provided API credentials or fetches them from the database.
 */
export async function createRazorpayOrder({
  collegeId,
  amountInRupees,
  studentId,
  studentName = 'Student',
  feeType = 'Online Fee Payment',
  keyId: providedKeyId,
  keySecret: providedKeySecret,
  collegeName: providedCollegeName,
}: CreateRazorpayOrderInput) {
  try {
    if (!collegeId) {
      return { success: false, error: 'College ID is required.' };
    }
    if (!amountInRupees || amountInRupees <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }

    let keyId = providedKeyId?.trim();
    let keySecret = providedKeySecret?.trim();
    let collegeName = providedCollegeName || 'Institution';
    let linkedAccountId: string | undefined;

    // Fetch college & parent institution credentials and route settlement account
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
    } catch (dbErr) {
      console.warn('Could not fetch college or parent admin from Firebase Admin:', dbErr);
    }

    if (!keyId || !keySecret) {
      return {
        success: false,
        error: 'Razorpay Payment Gateway is not configured or enabled by your institution College Admin.',
      };
    }

    // Convert amount to paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amountInRupees * 100);
    const receipt = `FEE_${studentId.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

    // Build Razorpay Order payload
    const orderPayload: any = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receipt.slice(0, 40),
      notes: {
        studentId,
        studentName,
        collegeId,
        feeType,
        collegeName,
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
            collegeId,
            collegeName,
            studentId,
            studentName,
            feeType,
          },
        },
      ];
    }

    // Call Razorpay API to create an order
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
      return {
        success: false,
        error: errJson.error?.description || 'Failed to create order with Razorpay.',
      };
    }

    const order = await response.json();

    return {
      success: true,
      orderId: order.id as string,
      amount: order.amount as number,
      currency: order.currency as string,
      keyId,
      collegeName,
      routedToAccount: linkedAccountId || null,
    };
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while initiating the online payment.',
    };
  }
}

/**
 * Verifies Razorpay payment HMAC SHA256 signature and records fee payment in student record.
 */
export async function verifyRazorpayPayment({
  collegeId,
  orderId,
  paymentId,
  signature,
  studentId,
  amountPaid,
  receiptNumber,
  remarks,
  keySecret: providedKeySecret,
}: VerifyRazorpayPaymentInput) {
  try {
    if (!collegeId || !orderId || !paymentId || !signature || !studentId) {
      return { success: false, error: 'Missing payment verification parameters.' };
    }

    let keySecret = providedKeySecret?.trim();

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
      } catch (e) {
        console.warn('Could not fetch secret via admin DB:', e);
      }
    }

    if (!keySecret) {
      return { success: false, error: 'Institution Razorpay Secret Key is missing.' };
    }

    // Verify HMAC SHA256 signature
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      console.error('Razorpay Signature Mismatch:', { generatedSignature, signature });
      return { success: false, error: 'Payment signature verification failed. Invalid transaction signature.' };
    }

    // Payment is authentic! Attempt to update student fee record in Firestore on server if possible
    try {
      const { getAdminFirestore } = await import('@/lib/firebase-admin');
      const adminDb = getAdminFirestore();
      const studentRef = adminDb.collection('students').doc(studentId);
      const studentSnap = await studentRef.get();

      if (studentSnap.exists) {
        const studentData = studentSnap.data() || {};
        const existingFees = studentData.fees || {};
        const currentPaid = existingFees.paid || 0;
        const currentBalance = existingFees.balance || 0;
        const currentTotal = existingFees.totalFees || (currentPaid + currentBalance);

        const newPaid = currentPaid + amountPaid;
        const newBalance = Math.max(0, currentTotal - newPaid);

        let newStatus: 'Paid' | 'Partially Paid' | 'Not Paid' = 'Partially Paid';
        if (newBalance <= 0) {
          newStatus = 'Paid';
        } else if (newPaid > 0) {
          newStatus = 'Partially Paid';
        }

        const paymentDate = new Date().toISOString();
        const newPaymentRecord = {
          id: paymentId,
          amount: amountPaid,
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
    } catch (serverUpdateErr) {
      console.warn('Server-side fee update skipped (will be updated on client):', serverUpdateErr);
    }

    return {
      success: true,
      verified: true,
      message: 'Payment verified successfully.',
      paymentId,
      amountPaid,
    };
  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error);
    return {
      success: false,
      error: error.message || 'Payment signature verification failed.',
    };
  }
}

