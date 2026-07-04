'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClipboardList, Search, Eye, BookOpen, User, Calendar, Paperclip } from 'lucide-react';
import type { Assignment, AssignmentSubmission, Teacher, Class } from '@/lib/types';

function formatDate(iso: string) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function CollegeAdminFacultyActivityPage() {
  const principal = useCurrentPrincipal();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!principal?.collegeId) return;

    // Fetch assignments
    const qA = query(
      collection(db, 'assignments'),
      where('collegeId', '==', principal.collegeId)
    );
    const unsubA = onSnapshot(qA, (snap) => {
      setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment)));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching assignments:', err);
      setLoading(false);
    });

    // Fetch submissions
    const qS = query(
      collection(db, 'assignmentSubmissions'),
      where('collegeId', '==', principal.collegeId)
    );
    const unsubS = onSnapshot(qS, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssignmentSubmission)));
    });

    // Fetch teachers
    const qT = query(
      collection(db, 'teachers'),
      where('collegeId', '==', principal.collegeId)
    );
    const unsubT = onSnapshot(qT, (snap) => {
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)));
    });

    // Fetch classes
    const qC = query(
      collection(db, 'classes'),
      where('collegeId', '==', principal.collegeId)
    );
    const unsubC = onSnapshot(qC, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });

    return () => {
      unsubA();
      unsubS();
      unsubT();
      unsubC();
    };
  }, [principal?.collegeId]);

  // Maps for resolving names
  const teacherMap = React.useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach((t) => map.set(t.id, t.name || 'Unknown'));
    return map;
  }, [teachers]);

  const classMap = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name + (c.branch ? ` (${c.branch})` : '')));
    return map;
  }, [classes]);

  // Submission counts grouping
  const submissionsByAssignment = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const lists: Record<string, AssignmentSubmission[]> = {};

    submissions.forEach((s) => {
      counts[s.assignmentId] = (counts[s.assignmentId] || 0) + 1;
      if (!lists[s.assignmentId]) {
        lists[s.assignmentId] = [];
      }
      lists[s.assignmentId].push(s);
    });

    return { counts, lists };
  }, [submissions]);

  const filteredAssignments = React.useMemo(() => {
    return assignments.filter((a) => {
      const className = classMap.get(a.classId || '') || '';
      
      return (
        (a.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        className.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [assignments, searchQuery, classMap]);

  // Filtered submissions for selected assignment
  const selectedSubmissions = React.useMemo(() => {
    if (!selectedAssignment) return [];
    return (submissionsByAssignment.lists[selectedAssignment.id] || []).sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt)
    );
  }, [selectedAssignment, submissionsByAssignment]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-sky-500" />
          Faculty Activity
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Track assignments created by faculty members and monitor student submission counts.
        </p>
      </div>

      {/* Filter Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              Total Assignments: <span className="text-foreground font-semibold">{assignments.length}</span>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, subject, teacher, class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid/Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-x-auto">
            <Table className="min-w-[800px] w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="p-4">Assignment Title</TableHead>
                  <TableHead className="p-4">Subject</TableHead>
                  <TableHead className="p-4">Class</TableHead>
                  <TableHead className="p-4">Due Date</TableHead>
                  <TableHead className="p-4 text-center">Submissions</TableHead>
                  <TableHead className="p-4 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((a) => {
                  const subCount = submissionsByAssignment.counts[a.id] || 0;
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="p-4 font-semibold text-foreground">{a.title}</TableCell>
                      <TableCell className="p-4 text-muted-foreground">{a.subject || 'N/A'}</TableCell>
                      <TableCell className="p-4 text-muted-foreground">
                        {classMap.get(a.classId || '') || 'N/A'}
                      </TableCell>
                      <TableCell className="p-4 text-muted-foreground">{formatDate(a.dueDate)}</TableCell>
                      <TableCell className="p-4 text-center">
                        <Badge variant={subCount > 0 ? 'default' : 'secondary'} className="rounded-full">
                          {subCount} submitted
                        </Badge>
                      </TableCell>
                      <TableCell className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAssignment(a)}
                          className="h-8 inline-flex items-center gap-1.5"
                        >
                          <Eye className="h-4 w-4" />
                          View Submissions
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAssignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No assignments found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Submissions Dialog */}
      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-sky-500" />
              Submissions Details
            </DialogTitle>
            <DialogDescription>
              "{selectedAssignment?.title}" · {selectedAssignment?.subject} · {classMap.get(selectedAssignment?.classId || '')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {selectedSubmissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No submissions uploaded by students for this assignment yet.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedSubmissions.map((sub) => (
                  <div key={sub.id} className="rounded-lg border p-4 hover:bg-muted/10 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {sub.studentName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{sub.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            Submitted on {new Date(sub.submittedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={sub.status === 'graded' ? 'secondary' : 'default'} className="capitalize">
                        {sub.status}
                      </Badge>
                    </div>

                    {sub.textContent && (
                      <p className="text-sm text-muted-foreground mt-3 bg-muted/30 p-2.5 rounded whitespace-pre-wrap leading-relaxed">
                        {sub.textContent}
                      </p>
                    )}

                    {sub.attachmentName && (
                      <div className="mt-3 flex items-center">
                        <a
                          href={sub.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1.5 text-xs font-semibold"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {sub.attachmentName}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <Button onClick={() => setSelectedAssignment(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
