'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, BookOpenCheck, Check, X, Download, CalendarRange, BookOpen, Minus } from 'lucide-react';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { collection, onSnapshot, query, where, setDoc, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import type { Class, Student, Subject } from '@/lib/types';
import { getClassSubjectNames, getClassSubjectsDisplay } from '@/lib/subject-utils';
import { getCollegeById } from '@/lib/college-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AttendanceStatus = 'present' | 'absent' | 'cancelled';

const getTodayStr = () => new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const teacher = useCurrentTeacher();
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [existingAttendanceStatus, setExistingAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [justMarked, setJustMarked] = useState<{ studentId: string; status: AttendanceStatus } | null>(null);
  const { toast } = useToast();
  const [collegeName, setCollegeName] = useState<string>('');

  const collegeId = teacher?.collegeId ?? null;
  const teacherId = teacher?.id ?? null;

  useEffect(() => {
    if (!collegeId) {
      setCollegeName('');
      return;
    }
    let mounted = true;
    getCollegeById(collegeId)
      .then((c) => {
        if (!mounted) return;
        setCollegeName(c?.name ?? '');
      })
      .catch(() => {
        if (!mounted) return;
        setCollegeName('');
      });
    return () => {
      mounted = false;
    };
  }, [collegeId]);

  useEffect(() => {
    if (!justMarked) return;
    const t = setTimeout(() => setJustMarked(null), 600);
    return () => clearTimeout(t);
  }, [justMarked]);

  useEffect(() => {
    if (!collegeId) {
      setClasses([]);
      return;
    }
    const q = query(
      collection(db, 'classes'),
      where('collegeId', '==', collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });
    return () => unsub();
  }, [collegeId]);

  useEffect(() => {
    if (!collegeId) {
      setStudents([]);
      return;
    }
    const q = query(
      collection(db, 'students'),
      where('collegeId', '==', collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
    });
    return () => unsub();
  }, [collegeId]);

  useEffect(() => {
    if (!teacherId) {
      setAssignedClassIds([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'teachers', teacherId, 'assignedClasses'),
      (snap) => {
        setAssignedClassIds(snap.docs.map((d) => d.id));
      }
    );
    return () => unsub();
  }, [teacherId]);

  useEffect(() => {
    if (!collegeId) {
      setAllSubjects([]);
      return;
    }
    const q = query(
      collection(db, 'subjects'),
      where('collegeId', '==', collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
    });
    return () => unsub();
  }, [collegeId]);

  const assignedClasses = classes.filter((c) => assignedClassIds.includes(c.id));
  const selectedClass = assignedClasses.find((c) => c.id === selectedClassId);
  const subjectsForSelectedClass: Subject[] = selectedClass && allSubjects.length
    ? (selectedClass.subjectIds ?? [])
        .map((id) => allSubjects.find((s) => s.id === id))
        .filter((s): s is Subject => Boolean(s))
    : [];
  const subjectsTeacherTeachesForClass = subjectsForSelectedClass.filter(
    (s) => !teacher?.subjectIds?.length || teacher.subjectIds.includes(s.id)
  );
  const subjectCardsToShow = subjectsTeacherTeachesForClass.length
    ? subjectsTeacherTeachesForClass
    : subjectsForSelectedClass.length
      ? subjectsForSelectedClass
      : [];

  const studentsInClass = useMemo(
    () =>
      students
        .filter((s) => s.classId === selectedClassId)
        .slice()
        .sort((a, b) => (a.studentId ?? '').localeCompare(b.studentId ?? '')),
    [students, selectedClassId]
  );
  const getStudentCountForClass = (classId: string) =>
    students.filter((s) => s.classId === classId).length;

  const getStatus = (studentId: string): AttendanceStatus =>
    attendanceStatus[studentId] ?? 'present';

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendanceStatus((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSetStatus = (student: Student, status: AttendanceStatus) => {
    setStatus(student.id, status);
    setJustMarked({ studentId: student.id, status });
  };

  const handleResetAttendance = () => {
    setAttendanceStatus({});
    setJustMarked(null);
  };

  const handleCancelClass = () => {
    const newStatus: Record<string, AttendanceStatus> = {};
    studentsInClass.forEach((student) => {
      newStatus[student.id] = 'cancelled';
    });
    setAttendanceStatus(newStatus);
    setJustMarked(null);
  };

  useEffect(() => {
    const loadExistingAttendance = async () => {
      if (!selectedClassId || !selectedSubjectId || !selectedDate) {
        setAttendanceStatus({});
        setExistingAttendanceStatus({});
        return;
      }
      try {
        const qExisting = query(
          collection(db, 'attendanceRecords'),
          where('date', '==', selectedDate),
          where('classId', '==', selectedClassId),
          where('subjectId', '==', selectedSubjectId)
        );
        const snap = await getDocs(qExisting);
        console.log(`[Load Attendance] Found ${snap.size} records for date=${selectedDate}, classId=${selectedClassId}, subjectId=${selectedSubjectId}`);
        
        if (snap.empty) {
          setAttendanceStatus({});
          setExistingAttendanceStatus({});
          return;
        }
        const byStudent: Record<string, AttendanceStatus> = {};
        snap.forEach((d) => {
          const data = d.data() as { studentId?: string; studentName?: string; status?: AttendanceStatus };
          if (data.studentId) {
            byStudent[data.studentId] = data.status as AttendanceStatus;
            console.log(`[Load Attendance] Loaded ${data.studentName} (${data.studentId}): ${data.status}`);
          }
        });
        setAttendanceStatus(byStudent);
        setExistingAttendanceStatus(byStudent);
      } catch (e) {
        console.error('[Load Attendance Error]', e);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load existing attendance for this date.',
        });
      }
    };

    loadExistingAttendance();
  }, [selectedClassId, selectedSubjectId, selectedDate, toast]);

  const handleSubmitAttendance = async () => {
    if (!selectedClass || !selectedSubjectId || !teacher?.collegeId) return;
    if (!selectedDate) {
      toast({
        variant: 'destructive',
        title: 'No date selected',
        description: 'Please choose a date for this attendance.',
      });
      return;
    }
    
    const subject = allSubjects.find((sub) => sub.id === selectedSubjectId);
    const subjectName = subject?.name ?? 'Subject';
    setSubmitLoading(true);
    try {
      const date = selectedDate;
      const existingQ = query(
        collection(db, 'attendanceRecords'),
        where('date', '==', date),
        where('classId', '==', selectedClass.id),
        where('subjectId', '==', selectedSubjectId)
      );
      const existingSnap = await getDocs(existingQ);
      const existingByStudent: Record<string, AttendanceStatus> = {};
      existingSnap.forEach((d) => {
        const data = d.data() as { studentId?: string; status?: AttendanceStatus };
        if (data.studentId && (data.status === 'present' || data.status === 'absent')) {
          existingByStudent[data.studentId] = data.status;
        }
      });

      const normalizeForSummary = (status: AttendanceStatus | undefined) => {
        if (status === 'present' || status === 'absent') return status;
        // Cancelled or "unmarked" should not affect present/absent counts.
        return undefined;
      };

      const computeDeltas = (
        prevStatus: AttendanceStatus | undefined,
        nextStatus: AttendanceStatus | undefined
      ) => {
        let deltaPresent = 0;
        let deltaAbsent = 0;
        let deltaTotalDays = 0;

        if (!prevStatus && nextStatus) {
          // New record for this date
          deltaTotalDays = 1;
          if (nextStatus === 'present') deltaPresent = 1;
          if (nextStatus === 'absent') deltaAbsent = 1;
        } else if (prevStatus && !nextStatus) {
          // Record removed / changed to cancelled
          deltaTotalDays = -1;
          if (prevStatus === 'present') deltaPresent = -1;
          if (prevStatus === 'absent') deltaAbsent = -1;
        } else if (prevStatus && nextStatus && prevStatus !== nextStatus) {
          // Change existing record (present <-> absent)
          if (prevStatus === 'present' && nextStatus === 'absent') {
            deltaPresent = -1;
            deltaAbsent = 1;
          } else if (prevStatus === 'absent' && nextStatus === 'present') {
            deltaPresent = 1;
            deltaAbsent = -1;
          }
        }

        return { deltaPresent, deltaAbsent, deltaTotalDays };
      };

      // Only process students that were explicitly marked
      const markedStudentIds = Object.keys(attendanceStatus);
      for (const s of studentsInClass) {
        if (!markedStudentIds.includes(s.id)) {
          const docId = `${date}_${selectedClass.id}_${selectedSubjectId}_${s.id}`;
          // If a student was previously marked but is now "unmarked" (e.g. after Reset All),
          // remove the old attendance record so exports don't include stale data.
          await deleteDoc(doc(db, 'attendanceRecords', docId));
          continue;
        }
        
        const docId = `${date}_${selectedClass.id}_${selectedSubjectId}_${s.id}`;
        const status = attendanceStatus[s.id];
        console.log(`[Save Attendance] Saving ${s.name} (${s.id}): status=${status} to docId=${docId}`);
        await setDoc(doc(db, 'attendanceRecords', docId), {
          date,
          classId: selectedClass.id,
          className: selectedClass.name,
          subjectId: selectedSubjectId,
          subjectName,
          collegeId: teacher.collegeId,
          studentId: s.id,
          studentName: s.name,
          studentStudentId: s.studentId,
          status,
        });
      }
      
      // Update summaries for all students whose summary-relevant status changed
      for (const s of studentsInClass) {
        const prevStatus = existingByStudent[s.id];
        const nextStatusRaw = markedStudentIds.includes(s.id) ? attendanceStatus[s.id] : undefined;
        const nextStatus = normalizeForSummary(nextStatusRaw);
        const prevStatusForSummary = normalizeForSummary(prevStatus);
        const { deltaPresent, deltaAbsent, deltaTotalDays } = computeDeltas(prevStatusForSummary, nextStatus);
        if (!deltaPresent && !deltaAbsent && !deltaTotalDays) {
          // No change for this student
          continue;
        }
        const cur = s.attendance?.summary ?? { present: 0, absent: 0, totalDays: 0 };
        const existingBySubject = s.attendance?.bySubject ?? [];
        const subjectEntry = existingBySubject.find((e) => e.subject === subjectName);
        const prevEntry = subjectEntry ?? { subject: subjectName, present: 0, absent: 0, total: 0 };

        const updatedSummary = {
          present: Math.max(0, cur.present + deltaPresent),
          absent: Math.max(0, cur.absent + deltaAbsent),
          totalDays: Math.max(0, cur.totalDays + deltaTotalDays),
        };

        const updatedSubjectEntry = {
          subject: subjectName,
          present: Math.max(0, prevEntry.present + deltaPresent),
          absent: Math.max(0, prevEntry.absent + deltaAbsent),
          total: Math.max(0, prevEntry.total + deltaTotalDays),
        };

        const bySubject = subjectEntry
          ? existingBySubject.map((e) =>
              e.subject === subjectName
                ? updatedSubjectEntry
                : e
            )
          : [
              ...existingBySubject,
              updatedSubjectEntry,
            ];
        await updateDoc(doc(db, 'students', s.id), {
          attendance: {
            summary: updatedSummary,
            bySubject,
          },
        });
      }
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 2500);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save attendance.' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleExportAttendance = async () => {
    if (!selectedClass || !selectedSubjectId || !selectedDate) return;

    setExportLoading(true);
    try {
      // Query attendance records directly from database to ensure fresh data
      const qExisting = query(
        collection(db, 'attendanceRecords'),
        where('date', '==', selectedDate),
        where('classId', '==', selectedClass.id),
        where('subjectId', '==', selectedSubjectId)
      );
      const snap = await getDocs(qExisting);
      
      console.log(`[Export Today] Found ${snap.size} records for date=${selectedDate}, classId=${selectedClass.id}, subjectId=${selectedSubjectId}`);
      
      const byStudent: Record<string, AttendanceStatus> = {};
      snap.forEach((d) => {
        const data = d.data() as { studentId?: string; studentName?: string; status?: AttendanceStatus };
        if (data.studentId) {
          byStudent[data.studentId] = data.status as AttendanceStatus;
          console.log(`[Export Today] Student ${data.studentName} (${data.studentId}): ${data.status}`);
        }
      });

      const dateStr = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', { dateStyle: 'long' });
      const rows: (string | number)[][] = [
        ['Class', selectedClass.name],
        ['Date', dateStr],
        [],
        ['Student Name', 'Student ID', 'Status'],
        ...studentsInClass.map((s) => [
          s.name,
          s.studentId,
          (byStudent[s.id] ?? 'NOT MARKED').toUpperCase(),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance-${selectedClass.name.replace(/\s+/g, '-')}-${selectedDate}.xlsx`);
      
      toast({
        title: 'Exported',
        description: `Attendance exported for ${selectedClass.name}.`,
      });
    } catch (error) {
      console.error('[Export Today Error]', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to export attendance.',
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportByDateRange = async () => {
    if (!selectedClass || !selectedSubjectId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a class and subject.' });
      return;
    }
    if (!exportFromDate || !exportToDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select From date and To date.' });
      return;
    }
    if (exportFromDate > exportToDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'From date must be before or equal to To date.' });
      return;
    }
    setExportLoading(true);
    try {
      const selectedSubject = allSubjects.find((s) => s.id === selectedSubjectId);
      const subjectName = selectedSubject?.name ?? '';
      const subjectCode = ''; // no input/field available; keep empty
      const courseCode = ''; // no input/field available; keep empty

      const fromYm = exportFromDate.slice(0, 7);
      const toYm = exportToDate.slice(0, 7);
      const monthLabel =
        fromYm && toYm && fromYm === toYm
          ? new Date(`${fromYm}-01T00:00:00`).toLocaleString(undefined, { month: 'long', year: 'numeric' })
          : 'Multiple';

      const q = query(
        collection(db, 'attendanceRecords'),
        where('classId', '==', selectedClass.id),
        where('subjectId', '==', selectedSubjectId)
      );
      const snap = await getDocs(q);
      const records = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as unknown as { date: string; studentId: string; status: string }))
        .filter((r) => r.date >= exportFromDate && r.date <= exportToDate);

      // Build a month-style sheet:
      // Col1: Serial (based on last digits of USN/Student ID)
      // Col2: Student Name
      // Col3..33: 1..31 (P for present, blank for absent)
      const getSerialFromUsn = (usn?: string) => {
        const raw = (usn ?? '').trim();
        const m = raw.match(/(\d+)\s*$/);
        if (!m?.[1]) return '';
        const n = Number.parseInt(m[1], 10);
        if (!Number.isFinite(n)) return '';
        // 0001 -> 01, 0050 -> 50
        return String(n).padStart(2, '0');
      };

      const byStudentDay = new Map<string, Map<number, 'P' | '—' | ''>>();
      for (const r of records) {
        // `attendanceRecords.date` is expected to be `YYYY-MM-DD` (optionally with a time suffix).
        // Parse defensively so we don't shift day numbers and misplace marks in the export.
        const datePart = (r.date ?? '').slice(0, 10);
        const day = Number.parseInt(datePart.split('-')[2] ?? '', 10);
        if (!Number.isFinite(day) || day < 1 || day > 31) continue;
        const perStudent = byStudentDay.get(r.studentId) ?? new Map<number, 'P' | '—' | ''>();
        // Present => "P", Cancelled => "—", Absent => empty
        const status = (r.status ?? '').toLowerCase();
        let mark: 'P' | '—' | '' = '';
        if (status === 'present') {
          mark = 'P';
        } else if (status === 'cancelled') {
          mark = '—';
        }
        perStudent.set(day, mark);
        byStudentDay.set(r.studentId, perStudent);
      }

      // Use current class roster for names/USN (includes students with no records).
      const roster = studentsInClass
        .map((s) => {
          const usn = s.usn || s.studentId || '';
          return {
            id: s.id,
            name: s.name ?? '',
            usn,
            serial: getSerialFromUsn(usn),
            serialNum: (() => {
              const m = (usn ?? '').trim().match(/(\d+)\s*$/);
              return m?.[1] ? Number.parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
            })(),
          };
        })
        .sort((a, b) => a.serialNum - b.serialNum || a.name.localeCompare(b.name));

      const dayHeaders = Array.from({ length: 31 }, (_, i) => String(i + 1));
      const headerRow: (string | number)[] = ['Sl. No', 'Student Name', ...dayHeaders];
      const dataRows: (string | number)[][] = roster.map((s) => {
        const perStudent = byStudentDay.get(s.id) ?? new Map<number, 'P' | '—' | ''>();
        const marks = Array.from({ length: 31 }, (_, i) => perStudent.get(i + 1) ?? '');
        return [s.serial, s.name, ...marks];
      });

      const rows: (string | number)[][] = [
        ['College Name', collegeName || '—'],
        ['Faculty Name', teacher?.name ?? '—'],
        ['Class', selectedClass.name],
        ['Subject', subjectName || '—'],
        ['Subject Code', subjectCode],
        ['Course Code', courseCode],
        ['Month', monthLabel],
        ['From', exportFromDate],
        ['To', exportToDate],
        [],
        headerRow,
        ...dataRows,
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `attendance-${selectedClass.name.replace(/\s+/g, '-')}-${exportFromDate}-to-${exportToDate}.xlsx`);
      toast({ title: 'Exported', description: `${roster.length} student(s) exported.` });
      setExportDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to export attendance.' });
    } finally {
      setExportLoading(false);
    }
  };

  // Subject selection view: class selected, show assigned subjects as clickable cards
  if (selectedClass && !selectedSubjectId) {
    return (
      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setSelectedClassId(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-headline tracking-tight sm:text-3xl">
              {selectedClass.name} — Select subject
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Choose a subject to mark attendance for this class.
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {subjectCardsToShow.length === 0 ? (
            <Card className="md:col-span-2 xl:col-span-3 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="font-medium text-muted-foreground">
                  No subjects assigned to you for this class
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  You are assigned to this class but no subjects in this class match your assigned subjects. Contact your principal to update assignments.
                </p>
              </CardContent>
            </Card>
          ) : (
            subjectCardsToShow.map((sub) => (
              <Card
                key={sub.id}
                className="flex flex-col cursor-pointer transform transition-transform duration-300 hover:scale-105 hover:shadow-xl"
                onClick={() => setSelectedSubjectId(sub.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{sub.name}</CardTitle>
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardDescription>
                    Class: {selectedClass.name} | Students: {studentsInClass.length}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    Click to open the attendance sheet for this subject.
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // Attendance table view: class + subject selected
  if (selectedClass && selectedSubjectId) {
    return (
      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setSelectedSubjectId(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold font-headline tracking-tight sm:text-3xl">
                Attendance for {selectedClass.name}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {selectedDate
                  ? `Mark attendance for ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                      dateStyle: 'long',
                    })}`
                  : 'Select a date below to mark attendance.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="attendance-date" className="text-sm">
                Attendance date
              </Label>
              <Input
                id="attendance-date"
                type="date"
                value={selectedDate}
                max={getTodayStr()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[170px]"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleCancelClass}
              className="gap-2"
              title="Mark the entire class as cancelled"
            >
              <Minus className="h-4 w-4" /> Cancel Class
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsInClass.map((student) => {
                  const studentImage = PlaceHolderImages.find(p => p.id === student.id);
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {studentImage && (
                            <Image
                              src={studentImage.imageUrl}
                              alt={student.name}
                              width={32}
                              height={32}
                              className="rounded-full"
                            />
                          )}
                          <span>{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{student.studentId}</TableCell>
                      <TableCell className="text-right align-middle">
                        <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                          <div
                            className={`attendance-cube-scene transition-all duration-300 ${
                              justMarked?.studentId === student.id && justMarked?.status === 'present'
                                ? 'ring-2 ring-green-500 ring-offset-2 scale-105 rounded'
                                : ''
                            }`}
                          >
                            <div
                              className="attendance-cube attendance-cube--present"
                              onClick={() => handleSetStatus(student, 'present')}
                              onKeyDown={(e) => e.key === 'Enter' && handleSetStatus(student, 'present')}
                              role="button"
                              tabIndex={0}
                              data-selected={attendanceStatus[student.id] === 'present'}
                              aria-pressed={attendanceStatus[student.id] === 'present'}
                              aria-label="Mark Present"
                            >
                              <span className="attendance-cube-side attendance-cube-top">Present</span>
                              <span className="attendance-cube-side attendance-cube-front">Mark</span>
                            </div>
                          </div>
                          <div
                            className={`attendance-cube-scene transition-all duration-300 ${
                              justMarked?.studentId === student.id && justMarked?.status === 'absent'
                                ? 'ring-2 ring-destructive ring-offset-2 scale-105 rounded'
                                : ''
                            }`}
                          >
                            <div
                              className="attendance-cube attendance-cube--absent"
                              onClick={() => handleSetStatus(student, 'absent')}
                              onKeyDown={(e) => e.key === 'Enter' && handleSetStatus(student, 'absent')}
                              role="button"
                              tabIndex={0}
                              data-selected={attendanceStatus[student.id] === 'absent'}
                              aria-pressed={attendanceStatus[student.id] === 'absent'}
                              aria-label="Mark Absent"
                            >
                              <span className="attendance-cube-side attendance-cube-top">Absent</span>
                              <span className="attendance-cube-side attendance-cube-front">Mark</span>
                            </div>
                          </div>

                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={handleExportAttendance} 
              disabled={submitLoading}
              className="gap-2"
            >
              {exportLoading ? (
                <>
                  <Download className="h-4 w-4 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Export Today
                </>
              )}
            </Button>
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarRange className="h-4 w-4" /> Export by date range
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Export attendance by date range</DialogTitle>
                  <DialogDescription>
                    Choose From date and To date. Only saved attendance (after Submit) in this range will be exported.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="export-from">From date</Label>
                    <Input
                      id="export-from"
                      type="date"
                      value={exportFromDate}
                      onChange={(e) => setExportFromDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="export-to">To date</Label>
                    <Input
                      id="export-to"
                      type="date"
                      value={exportToDate}
                      onChange={(e) => setExportToDate(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleExportByDateRange} disabled={exportLoading} className="gap-2">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={handleResetAttendance}
              className="gap-2"
            >
              Reset All
            </Button>
            <Button
              onClick={handleSubmitAttendance}
              disabled={submitLoading}
              className={`transition-all duration-300 ${
                submitSuccess
                  ? 'bg-green-600 hover:bg-green-600 scale-105 ring-2 ring-green-400 ring-offset-2'
                  : ''
              }`}
            >
              {submitLoading ? (
                'Saving…'
              ) : submitSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-2" /> Saved
                </>
              ) : (
                'Submit Attendance'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Mark Attendance
          </h1>
          <p className="text-muted-foreground">
            Loading your profile…
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpenCheck className="h-12 w-12 text-muted-foreground/50 mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading attendance page…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          Mark Attendance
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Select a class to start marking attendance.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {assignedClasses.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpenCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-muted-foreground">
                No classes assigned to you yet
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Contact your principal to assign classes to you. Once assigned, your classes will appear here so you can mark attendance.
              </p>
            </CardContent>
          </Card>
        ) : (
          assignedClasses.map((c) => (
            <Card
              key={c.id}
              className="flex flex-col cursor-pointer transform transition-transform duration-300 hover:scale-105 hover:shadow-xl"
              onClick={() => setSelectedClassId(c.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{c.name}</CardTitle>
                  <BookOpenCheck className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardDescription>
                  Subjects: {getClassSubjectsDisplay(c, allSubjects)} | Students: {getStudentCountForClass(c.id)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Click to see your assigned subjects and mark attendance.
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
