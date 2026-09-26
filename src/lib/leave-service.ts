import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocs,
  query,
  where,
  setDoc,
} from 'firebase/firestore';
import type { Teacher, LeaveRequest, TeacherLeave } from '@/lib/types';

export const DEFAULT_LEAVE_QUOTAS: Record<string, number> = {
  'Casual Leave (CL)': 12,
  'Medical Leave (ML)': 8,
  'Earned Leave (EL)': 10,
  'Duty Leave (OD)': 5,
  'Loss of Pay (LOP)': 12,
};

export const STANDARD_LEAVE_TYPES = [
  'Casual Leave (CL)',
  'Medical Leave (ML)',
  'Earned Leave (EL)',
  'Duty Leave (OD)',
  'Loss of Pay (LOP)',
  'Maternity / Paternity Leave',
  'Compensatory Off (Comp-Off)',
  'Other (Custom)',
];

/**
 * Calculates total days for a leave request based on dates and half-day flag.
 */
export function calculateLeaveDuration(
  startDate: string,
  endDate: string,
  isHalfDay?: boolean
): number {
  if (!startDate) return 0;
  if (isHalfDay) return 0.5;
  if (!endDate || startDate === endDate) return 1.0;

  const d1 = new Date(startDate + 'T00:00:00');
  const d2 = new Date(endDate + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return 1.0;

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * Generates an array of YYYY-MM-DD date strings between startDate and endDate inclusive.
 */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate) return [];
  if (!endDate || startDate === endDate) return [startDate];

  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export type SubmitLeaveRequestParams = {
  teacher: Teacher;
  leaveType: string;
  customTypeName?: string;
  subject: string;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  halfDaySession?: 'First Half (Morning)' | 'Second Half (Afternoon)';
  reason: string;
  principalId?: string;
};

/**
 * Teacher applies for a leave with chosen leave type.
 */
export async function submitTeacherLeaveRequest(
  params: SubmitLeaveRequestParams
): Promise<{ success: boolean; id: string }> {
  const {
    teacher,
    leaveType,
    customTypeName,
    subject,
    startDate,
    endDate,
    isHalfDay,
    halfDaySession,
    reason,
    principalId,
  } = params;

  if (!teacher.id || !teacher.collegeId) {
    throw new Error('Teacher profile is missing identification or college ID.');
  }

  const finalType =
    leaveType === 'Other (Custom)' && customTypeName?.trim()
      ? customTypeName.trim()
      : leaveType;

  const duration = calculateLeaveDuration(startDate, endDate, isHalfDay);

  const requestData: Omit<LeaveRequest, 'id'> = {
    collegeId: teacher.collegeId,
    senderId: teacher.id,
    senderName: teacher.name ?? 'Teacher',
    senderType: 'teacher',
    subject: subject.trim(),
    startDate,
    endDate,
    reason: reason.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    leaveType: finalType,
    duration,
    ...(isHalfDay && { isHalfDay: true, halfDaySession }),
  };

  const docRef = await addDoc(collection(db, 'leaveRequests'), requestData);

  // Send in-app notification to principal if exists
  if (principalId) {
    try {
      await addDoc(collection(db, 'notifications'), {
        collegeId: teacher.collegeId,
        recipientId: principalId,
        type: 'message',
        sender: { name: teacher.name ?? 'Teacher', role: 'teacher' },
        title: `New Leave Request: ${teacher.name ?? 'Teacher'}`,
        content: `${finalType} (${duration === 0.5 ? '0.5 Day' : `${duration} Days`}): ${subject.trim()}`,
        date: new Date().toISOString(),
        read: false,
      });

      // Optional WhatsApp notification
      try {
        const { sendNotificationViaWhatsApp } = await import('@/lib/whatsapp-notification');
        sendNotificationViaWhatsApp(
          principalId,
          `New Leave Request: ${teacher.name ?? 'Teacher'}`,
          `Type: ${finalType}\nDuration: ${duration === 0.5 ? '0.5 Day' : `${duration} Days`}\nDates: ${startDate} to ${endDate}\nReason: ${reason.trim()}`,
          'teacher'
        ).catch(() => {});
      } catch {}
    } catch (notifErr) {
      console.warn('Failed to dispatch principal notification for leave request:', notifErr);
    }
  }

  return { success: true, id: docRef.id };
}

/**
 * Approves a leave request:
 * 1. Creates TeacherLeave entries in teachers/${teacherId}/leaves
 * 2. Increments leavesTaken on the teacher document
 * 3. Updates leaveRequests/${id} status to 'approved'
 * 4. Notifies the teacher
 */
export async function approveLeaveRequest(
  request: LeaveRequest,
  approvedBy = 'Admin'
): Promise<{ success: boolean; message: string }> {
  if (!request.id || !request.senderId) {
    throw new Error('Invalid leave request details.');
  }

  const finalType = request.leaveType || 'Casual Leave (CL)';
  const dates = getDatesInRange(request.startDate, request.endDate);
  const isHalfDay = !!request.isHalfDay && dates.length <= 1;
  const duration = isHalfDay ? 0.5 : dates.length;

  const createdLeaveLogIds: string[] = [];

  // Create individual TeacherLeave records in teacher's subcollection
  for (const dateStr of dates) {
    const leaveDocRef = doc(collection(db, 'teachers', request.senderId, 'leaves'));
    const leaveDocData: Omit<TeacherLeave, 'id'> = {
      teacherId: request.senderId,
      collegeId: request.collegeId,
      date: dateStr,
      type: finalType,
      duration: isHalfDay ? 0.5 : 1.0,
      ...(isHalfDay && request.halfDaySession && { halfDaySession: request.halfDaySession }),
      reason: request.reason || 'Approved leave request',
      createdAt: new Date().toISOString(),
      appliedBy: approvedBy,
      leaveRequestId: request.id,
    };

    await setDoc(leaveDocRef, leaveDocData);
    createdLeaveLogIds.push(leaveDocRef.id);
  }

  // Update teacher's leavesTaken map
  try {
    const teacherRef = doc(db, 'teachers', request.senderId);
    const teacherSnap = await getDoc(teacherRef);
    if (teacherSnap.exists()) {
      const teacherData = teacherSnap.data();
      const currentLeavesTaken = (teacherData.leavesTaken || {}) as Record<string, number>;
      const newTakenCount = (currentLeavesTaken[finalType] || 0) + duration;
      await updateDoc(teacherRef, {
        [`leavesTaken.${finalType}`]: newTakenCount,
      });
    }
  } catch (err) {
    console.warn('Could not update teacher leavesTaken map:', err);
  }

  // Update the LeaveRequest document
  await updateDoc(doc(db, 'leaveRequests', request.id), {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy,
    leaveType: finalType,
    duration,
    createdLeaveLogIds,
  });

  // Notify the teacher
  try {
    await addDoc(collection(db, 'notifications'), {
      collegeId: request.collegeId,
      recipientId: request.senderId,
      type: 'message',
      sender: { name: approvedBy, role: 'admin' },
      title: 'Leave Request Approved',
      content: `Your leave for "${finalType}" (${request.startDate} to ${request.endDate}) has been approved. ${duration} day(s) deducted from your balance.`,
      date: new Date().toISOString(),
      read: false,
    });
  } catch (err) {
    console.warn('Failed to send approval notification to teacher:', err);
  }

  return {
    success: true,
    message: `Leave approved. ${duration} day(s) deducted from ${request.senderName}'s ${finalType} balance.`,
  };
}

/**
 * Rejects a leave request:
 * If it was previously approved, cleans up created TeacherLeave logs and restores balance.
 */
export async function rejectLeaveRequest(
  request: LeaveRequest,
  rejectedBy = 'Admin'
): Promise<{ success: boolean; message: string }> {
  if (!request.id) {
    throw new Error('Invalid leave request.');
  }

  const finalType = request.leaveType || 'Casual Leave (CL)';

  // If this was previously approved, revert the deduction
  if (request.status === 'approved') {
    try {
      // 1. Delete created subcollection entries
      if (request.createdLeaveLogIds && request.createdLeaveLogIds.length > 0) {
        for (const logId of request.createdLeaveLogIds) {
          await deleteDoc(doc(db, 'teachers', request.senderId, 'leaves', logId)).catch(() => {});
        }
      } else {
        // Fallback: search by leaveRequestId
        const qLogs = query(
          collection(db, 'teachers', request.senderId, 'leaves'),
          where('leaveRequestId', '==', request.id)
        );
        const snap = await getDocs(qLogs);
        for (const d of snap.docs) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }

      // 2. Decrement teacher's leavesTaken map
      const teacherRef = doc(db, 'teachers', request.senderId);
      const teacherSnap = await getDoc(teacherRef);
      if (teacherSnap.exists()) {
        const teacherData = teacherSnap.data();
        const currentLeavesTaken = (teacherData.leavesTaken || {}) as Record<string, number>;
        const duration = request.duration || 1.0;
        const newTakenCount = Math.max(0, (currentLeavesTaken[finalType] || 0) - duration);
        await updateDoc(teacherRef, {
          [`leavesTaken.${finalType}`]: newTakenCount,
        });
      }
    } catch (revertErr) {
      console.warn('Failed to rollback previously approved leave entries:', revertErr);
    }
  }

  // Update request status to rejected
  await updateDoc(doc(db, 'leaveRequests', request.id), {
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
    rejectedBy,
  });

  // Notify teacher
  try {
    await addDoc(collection(db, 'notifications'), {
      collegeId: request.collegeId,
      recipientId: request.senderId,
      type: 'message',
      sender: { name: rejectedBy, role: 'admin' },
      title: 'Leave Request Rejected',
      content: `Your leave request for "${finalType}" (${request.startDate} to ${request.endDate}) was not approved.`,
      date: new Date().toISOString(),
      read: false,
    });
  } catch (err) {
    console.warn('Failed to send rejection notification to teacher:', err);
  }

  return {
    success: true,
    message: `Leave request for ${request.senderName} has been rejected.`,
  };
}
