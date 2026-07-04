import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * API Route to get phone number for a user
 * GET /api/whatsapp/get-phone/[userType]/[userId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userType: string; userId: string }> }
) {
  try {
    const { userType, userId } = await params;

    if (!userId || !userType) {
      return NextResponse.json(
        { error: 'User ID and type are required' },
        { status: 400 }
      );
    }

    let phoneNumber: string | null = null;

    switch (userType) {
      case 'student': {
        const studentDoc = await getDoc(doc(db, 'students', userId));
        if (studentDoc.exists()) {
          const studentData = studentDoc.data();
          phoneNumber = studentData.phone || null;
          
          // If student doesn't have phone, try to get parent's phone
          if (!phoneNumber) {
            const parentsQuery = query(
              collection(db, 'parents'),
              where('studentId', '==', userId)
            );
            const parentsSnapshot = await getDocs(parentsQuery);
            if (!parentsSnapshot.empty) {
              const parentData = parentsSnapshot.docs[0].data();
              phoneNumber = parentData.phone || null;
            }
          }
        }
        break;
      }
      case 'parent': {
        const parentDoc = await getDoc(doc(db, 'parents', userId));
        if (parentDoc.exists()) {
          const parentData = parentDoc.data();
          phoneNumber = parentData.phone || null;
        }
        break;
      }
      case 'teacher': {
        const teacherDoc = await getDoc(doc(db, 'teachers', userId));
        if (teacherDoc.exists()) {
          const teacherData = teacherDoc.data();
          phoneNumber = teacherData.phone || null;
        }
        break;
      }
      default:
        return NextResponse.json(
          { error: 'Invalid user type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      phoneNumber,
      found: phoneNumber !== null,
    });
  } catch (error) {
    console.error('Error fetching phone number:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        phoneNumber: null,
        found: false,
      },
      { status: 500 }
    );
  }
}
