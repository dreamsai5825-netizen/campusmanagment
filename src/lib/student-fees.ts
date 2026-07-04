import type { Student } from '@/lib/types';

export type FeePaymentRecord = {
  id: string;
  amount: number;
  date: string;
  method: 'Cash' | 'Online' | 'Cheque' | 'Bank Transfer';
  receiptNumber?: string;
  remarks?: string;
};

export type StudentFeeSummary = {
  totalFees: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'Paid' | 'Partially Paid' | 'Not Paid';
  lastPaymentDate?: string;
};

export function getStudentFeeSummary(student: Student): StudentFeeSummary {
  const paidAmount = student.fees?.paid ?? 0;
  const totalFees =
    student.fees?.totalFees ??
    paidAmount + (student.fees?.balance ?? 0);
  const outstandingAmount =
    student.fees?.balance ?? Math.max(0, totalFees - paidAmount);

  let status: StudentFeeSummary['status'] = 'Not Paid';
  if (outstandingAmount <= 0 && totalFees > 0) status = 'Paid';
  else if (paidAmount > 0) status = 'Partially Paid';
  else if (student.fees?.status === 'Paid') status = 'Paid';
  else if (student.fees?.status === 'Partially Paid') status = 'Partially Paid';

  const history = student.fees?.paymentHistory ?? [];
  const lastPaymentDate =
    history.length > 0
      ? [...history].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0].date
      : undefined;

  return {
    totalFees,
    paidAmount,
    outstandingAmount,
    status,
    lastPaymentDate,
  };
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
