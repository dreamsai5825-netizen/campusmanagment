'use client';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, FileText, Inbox, Paperclip, Pencil, Trash2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import type { Assignment, Class, AssignmentSubmission } from '@/lib/types';

export default function AssignmentsPage() {
  const teacher = useCurrentTeacher();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createClassId, setCreateClassId] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [viewSubmissionId, setViewSubmissionId] = useState<string | null>(null);
  const [viewAssignmentId, setViewAssignmentId] = useState<string | null>(null);
  const [editAssignmentId, setEditAssignmentId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const viewSubmission =
    viewSubmissionId != null
      ? (submissions.find((s) => s.id === viewSubmissionId) ?? null)
      : null;
  const viewAssignment =
    viewAssignmentId != null
      ? assignments.find((a) => a.id === viewAssignmentId) ?? null
      : null;
  const viewAssignmentClass = viewAssignment
    ? classes.find((c) => c.id === viewAssignment.classId)
    : null;
  const editAssignment = editAssignmentId != null ? assignments.find((a) => a.id === editAssignmentId) ?? null : null;

  useEffect(() => {
    if (viewSubmission) setFeedbackInput(viewSubmission.feedback ?? '');
  }, [viewSubmission?.id, viewSubmission?.feedback]);

  const handleSaveFeedback = async () => {
    if (!viewSubmissionId || !teacher?.name) return;
    setFeedbackSaving(true);
    try {
      await updateDoc(doc(db, 'assignmentSubmissions', viewSubmissionId), {
        feedback: feedbackInput.trim() || undefined,
        feedbackAt: new Date().toISOString(),
        feedbackBy: teacher.name,
      });
      toast({ title: 'Feedback saved. Student will see it.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save feedback.' });
    } finally {
      setFeedbackSaving(false);
    }
  };

  useEffect(() => {
    if (editAssignment) {
      setEditTitle(editAssignment.title);
      setEditSubject(editAssignment.subject ?? '');
      setEditClassId(editAssignment.classId);
      setEditDueDate(editAssignment.dueDate ?? '');
      setEditDescription(editAssignment.description ?? '');
    }
  }, [editAssignment?.id, editAssignment?.title, editAssignment?.subject, editAssignment?.classId, editAssignment?.dueDate, editAssignment?.description]);

  const handleEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAssignmentId || !editTitle.trim() || !editClassId || !editDueDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in title, class, and due date.' });
      return;
    }
    setEditSubmitting(true);
    try {
      await updateDoc(doc(db, 'assignments', editAssignmentId), {
        title: editTitle.trim(),
        subject: editSubject.trim() || undefined,
        classId: editClassId,
        dueDate: editDueDate,
        description: editDescription.trim() || undefined,
      });
      toast({ title: 'Assignment updated' });
      setEditAssignmentId(null);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update assignment.' });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteAssignmentId) return;
    setDeleteInProgress(true);
    try {
      const subSnap = await getDocs(query(collection(db, 'assignmentSubmissions'), where('assignmentId', '==', deleteAssignmentId)));
      const batch = writeBatch(db);
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'assignments', deleteAssignmentId));
      await batch.commit();
      toast({ title: 'Assignment deleted' });
      setDeleteAssignmentId(null);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete assignment.' });
    } finally {
      setDeleteInProgress(false);
    }
  };

  useEffect(() => {
    if (!teacher?.collegeId) {
      setAssignments([]);
      setClasses([]);
      setSubmissions([]);
      return;
    }
    const qA = query(
      collection(db, 'assignments'),
      where('collegeId', '==', teacher.collegeId)
    );
    const qC = query(
      collection(db, 'classes'),
      where('collegeId', '==', teacher.collegeId)
    );
    const qS = query(
      collection(db, 'assignmentSubmissions'),
      where('collegeId', '==', teacher.collegeId)
    );
    const unsubA = onSnapshot(qA, (snap) => {
      setAssignments(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Assignment))
          .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      );
    });
    const unsubC = onSnapshot(qC, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });
    const unsubS = onSnapshot(qS, (snap) => {
      setSubmissions(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as AssignmentSubmission))
          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      );
    });
    return () => {
      unsubA();
      unsubC();
      unsubS();
    };
  }, [teacher?.collegeId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher?.collegeId || !createTitle.trim() || !createClassId || !createDueDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in title, class, and due date.' });
      return;
    }
    setCreateSubmitting(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        collegeId: teacher.collegeId,
        classId: createClassId,
        title: createTitle.trim(),
        subject: createSubject.trim() || undefined,
        dueDate: createDueDate,
        description: createDescription.trim() || undefined,
        status: 'Pending',
      });
      toast({ title: 'Assignment created' });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateSubject('');
      setCreateClassId('');
      setCreateDueDate('');
      setCreateDescription('');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create assignment.' });
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="assignments-page-wrapper flex flex-col gap-4 sm:gap-6 md:gap-8">
      <div className="flex flex-col gap-3 rounded-lg border bg-card/95 px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold font-headline tracking-tight sm:text-2xl md:text-3xl">
            Assignments
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm md:text-base">
            Create, manage, and track assignments for your classes.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 w-full sm:w-auto" size="sm" variant="default">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-[525px] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
              <DialogDescription>
                Fill in the details below to create a new assignment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAssignment}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label htmlFor="title" className="sm:text-right">Title</Label>
                  <Input
                    id="title"
                    className="sm:col-span-3"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="e.g. Chapter 5 Essay"
                    required
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label htmlFor="subject" className="sm:text-right">Subject</Label>
                  <Input
                    id="subject"
                    className="sm:col-span-3"
                    value={createSubject}
                    onChange={(e) => setCreateSubject(e.target.value)}
                    placeholder="e.g. A.I, Mathematics"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label htmlFor="class" className="sm:text-right">Class</Label>
                  <Select value={createClassId} onValueChange={setCreateClassId} required>
                    <SelectTrigger className="sm:col-span-3">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.subject ? `- ${c.subject}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label htmlFor="dueDate" className="sm:text-right">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    className="sm:col-span-3"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label htmlFor="description" className="sm:text-right">Description</Label>
                  <Textarea
                    id="description"
                    className="sm:col-span-3"
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Instructions for students (optional)"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createSubmitting}>
                  {createSubmitting ? 'Creating…' : 'Create Assignment'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="w-full rounded-lg border">
        <Table className="w-full" style={{ minWidth: '600px', width: 'max-content' }}>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px] sm:min-w-0">Title</TableHead>
              <TableHead className="hidden sm:table-cell min-w-[120px]">Class</TableHead>
              <TableHead className="min-w-[100px] whitespace-nowrap">Due Date</TableHead>
              <TableHead className="hidden sm:table-cell min-w-[90px]">Status</TableHead>
              <TableHead className="text-right min-w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => {
              const assignedClass = classes.find(c => c.id === assignment.classId);
              return (
                <TableRow key={assignment.id}>
                  <TableCell className="min-w-0 font-medium p-2 sm:p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground hidden sm:inline" />
                      <span className="truncate text-sm sm:text-base">{assignment.title}</span>
                      {assignedClass && (
                        <span className="text-xs text-muted-foreground sm:hidden">{assignedClass.name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden truncate sm:table-cell p-2 sm:p-4">{assignedClass?.name ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-xs sm:text-sm p-2 sm:p-4">{assignment.dueDate ?? '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell p-2 sm:p-4">
                    <Badge variant={assignment.status === 'Graded' ? 'secondary' : 'default'} className="text-xs">
                      {assignment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right p-1 sm:p-4">
                    <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0 sm:h-8 sm:w-auto sm:px-2 sm:text-xs"
                        onClick={() => setViewAssignmentId(assignment.id)}
                      >
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline ml-1">View</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0 sm:h-8 sm:w-8 sm:p-0"
                        onClick={() => setEditAssignmentId(assignment.id)}
                      >
                        <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0 text-destructive hover:text-destructive sm:h-8 sm:w-8 sm:p-0"
                        onClick={() => setDeleteAssignmentId(assignment.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {assignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No assignments yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Card className="min-w-0">
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Inbox className="h-4 w-4 sm:h-5 sm:w-5" />
            Submitted assignments
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Work submitted by students. Sorted by most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="rounded-lg border">
            <Table className="w-full" style={{ minWidth: '600px', width: 'max-content' }}>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px] p-2 sm:p-4">Assignment</TableHead>
                  <TableHead className="min-w-[120px] p-2 sm:p-4">Student</TableHead>
                  <TableHead className="hidden sm:table-cell min-w-[140px] p-2 sm:p-4">Submitted</TableHead>
                  <TableHead className="hidden md:table-cell min-w-[120px] p-2 sm:p-4">Attachment</TableHead>
                  <TableHead className="min-w-[90px] p-2 sm:p-4">Status</TableHead>
                  <TableHead className="min-w-[80px] p-1 sm:p-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="min-w-0 font-medium p-2 sm:p-4">
                      <div className="flex flex-col gap-1">
                        <span className="truncate text-sm sm:text-base">{sub.assignmentTitle}</span>
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 truncate p-2 sm:p-4">
                      <span className="text-sm sm:text-base">{sub.studentName}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground text-xs sm:table-cell p-2 sm:p-4">
                      {new Date(sub.submittedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell p-2 sm:p-4">
                      {sub.attachmentName ? (
                        <a
                          href={sub.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs sm:text-sm"
                        >
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]">{sub.attachmentName}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="p-2 sm:p-4">
                      <Badge variant={sub.status === 'graded' ? 'secondary' : 'default'} className="text-xs whitespace-nowrap">
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-1 sm:p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0 sm:h-8 sm:w-auto sm:px-2 sm:text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setViewSubmissionId(sub.id);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline ml-1">View</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {submissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No submissions yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewAssignmentId} onOpenChange={(open) => !open && setViewAssignmentId(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              {viewAssignment?.title ?? 'Assignment'}
            </DialogTitle>
            <DialogDescription>
              {viewAssignmentClass?.name ? `Class: ${viewAssignmentClass.name}` : 'Assignment details'}
            </DialogDescription>
          </DialogHeader>
          {viewAssignment && (
            <div className="space-y-4">
              {(viewAssignment.subject ?? viewAssignmentClass?.subject) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Subject</p>
                  <p className="text-sm">{viewAssignment.subject ?? viewAssignmentClass?.subject ?? '—'}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground">Due date</p>
                <p className="text-sm">{viewAssignment.dueDate ?? '—'}</p>
              </div>
              {viewAssignment.description ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                    {viewAssignment.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No description.</p>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <Badge variant={viewAssignment.status === 'Graded' ? 'secondary' : 'default'}>
                  {viewAssignment.status}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAssignmentId} onOpenChange={(open) => !open && setEditAssignmentId(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-[525px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
            <DialogDescription>Update the assignment details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditAssignment}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="edit-title" className="sm:text-right">Title</Label>
                <Input id="edit-title" className="sm:col-span-3" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="e.g. Chapter 5 Essay" required />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="edit-subject" className="sm:text-right">Subject</Label>
                <Input id="edit-subject" className="sm:col-span-3" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="e.g. A.I, Mathematics" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="edit-class" className="sm:text-right">Class</Label>
                <Select value={editClassId} onValueChange={setEditClassId} required>
                  <SelectTrigger className="sm:col-span-3">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.subject ? `- ${c.subject}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="edit-dueDate" className="sm:text-right">Due Date</Label>
                <Input id="edit-dueDate" type="date" className="sm:col-span-3" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} required />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="edit-description" className="sm:text-right">Description</Label>
                <Textarea id="edit-description" className="sm:col-span-3" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Instructions (optional)" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditAssignmentId(null)}>Cancel</Button>
              <Button type="submit" disabled={editSubmitting}>{editSubmitting ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAssignmentId} onOpenChange={(open) => !open && setDeleteAssignmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the assignment and all submissions for it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInProgress}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteInProgress} onClick={() => void handleDeleteAssignment()}>
              {deleteInProgress ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewSubmissionId} onOpenChange={(open) => !open && setViewSubmissionId(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewSubmission?.assignmentTitle} – {viewSubmission?.studentName}</DialogTitle>
            <DialogDescription>
              Submitted {viewSubmission ? new Date(viewSubmission.submittedAt).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>
          {viewSubmission && (
            <div className="space-y-4">
              {viewSubmission.textContent ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Text</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/30 p-3">{viewSubmission.textContent}</p>
                </div>
              ) : null}
              {viewSubmission.attachmentUrl && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Attachment</p>
                  <a
                    href={viewSubmission.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Paperclip className="h-4 w-4" />
                    {viewSubmission.attachmentName ?? 'Download'}
                  </a>
                </div>
              )}
              {!viewSubmission.textContent && !viewSubmission.attachmentUrl && (
                <p className="text-sm text-muted-foreground">No content.</p>
              )}
              <div className="border-t pt-4 space-y-2">
                <Label className="text-sm font-medium">Give feedback (student will see this)</Label>
                <Textarea
                  placeholder="Write feedback for the student..."
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <Button size="sm" onClick={handleSaveFeedback} disabled={feedbackSaving}>
                  {feedbackSaving ? 'Saving…' : 'Save feedback'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
