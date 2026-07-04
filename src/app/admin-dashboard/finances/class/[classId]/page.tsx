'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { filterByAcademicYear } from '@/lib/academic-year-filter';
import {
  getStudentFeeSummary,
  formatInr,
  type FeePaymentRecord,
} from '@/lib/student-fees';
import {
  printSinglePaymentReceipt,
  printStudentFeeReport,
} from '@/lib/fee-receipt';
import { getCollegeById } from '@/lib/college-service';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Class, College, Student } from '@/lib/types';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  DollarSign,
  Eye,
  IndianRupee,
  Loader2,
  Printer,
  Receipt,
  Search,
  Users,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

const PAYMENT_METHODS = ['Cash', 'Online', 'Cheque', 'Bank Transfer'] as const;

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'Paid') return 'default';
  if (status === 'Partially Paid') return 'secondary';
  return 'destructive';
}

export default function ClassFeeBookPage() {
  const params = useParams();
  const classId = params.classId as string;
  const router = useRouter();
  const principal = useCurrentPrincipal();
  const { selectedAcademicYear } = useAcademicYear();
  const { toast } = useToast();
  const { getPath } = useDashboardPath();

  const [studentClass, setStudentClass] = useState<Class | null>(null);
  const [college, setCollege] = useState<College | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>('Cash');
  const [paymentReceipt, setPaymentReceipt] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (!principal?.collegeId || !classId) return;
    getCollegeById(principal.collegeId).then(setCollege);
    const unsubClass = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const found = snap.docs.find((d) => d.id === classId);
        setStudentClass(
          found ? ({ ...found.data(), id: found.id } as Class) : null
        );
      }
    );
    const unsubStudents = onSnapshot(
      query(
        collection(db, 'students'),
        where('collegeId', '==', principal.collegeId),
        where('classId', '==', classId)
      ),
      (snap) =>
        setAllStudents(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Student)))
    );
    return () => {
      unsubClass();
      unsubStudents();
    };
  }, [principal?.collegeId, classId]);

  const students = useMemo(
    () => filterByAcademicYear(allStudents, selectedAcademicYear),
    [allStudents, selectedAcademicYear]
  );

  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.studentId.toLowerCase().includes(term) ||
        (s.email ?? '').toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const summary = useMemo(() => {
    return students.reduce(
      (acc, s) => {
        const fee = getStudentFeeSummary(s);
        acc.totalStudents += 1;
        acc.totalCollected += fee.paidAmount;
        acc.totalOutstanding += fee.outstandingAmount;
        if (fee.status === 'Paid') acc.paidCount += 1;
        else if (fee.status === 'Partially Paid') acc.partialCount += 1;
        else acc.unpaidCount += 1;
        return acc;
      },
      {
        totalStudents: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        paidCount: 0,
        partialCount: 0,
        unpaidCount: 0,
      }
    );
  }, [students]);

  const collectionStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;
    const stats = {
      today: { amount: 0, count: 0 },
      week: { amount: 0, count: 0 },
      month: { amount: 0, count: 0 },
    };
    students.forEach((s) => {
      (s.fees?.paymentHistory ?? []).forEach((p) => {
        const t = new Date(p.date).getTime();
        stats.month.amount += p.amount;
        stats.month.count += 1;
        if (t >= weekStart) {
          stats.week.amount += p.amount;
          stats.week.count += 1;
        }
        if (t >= todayStart) {
          stats.today.amount += p.amount;
          stats.today.count += 1;
        }
      });
    });
    return stats;
  }, [students]);

  const receiptCollege = useMemo(
    () => ({
      name: college?.name ?? 'CMS Portal',
      code: college?.code,
    }),
    [college]
  );

  const handlePrintReport = (student: Student) => {
    const ok = printStudentFeeReport({
      student,
      className: studentClass?.name ?? '—',
      academicYear: selectedAcademicYear,
      college: receiptCollege,
    });
    if (!ok) {
      toast({
        variant: 'destructive',
        title: 'Popup blocked',
        description: 'Allow popups to print the fee report.',
      });
      return;
    }
    toast({
      title: 'Receipt opened',
      description: 'Use Print in the new window to print the fee report.',
    });
  };

  const handlePrintPayment = (student: Student, payment: FeePaymentRecord) => {
    const ok = printSinglePaymentReceipt({
      student,
      className: studentClass?.name ?? '—',
      academicYear: selectedAcademicYear,
      college: receiptCollege,
      payment,
    });
    if (!ok) {
      toast({
        variant: 'destructive',
        title: 'Popup blocked',
        description: 'Allow popups to print the receipt.',
      });
      return;
    }
    toast({
      title: 'Receipt opened',
      description: `Payment receipt for ${formatInr(payment.amount)} ready to print.`,
    });
  };

  const openPaymentDialog = (student: Student) => {
    const fee = getStudentFeeSummary(student);
    setPaymentStudent(student);
    setPaymentAmount(fee.outstandingAmount > 0 ? String(fee.outstandingAmount) : '');
    setPaymentMethod('Cash');
    setPaymentReceipt('');
    setPaymentRemarks('');
  };

  const handleRecordPayment = async () => {
    if (!paymentStudent) return;
    const amount = parseFloat(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid amount',
        description: 'Enter a valid payment amount.',
      });
      return;
    }

    const fee = getStudentFeeSummary(paymentStudent);
    if (amount > fee.outstandingAmount) {
      toast({
        variant: 'destructive',
        title: 'Amount too high',
        description: `Outstanding is only ${formatInr(fee.outstandingAmount)}.`,
      });
      return;
    }

    setSavingPayment(true);
    try {
      const newPaid = fee.paidAmount + amount;
      const newBalance = Math.max(0, fee.totalFees - newPaid);
      const newStatus =
        newBalance <= 0 ? 'Paid' : newPaid > 0 ? 'Partially Paid' : 'Not Paid';
      const receiptNo =
        paymentReceipt.trim() || `RCP-${Date.now().toString().slice(-8)}`;
      const paymentEntry: FeePaymentRecord = {
        id: `pay-${Date.now()}`,
        amount,
        date: new Date().toISOString(),
        method: paymentMethod,
        receiptNumber: receiptNo,
        ...(paymentRemarks.trim() && { remarks: paymentRemarks.trim() }),
      };
      const existingHistory = paymentStudent.fees?.paymentHistory ?? [];

      await updateDoc(doc(db, 'students', paymentStudent.id), {
        fees: {
          ...paymentStudent.fees,
          status: newStatus,
          balance: newBalance,
          totalFees: fee.totalFees,
          paid: newPaid,
          paymentHistory: [...existingHistory, paymentEntry],
        },
      });

      toast({
        title: 'Payment recorded',
        description: `${formatInr(amount)} recorded for ${paymentStudent.name}.`,
      });
      setPaymentStudent(null);

      printSinglePaymentReceipt({
        student: paymentStudent,
        className: studentClass?.name ?? '—',
        academicYear: selectedAcademicYear,
        college: receiptCollege,
        payment: paymentEntry,
        receiptNumber: receiptNo,
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Payment failed',
        description: 'Could not save payment.',
      });
    } finally {
      setSavingPayment(false);
    }
  };

  const profileFee = profileStudent ? getStudentFeeSummary(profileStudent) : null;
  const profilePayments = profileStudent?.fees?.paymentHistory ?? [];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={getPath('/finances')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary shrink-0" />
              {studentClass?.name ?? 'Class'} — Fee Book
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {selectedAcademicYear} · Student fee records
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700">{summary.totalStudents}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Total Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700">
              {formatInr(summary.totalCollected)}
            </p>
            <p className="text-xs text-green-600 mt-1">{summary.paidCount} fully paid</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700">
              {formatInr(summary.totalOutstanding)}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              {summary.partialCount + summary.unpaidCount} pending
            </p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-700">
              {summary.paidCount} paid · {summary.partialCount} partial ·{' '}
              {summary.unpaidCount} unpaid
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200 bg-green-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-800 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today&apos;s Collection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {formatInr(collectionStats.today.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {collectionStats.today.count} payment(s)
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">
              {formatInr(collectionStats.week.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {collectionStats.week.count} payment(s) · last 7 days
            </p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-purple-800 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-700">
              {formatInr(collectionStats.month.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {collectionStats.month.count} payment(s) · last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search student name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Fee Records ({filteredStudents.length})
          </CardTitle>
          <CardDescription className="text-blue-100">
            Record payments, view profiles, and print receipts
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No students in this class for {selectedAcademicYear}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Total Fees</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right min-w-[280px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const fee = getStudentFeeSummary(student);
                    const placeholder = PlaceHolderImages.find(
                      (p) => p.id === student.id
                    );
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage
                                src={student.photoUrl ?? placeholder?.imageUrl}
                              />
                              <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                ID: {student.studentId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatInr(fee.totalFees)}</TableCell>
                        <TableCell className="text-green-700 font-medium">
                          {formatInr(fee.paidAmount)}
                        </TableCell>
                        <TableCell className="text-orange-700 font-medium">
                          {formatInr(fee.outstandingAmount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fee.lastPaymentDate
                            ? format(new Date(fee.lastPaymentDate), 'dd MMM yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(fee.status)}>{fee.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setProfileStudent(student)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Profile
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={fee.outstandingAmount <= 0}
                              onClick={() => openPaymentDialog(student)}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Pay
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePrintReport(student)}
                            >
                              <Printer className="h-3 w-3 mr-1" />
                              Receipt
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record payment */}
      <Dialog open={!!paymentStudent} onOpenChange={(open) => !open && setPaymentStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentStudent?.name} — Outstanding{' '}
              {paymentStudent
                ? formatInr(getStudentFeeSummary(paymentStudent).outstandingAmount)
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) =>
                  setPaymentMethod(v as (typeof PAYMENT_METHODS)[number])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt number</Label>
              <Input
                id="receipt"
                value={paymentReceipt}
                onChange={(e) => setPaymentReceipt(e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (optional)</Label>
              <Input
                id="remarks"
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentStudent(null)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={savingPayment}>
              {savingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Record & print receipt'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student fee profile */}
      <Dialog
        open={!!profileStudent}
        onOpenChange={(open) => !open && setProfileStudent(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={profileStudent?.photoUrl} />
                <AvatarFallback className="text-lg">
                  {profileStudent?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div>{profileStudent?.name}</div>
                <div className="text-sm font-normal text-muted-foreground">
                  ID: {profileStudent?.studentId}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>Fee summary and payment history</DialogDescription>
          </DialogHeader>

          {profileStudent && profileFee && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Student details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Class</span>
                      <span className="font-medium">{studentClass?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Academic year</span>
                      <span className="font-medium">{selectedAcademicYear}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium truncate max-w-[200px]">
                        {profileStudent.email}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Fee summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total fees</span>
                      <span className="font-semibold text-green-800">
                        {formatInr(profileFee.totalFees)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid</span>
                      <span className="font-semibold text-blue-800">
                        {formatInr(profileFee.paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outstanding</span>
                      <span className="font-semibold text-orange-800">
                        {formatInr(profileFee.outstandingAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span>Status</span>
                      <Badge variant={statusVariant(profileFee.status)}>
                        {profileFee.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {profileStudent.fees?.breakdown && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Fee breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {(
                        [
                          ['College', profileStudent.fees.breakdown.collegeFees],
                          ['Library', profileStudent.fees.breakdown.libraryFees],
                          ['Hostel', profileStudent.fees.breakdown.hostelFees],
                          ['Exam', profileStudent.fees.breakdown.examFees],
                          ['Transport', profileStudent.fees.breakdown.transportFees],
                          ['Other', profileStudent.fees.breakdown.otherFees],
                        ] as const
                      ).map(([label, val]) =>
                        val ? (
                          <div key={label} className="rounded-md border p-2">
                            <p className="text-muted-foreground text-xs">{label}</p>
                            <p className="font-semibold">{formatInr(val)}</p>
                          </div>
                        ) : null
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Payment history</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {profilePayments.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      No payments recorded yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Receipt</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...profilePayments]
                            .sort(
                              (a, b) =>
                                new Date(b.date).getTime() - new Date(a.date).getTime()
                            )
                            .map((payment) => (
                              <TableRow key={payment.id}>
                                <TableCell>
                                  {format(new Date(payment.date), 'dd MMM yyyy')}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatInr(payment.amount)}
                                </TableCell>
                                <TableCell>{payment.method}</TableCell>
                                <TableCell>{payment.receiptNumber ?? '—'}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handlePrintPayment(profileStudent, payment)
                                    }
                                  >
                                    <Printer className="h-3 w-3 mr-1" />
                                    Print
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setProfileStudent(null)}>
              Close
            </Button>
            {profileStudent && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(getPath(`/students/${profileStudent.id}`))
                  }
                >
                  Full profile
                </Button>
                <Button
                  disabled={
                    profileFee ? profileFee.outstandingAmount <= 0 : true
                  }
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    openPaymentDialog(profileStudent);
                    setProfileStudent(null);
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Add payment
                </Button>
                <Button onClick={() => handlePrintReport(profileStudent)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print full report
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
