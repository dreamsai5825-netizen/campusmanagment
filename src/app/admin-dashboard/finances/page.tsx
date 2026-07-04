'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { filterByAcademicYear } from '@/lib/academic-year-filter';
import { getStudentFeeSummary, formatInr } from '@/lib/student-fees';
import type { Class, Student } from '@/lib/types';
import { BookOpen, Landmark, Users, AlertCircle, IndianRupee } from 'lucide-react';

export default function FinancesPage() {
  const principal = useCurrentPrincipal();
  const { selectedAcademicYear } = useAcademicYear();
  const router = useRouter();
  const { getPath } = useDashboardPath();

  const [classes, setClasses] = useState<Class[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (!principal?.collegeId) {
      setClasses([]);
      setAllStudents([]);
      return;
    }
    const unsubClasses = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
      (snap) => setClasses(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Class)))
    );
    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('collegeId', '==', principal.collegeId)),
      (snap) =>
        setAllStudents(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Student)))
    );
    return () => {
      unsubClasses();
      unsubStudents();
    };
  }, [principal?.collegeId]);

  const students = useMemo(
    () => filterByAcademicYear(allStudents, selectedAcademicYear),
    [allStudents, selectedAcademicYear]
  );

  const classStats = useMemo(() => {
    const map: Record<
      string,
      { studentCount: number; totalCollected: number; totalOutstanding: number }
    > = {};
    classes.forEach((c) => {
      map[c.id] = { studentCount: 0, totalCollected: 0, totalOutstanding: 0 };
    });
    students.forEach((s) => {
      if (!s.classId || !map[s.classId]) return;
      const fee = getStudentFeeSummary(s);
      map[s.classId].studentCount += 1;
      map[s.classId].totalCollected += fee.paidAmount;
      map[s.classId].totalOutstanding += fee.outstandingAmount;
    });
    return map;
  }, [classes, students]);

  const collegeTotals = useMemo(() => {
    return students.reduce(
      (acc, s) => {
        const fee = getStudentFeeSummary(s);
        acc.students += 1;
        acc.collected += fee.paidAmount;
        acc.outstanding += fee.outstandingAmount;
        return acc;
      },
      { students: 0, collected: 0, outstanding: 0 }
    );
  }, [students]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
          <Landmark className="h-7 w-7 text-primary shrink-0" />
          Fee Book
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Select a class to view fee records for {selectedAcademicYear}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/80 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">{collegeTotals.students}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100/80 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Fees Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">
              {formatInr(collegeTotals.collected)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/80 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-700">
              {formatInr(collegeTotals.outstanding)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => {
          const stats = classStats[c.id] ?? {
            studentCount: 0,
            totalCollected: 0,
            totalOutstanding: 0,
          };
          return (
            <Card
              key={c.id}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
              onClick={() => router.push(getPath(`/finances/class/${c.id}`))}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {c.name}
                </CardTitle>
                <CardDescription>{selectedAcademicYear}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{stats.studentCount} students</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-green-700">
                    <IndianRupee className="h-3.5 w-3.5" />
                    Collected
                  </span>
                  <span className="font-semibold">{formatInr(stats.totalCollected)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-orange-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Outstanding
                  </span>
                  <span className="font-semibold">{formatInr(stats.totalOutstanding)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {classes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No classes found.{' '}
              <Link href={getPath('/classes')} className="text-primary underline">
                Add classes
              </Link>{' '}
              first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
