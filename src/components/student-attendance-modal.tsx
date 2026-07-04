'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subject } from '@/lib/types';

interface AttendanceRecord {
  id: string;
  date: string;
  subjectId: string;
  subjectName: string;
  status: 'present' | 'absent' | 'cancelled';
}

interface AttendanceBySubject {
  subjectId: string;
  subjectName: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface StudentAttendanceModalProps {
  studentId: string;
  studentName: string;
  teacherSubjectIds?: string[];
  allSubjects: Subject[];
  viewAll?: boolean;
  children?: React.ReactNode;
}

export function StudentAttendanceModal({
  studentId,
  studentName,
  teacherSubjectIds = [],
  allSubjects,
  viewAll = false,
}: StudentAttendanceModalProps) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [bySubject, setBySubject] = useState<AttendanceBySubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const subjectIdsKey = teacherSubjectIds.join(',');

  useEffect(() => {
    console.log('[StudentAttendanceModal] useEffect triggered', {
      open,
      studentId,
      viewAll,
      subjectIdsKey,
      allSubjectsLength: allSubjects.length,
    });

    if (!open || (!viewAll && subjectIdsKey === '')) {
      console.log('[StudentAttendanceModal] Early return condition met');
      return;
    }

    const loadAttendance = async () => {
      console.log('[StudentAttendanceModal] loadAttendance starting');
      setLoading(true);
      setError(null);
      try {
        // Query attendance records for this student
        const q = viewAll
          ? query(
              collection(db, 'attendanceRecords'),
              where('studentId', '==', studentId)
            )
          : query(
              collection(db, 'attendanceRecords'),
              where('studentId', '==', studentId),
              where('subjectId', 'in', teacherSubjectIds.length > 0 ? teacherSubjectIds : [''])
            );
        
        console.log('[StudentAttendanceModal] Executing Firestore query...', q);
        const snap = await getDocs(q);
        console.log('[StudentAttendanceModal] Firestore query completed. Snap size:', snap.size);
        
        const allRecords: AttendanceRecord[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          const subjectId = data.subjectId || '';
          const subject = allSubjects.find((s) => s.id === subjectId);
          allRecords.push({
            id: doc.id,
            date: data.date || '',
            subjectId,
            subjectName: subject?.name || 'Unknown Subject',
            status: data.status || 'absent',
          });
        });

        // Sort by date descending
        allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecords(allRecords);

        // Calculate by subject
        const subjectMap = new Map<string, AttendanceBySubject>();
        allRecords.forEach((record) => {
          if (!subjectMap.has(record.subjectId)) {
            subjectMap.set(record.subjectId, {
              subjectId: record.subjectId,
              subjectName: record.subjectName,
              present: 0,
              absent: 0,
              total: 0,
              percentage: 0,
            });
          }
          const entry = subjectMap.get(record.subjectId)!;
          // Don't count cancelled classes in total
          if (record.status !== 'cancelled') {
            entry.total += 1;
            if (record.status === 'present') {
              entry.present += 1;
            } else {
              entry.absent += 1;
            }
          }
          entry.percentage = entry.total > 0 ? (entry.present / entry.total) * 100 : 0;
        });

        const calculatedSubjects = Array.from(subjectMap.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
        console.log('[StudentAttendanceModal] Calculation done. bySubject:', calculatedSubjects);
        setBySubject(calculatedSubjects);
      } catch (err) {
        console.error('[StudentAttendanceModal] Error loading attendance:', err);
        setError('Failed to load attendance records');
      } finally {
        console.log('[StudentAttendanceModal] loadAttendance finished');
        setLoading(false);
      }
    };

    loadAttendance();
  }, [open, studentId, subjectIdsKey, allSubjects, viewAll]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start h-auto p-4" onClick={() => setOpen(true)}>
          View Full Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance Record - {studentName}</DialogTitle>
          <DialogDescription>
            {viewAll
              ? 'Complete attendance record across all subjects'
              : 'Complete attendance record across all subjects you teach'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {/* Summary by Subject */}
            {bySubject.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Summary by Subject</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Present</TableHead>
                        <TableHead className="text-right">Absent</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bySubject.map((summary) => (
                        <TableRow key={summary.subjectId}>
                          <TableCell className="font-medium">
                            {summary.subjectName}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {summary.present}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {summary.absent}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {summary.total}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={summary.percentage >= 75 ? 'default' : 'destructive'}
                              className="font-mono"
                            >
                              {summary.percentage.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Detailed Records - Traditional Attendance Sheet */}
            {records.length > 0 && (
              <div>
                <div className="flex items-end gap-4 mb-6">
                  <div className="flex-1">
                    <Label htmlFor="from-date" className="text-sm font-medium mb-2 block">
                      From Date
                    </Label>
                    <Input
                      id="from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="to-date" className="text-sm font-medium mb-2 block">
                      To Date
                    </Label>
                    <Input
                      id="to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                    }}
                  >
                    Reset
                  </Button>
                </div>

                {/* Filter records based on date range */}
                {(() => {
                  const filteredRecords = records.filter((record) => {
                    const recordDate = new Date(record.date);
                    const from = fromDate ? new Date(fromDate) : null;
                    const to = toDate ? new Date(toDate) : null;

                    if (from && recordDate < from) return false;
                    if (to) {
                      const toDateIncluded = new Date(to);
                      toDateIncluded.setHours(23, 59, 59, 999);
                      if (recordDate > toDateIncluded) return false;
                    }
                    return true;
                  });

                  if (filteredRecords.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        No attendance records found in the selected date range.
                      </div>
                    );
                  }

                  return (
                    <div className="border rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="border p-3 text-left font-semibold min-w-40">Subject</th>
                            {/* Get unique dates sorted chronologically */}
                            {Array.from(new Set(filteredRecords.map((r) => r.date)))
                              .sort()
                              .map((date) => (
                                <th key={date} className="border p-2 text-center font-semibold min-w-24">
                                  <div className="text-xs">
                                    {new Date(date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </div>
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Get unique subjects sorted alphabetically */}
                          {Array.from(new Set(filteredRecords.map((r) => r.subjectId)))
                            .map((subjectId) => filteredRecords.find((r) => r.subjectId === subjectId)?.subjectName || '')
                            .filter(Boolean)
                            .sort()
                            .map((subjectName) => (
                              <tr key={subjectName}>
                                <td className="border p-3 font-medium bg-muted/50">
                                  {subjectName}
                                </td>
                                {/* Get unique dates sorted chronologically */}
                                {Array.from(new Set(filteredRecords.map((r) => r.date)))
                                  .sort()
                                  .map((date) => {
                                    const record = filteredRecords.find(
                                      (r) => r.date === date && r.subjectName === subjectName
                                    );
                                    return (
                                      <td key={`${subjectName}-${date}`} className="border p-2 text-center">
                                        {record ? (
                                          record.status === 'present' ? (
                                            <div className="flex items-center justify-center">
                                              <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                                                <Check className="h-4 w-4 text-green-600" />
                                              </div>
                                            </div>
                                          ) : record.status === 'cancelled' ? (
                                            <span className="text-yellow-600 font-bold text-lg">—</span>
                                          ) : (
                                            <div className="flex items-center justify-center">
                                              <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
                                                <X className="h-4 w-4 text-red-600" />
                                              </div>
                                            </div>
                                          )
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {!loading && records.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {viewAll
                  ? 'No attendance records found for this student.'
                  : 'No attendance records found for this student in your subjects.'}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
