'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { College, Class, Student } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStudentFeeSummary, formatInr } from '@/lib/student-fees';
import { ArrowLeft, Landmark, FileSpreadsheet, AlertCircle, CheckCircle2, CircleDollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

export default function CollegeFinancesPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!collegeId) return;

    const fetchData = async () => {
      try {
        // Fetch college
        const collegeSnap = await getDoc(doc(db, 'colleges', collegeId));
        if (collegeSnap.exists()) {
          setCollege({ id: collegeSnap.id, ...collegeSnap.data() } as College);
        }

        // Fetch classes
        const classesSnap = await getDocs(
          query(collection(db, 'classes'), where('collegeId', '==', collegeId))
        );
        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));

        // Fetch students
        const studentsSnap = await getDocs(
          query(collection(db, 'students'), where('collegeId', '==', collegeId))
        );
        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));

      } catch (error) {
        console.error('Error fetching financial details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collegeId]);

  const classStats = useMemo(() => {
    const map: Record<string, { studentCount: number; collected: number; outstanding: number; total: number }> = {};
    
    classes.forEach(c => {
      map[c.id] = { studentCount: 0, collected: 0, outstanding: 0, total: 0 };
    });

    students.forEach(s => {
      if (!s.classId || !map[s.classId]) return;
      const fee = getStudentFeeSummary(s);
      map[s.classId].studentCount += 1;
      map[s.classId].collected += fee.paidAmount;
      map[s.classId].outstanding += fee.outstandingAmount;
      map[s.classId].total += fee.totalFees;
    });

    return map;
  }, [classes, students]);

  const totals = useMemo(() => {
    return students.reduce(
      (acc, s) => {
        const fee = getStudentFeeSummary(s);
        acc.students += 1;
        acc.collected += fee.paidAmount;
        acc.outstanding += fee.outstandingAmount;
        acc.total += fee.totalFees;
        return acc;
      },
      { students: 0, collected: 0, outstanding: 0, total: 0 }
    );
  }, [students]);

  const handleExportExcel = () => {
    if (students.length === 0) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'No student records to export.' });
      return;
    }
    setExporting(true);
    try {
      const headers = ['Class Name', 'Student Count', 'Total Fees (₹)', 'Collected Fees (₹)', 'Outstanding Fees (₹)'];
      const rows = classes.map(c => {
        const stats = classStats[c.id] || { studentCount: 0, total: 0, collected: 0, outstanding: 0 };
        return [
          c.name,
          stats.studentCount,
          stats.total,
          stats.collected,
          stats.outstanding
        ];
      });

      // Add a total row
      rows.push([
        'TOTAL',
        totals.students,
        totals.total,
        totals.collected,
        totals.outstanding
      ]);

      const excelData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Financial Summary');

      const fileName = `${college?.name.replace(/\s+/g, '-')}-Financial-Summary.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({ title: 'Export Successful', description: `Financial summary exported to ${fileName}` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'An error occurred during export.' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-sm text-muted-foreground">{college?.name} / Finances</div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">Fee Book Summary</h1>
          </div>
        </div>

        <Button 
          onClick={handleExportExcel} 
          disabled={exporting || classes.length === 0}
          className="sm:w-auto w-full gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export Financial Summary'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/80 border-blue-200 dark:from-blue-950/20 dark:to-blue-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Revenue Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
              {formatInr(totals.total)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100/80 border-green-200 dark:from-green-950/20 dark:to-green-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">Total Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatInr(totals.collected)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/80 border-orange-200 dark:from-orange-950/20 dark:to-orange-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-300">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">
              {formatInr(totals.outstanding)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Roster / Classes Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Class-wise Fee Breakdown
          </CardTitle>
          <CardDescription>
            Financial overview grouped by active classrooms.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class Name</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Total Fee Setup</TableHead>
                  <TableHead>Total Collected</TableHead>
                  <TableHead>Total Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.length > 0 ? (
                  classes.map((c) => {
                    const stats = classStats[c.id] || { studentCount: 0, total: 0, collected: 0, outstanding: 0 };
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold">{c.name}</TableCell>
                        <TableCell>{stats.studentCount}</TableCell>
                        <TableCell className="font-mono">{formatInr(stats.total)}</TableCell>
                        <TableCell className="font-mono text-emerald-600 font-semibold">{formatInr(stats.collected)}</TableCell>
                        <TableCell className="font-mono text-orange-600 font-semibold">{formatInr(stats.outstanding)}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No financial data available for classes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
