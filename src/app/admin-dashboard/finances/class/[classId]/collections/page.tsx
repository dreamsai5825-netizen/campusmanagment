'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  printPeriodCollectionVoucher,
} from '@/lib/fee-receipt';
import { getCollegeById } from '@/lib/college-service';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Class, College, Student } from '@/lib/types';
import {
  ArrowLeft,
  Calendar,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Receipt,
  Search,
  Users,
  Filter,
  Eye,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

type PeriodType = 'today' | 'week' | 'month' | 'all';

export default function ClassFeeCollectionsPage() {
  const params = useParams();
  const classId = params.classId as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const principal = useCurrentPrincipal();
  const { selectedAcademicYear } = useAcademicYear();
  const { toast } = useToast();
  const { getPath } = useDashboardPath();

  const periodParam = (searchParams.get('period') as PeriodType) || 'today';
  const [activePeriod, setActivePeriod] = useState<PeriodType>(periodParam);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const [studentClass, setStudentClass] = useState<Class | null>(null);
  const [college, setCollege] = useState<College | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActivePeriod(periodParam);
  }, [periodParam]);

  useEffect(() => {
    if (!principal?.collegeId || !classId) return;

    const unsubCollege = onSnapshot(
      doc(db, 'colleges', principal.collegeId),
      (snap) => {
        if (snap.exists()) {
          setCollege({ id: snap.id, ...snap.data() } as College);
        }
      }
    );

    const unsubClass = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const found = snap.docs.find((d) => d.id === classId);
        setStudentClass(found ? ({ ...found.data(), id: found.id } as Class) : null);
      }
    );

    const unsubStudents = onSnapshot(
      query(
        collection(db, 'students'),
        where('collegeId', '==', principal.collegeId),
        where('classId', '==', classId)
      ),
      (snap) => {
        setAllStudents(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Student)));
        setLoading(false);
      }
    );

    return () => {
      unsubCollege();
      unsubClass();
      unsubStudents();
    };
  }, [principal?.collegeId, classId]);

  const students = useMemo(
    () => filterByAcademicYear(allStudents, selectedAcademicYear),
    [allStudents, selectedAcademicYear]
  );

  const receiptCollege = useMemo(
    () => ({
      name: college?.name || 'Institution',
      code: college?.code,
      logoUrl: college?.logoUrl,
      logo2Url: college?.logo2Url,
      address: college?.address,
    }),
    [college]
  );

  // Compute period payments list
  const periodData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

    const allPaymentsList: Array<{ student: Student; payment: FeePaymentRecord }> = [];

    students.forEach((s) => {
      (s.fees?.paymentHistory ?? []).forEach((p) => {
        const t = new Date(p.date).getTime();
        let matchesPeriod = false;

        if (activePeriod === 'today' && t >= todayStart) matchesPeriod = true;
        else if (activePeriod === 'week' && t >= weekStart) matchesPeriod = true;
        else if (activePeriod === 'month' && t >= monthStart) matchesPeriod = true;
        else if (activePeriod === 'all') matchesPeriod = true;

        if (matchesPeriod) {
          allPaymentsList.push({ student: s, payment: p });
        }
      });
    });

    // Sort newest first
    allPaymentsList.sort(
      (a, b) => new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime()
    );

    const totalAmount = allPaymentsList.reduce((sum, item) => sum + item.payment.amount, 0);

    return {
      payments: allPaymentsList,
      totalAmount,
      count: allPaymentsList.length,
    };
  }, [students, activePeriod]);

  // Filtered payments list by search & method
  const filteredPayments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return periodData.payments.filter(({ student, payment }) => {
      const matchesSearch =
        !term ||
        student.name.toLowerCase().includes(term) ||
        student.studentId.toLowerCase().includes(term) ||
        (payment.receiptNumber ?? '').toLowerCase().includes(term);

      const matchesMethod =
        methodFilter === 'all' ||
        (payment.method || 'Cash').toLowerCase() === methodFilter.toLowerCase();

      return matchesSearch && matchesMethod;
    });
  }, [periodData.payments, searchTerm, methodFilter]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredPayments.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'No payment records available to export.',
      });
      return;
    }

    const excelRows = filteredPayments.map(({ student, payment }, idx) => ({
      'Sr. No.': idx + 1,
      'Student Name': student.name,
      'Student ID': student.studentId,
      'Class / Section': studentClass?.name ?? '—',
      'Academic Year': selectedAcademicYear,
      'Payment Date': format(new Date(payment.date), 'dd/MM/yyyy hh:mm a'),
      'Payment Method': payment.method || 'Cash',
      'Receipt Number': payment.receiptNumber || '—',
      'Amount Paid (₹)': payment.amount,
      'Remarks': payment.remarks || '—',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fee Collections');

    const periodLabel = activePeriod.toUpperCase();
    const classNameClean = (studentClass?.name ?? 'Class').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Fee_Collections_${classNameClean}_${periodLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, filename);

    toast({
      title: 'Excel Export Complete',
      description: `Downloaded ${filteredPayments.length} fee record(s) to ${filename}`,
    });
  };

  // Generate Collection Voucher PDF
  const handleGenerateVoucher = () => {
    const periodTitles: Record<PeriodType, string> = {
      today: "Today's Fee Collection List",
      week: "This Week's Fee Collection List (Last 7 Days)",
      month: "This Month's Fee Collection List (Last 30 Days)",
      all: 'All Time Fee Collection History',
    };

    const ok = printPeriodCollectionVoucher({
      college: receiptCollege,
      className: studentClass?.name ?? 'Class',
      academicYear: selectedAcademicYear,
      periodLabel: periodTitles[activePeriod],
      payments: filteredPayments,
    });

    if (!ok) {
      toast({
        variant: 'destructive',
        title: 'Popup blocked',
        description: 'Please allow popups to print/generate the collection voucher.',
      });
      return;
    }

    toast({
      title: 'Collection Voucher Generated',
      description: `Official voucher for ${college?.name || 'College'} opened in print view.`,
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
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={getPath(`/finances/class/${classId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              <Building2 className="h-3.5 w-3.5" />
              {college?.name || 'College'}
            </div>
            <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
              <Calendar className="h-7 w-7 text-primary shrink-0" />
              {studentClass?.name ?? 'Class'} — Fee Collection Report
            </h1>
            <p className="text-muted-foreground text-sm">
              {selectedAcademicYear} · Detailed student fee payment ledger & vouchers
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel (.xlsx)
          </Button>
          <Button
            onClick={handleGenerateVoucher}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
          >
            <FileText className="h-4 w-4" />
            Generate Official Voucher
          </Button>
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-xl border">
          <button
            type="button"
            onClick={() => setActivePeriod('today')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activePeriod === 'today'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Today&apos;s Collection
          </button>
          <button
            type="button"
            onClick={() => setActivePeriod('week')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activePeriod === 'week'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            This Week (7 Days)
          </button>
          <button
            type="button"
            onClick={() => setActivePeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activePeriod === 'month'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            This Month (30 Days)
          </button>
          <button
            type="button"
            onClick={() => setActivePeriod('all')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activePeriod === 'all'
                ? 'bg-slate-800 text-white shadow-sm dark:bg-slate-200 dark:text-slate-900'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-green-800 dark:text-green-300 uppercase tracking-wider flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-600" />
              Total Collection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-green-700 dark:text-green-400">
              {formatInr(periodData.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Accumulated in {activePeriod.toUpperCase()} period
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-600" />
              Fee Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-blue-700 dark:text-blue-400">
              {periodData.count} <span className="text-base font-normal text-muted-foreground">payments</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Verified fee receipts recorded
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Unique Paying Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-purple-700 dark:text-purple-400">
              {new Set(periodData.payments.map((p) => p.student.id)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Students cleared fee installments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search student name, ID, or receipt number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Payment Modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payment Modes</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="online">Online / UPI</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="bank transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Payment Table Card */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white flex flex-row items-center justify-between p-5">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Fee Payment Entries ({filteredPayments.length})
            </CardTitle>
            <CardDescription className="text-blue-100 text-xs mt-0.5">
              Showing student fee payments for {selectedAcademicYear}
            </CardDescription>
          </div>
          <Badge className="bg-white/20 text-white border-none font-mono text-xs px-3 py-1">
            {college?.name || 'Institution'}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPayments.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-base">No fee payments found for this period.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try switching the period filter or adjusting your search parameters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Student Details</TableHead>
                    <TableHead>Payment Date & Time</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Receipt / Voucher No.</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(({ student, payment }, idx) => {
                    const avatarImg = PlaceHolderImages.find((img) => img.id === 'student-avatar');
                    return (
                      <TableRow key={payment.id || `${student.id}-${idx}`}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border">
                              <AvatarImage src={student.photoUrl ?? avatarImg?.imageUrl} alt={student.name} />
                              <AvatarFallback>{student.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-foreground">{student.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                ID: {student.studentId}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(payment.date), 'dd MMM yyyy, hh:mm a')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                            {payment.method || 'Cash'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                          {payment.receiptNumber || '—'}
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-emerald-600 text-base">
                          {formatInr(payment.amount)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              title="Print Receipt"
                              onClick={() => handlePrintPayment(student, payment)}
                              className="h-8 px-2.5 text-xs gap-1"
                            >
                              <Receipt className="h-3.5 w-3.5 text-primary" />
                              Receipt
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              title="Generate Single Voucher"
                              onClick={() =>
                                printPeriodCollectionVoucher({
                                  college: receiptCollege,
                                  className: studentClass?.name ?? 'Class',
                                  academicYear: selectedAcademicYear,
                                  periodLabel: `Single Payment Receipt (${student.name})`,
                                  payments: [{ student, payment }],
                                })
                              }
                              className="h-8 px-2.5 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Voucher
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
    </div>
  );
}
