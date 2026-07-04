'use client';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useCurrentStudent } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import type { Assignment, Class, AssignmentSubmission } from '@/lib/types';
import { FileText, Paperclip, Send, Eye, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function StudentAssignmentsPage() {
  const student = useCurrentStudent();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const collegeId = student?.collegeId ?? null;

  const [submitDialogOpen, setSubmitDialogOpen] = useState<string | null>(null);
  const [viewAssignmentId, setViewAssignmentId] = useState<string | null>(null);
  const [editSubmissionId, setEditSubmissionId] = useState<string | null>(null);
  const [deleteSubmissionId, setDeleteSubmissionId] = useState<string | null>(null);
  const [submitText, setSubmitText] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [editSubmitText, setEditSubmitText] = useState('');
  const [editSubmitFile, setEditSubmitFile] = useState<File | null>(null);
  const [editRemoveAttachment, setEditRemoveAttachment] = useState(false);

  useEffect(() => {
    if (!collegeId) {
      setAssignments([]);
      setClasses([]);
      setSubmissions([]);
      return;
    }
    const qA = query(
      collection(db, 'assignments'),
      where('collegeId', '==', collegeId)
    );
    const qC = query(
      collection(db, 'classes'),
      where('collegeId', '==', collegeId)
    );
    const unsubA = onSnapshot(qA, (snap) => {
      setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment)));
    });
    const unsubC = onSnapshot(qC, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });
    return () => {
      unsubA();
      unsubC();
    };
  }, [collegeId]);

  useEffect(() => {
    if (!student?.id) {
      setSubmissions([]);
      return;
    }
    const q = query(
      collection(db, 'assignmentSubmissions'),
      where('studentId', '==', student.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssignmentSubmission)));
    });
    return () => unsub();
  }, [student?.id]);

  const studentAssignments = student
    ? assignments.filter((a) => a.classId === student.classId)
    : [];

  const getSubmissionForAssignment = (assignmentId: string) =>
    submissions.find((s) => s.assignmentId === assignmentId);

  const viewAssignment =
    viewAssignmentId != null
      ? studentAssignments.find((a) => a.id === viewAssignmentId) ?? null
      : null;
  const viewAssignmentClass = viewAssignment
    ? classes.find((c) => c.id === viewAssignment.classId)
    : null;
  const editSubmission = editSubmissionId != null ? submissions.find((s) => s.id === editSubmissionId) ?? null : null;

  useEffect(() => {
    if (editSubmission) {
      setEditSubmitText(editSubmission.textContent ?? '');
      setEditSubmitFile(null);
      setEditRemoveAttachment(false);
    }
  }, [editSubmission?.id, editSubmission?.textContent]);

  const handleEditSubmission = async () => {
    if (!editSubmissionId || !editSubmission) return;
    if (!editSubmitText.trim() && !editSubmission.attachmentUrl && !editSubmitFile && !editRemoveAttachment) {
      toast({ variant: 'destructive', title: 'Error', description: 'Add text and/or an attachment.' });
      return;
    }
    setEditSubmitting(true);
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    try {
      if (editSubmitFile) {
        const path = `assignment-submissions/${editSubmission.assignmentId}/${student!.id}/${Date.now()}_${editSubmitFile.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, editSubmitFile);
        attachmentUrl = await getDownloadURL(storageRef);
        attachmentName = editSubmitFile.name;
      } else if (editRemoveAttachment || !editSubmission.attachmentUrl) {
        attachmentUrl = undefined;
        attachmentName = undefined;
      } else {
        attachmentUrl = editSubmission.attachmentUrl;
        attachmentName = editSubmission.attachmentName;
      }
      const updateData: Record<string, unknown> = { textContent: editSubmitText.trim() || '' };
      if (editRemoveAttachment && editSubmission.attachmentUrl) {
        updateData.attachmentUrl = deleteField();
        updateData.attachmentName = deleteField();
      } else if (attachmentUrl !== undefined) {
        updateData.attachmentUrl = attachmentUrl;
        updateData.attachmentName = attachmentName ?? undefined;
      }
      await updateDoc(doc(db, 'assignmentSubmissions', editSubmissionId), updateData as any);
      toast({ title: 'Submission updated' });
      setEditSubmissionId(null);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update submission.' });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteSubmission = async () => {
    if (!deleteSubmissionId) return;
    setDeleteInProgress(true);
    try {
      await deleteDoc(doc(db, 'assignmentSubmissions', deleteSubmissionId));
      toast({ title: 'Submission removed. You can submit again later.' });
      setDeleteSubmissionId(null);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove submission.' });
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleSubmit = async (assignment: Assignment) => {
    if (!student?.collegeId || !student?.classId) return;
    if (!submitText.trim() && !submitFile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Add your work (text and/or a file).' });
      return;
    }
    setSubmitting(true);
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    try {
      if (submitFile) {
        const path = `assignment-submissions/${assignment.id}/${student.id}/${Date.now()}_${submitFile.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, submitFile);
        attachmentUrl = await getDownloadURL(storageRef);
        attachmentName = submitFile.name;
      }
      await addDoc(collection(db, 'assignmentSubmissions'), {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        studentId: student.id,
        studentName: student.name,
        collegeId: student.collegeId,
        classId: student.classId,
        submittedAt: new Date().toISOString(),
        textContent: submitText.trim() || '',
        ...(attachmentUrl && { attachmentUrl }),
        ...(attachmentName && { attachmentName }),
        status: 'submitted',
      });
      toast({ title: 'Assignment submitted' });
      setSubmitDialogOpen(null);
      setSubmitText('');
      setSubmitFile(null);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit. If you attached a file, check Storage rules and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openSubmitDialog = (assignmentId: string) => {
    setSubmitDialogOpen(assignmentId);
    setSubmitText('');
    setSubmitFile(null);
  };

  return (
    <div className="assignments-page-wrapper flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          My Assignments
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          View assignments and submit your work (text and/or file attachment).
        </p>
      </div>

      <div className="border rounded-lg">
        <Table className="w-full" style={{ minWidth: '600px', width: 'max-content' }}>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px] sm:min-w-0">Title</TableHead>
              <TableHead className="hidden sm:table-cell min-w-[120px]">Subject</TableHead>
              <TableHead className="min-w-[100px]">Due Date</TableHead>
              <TableHead className="min-w-[140px]">Your status</TableHead>
              <TableHead className="text-right min-w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentAssignments.map((assignment) => {
              const assignedClass = classes.find((c) => c.id === assignment.classId);
              const mySubmission = getSubmissionForAssignment(assignment.id);
              return (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:inline" />
                      <span className="truncate">{assignment.title}</span>
                      {(assignment.subject ?? assignedClass?.subject) && (
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {assignment.subject ?? assignedClass?.subject ?? '—'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{assignment.subject ?? assignedClass?.subject ?? '—'}</TableCell>
                  <TableCell className="text-sm">{assignment.dueDate ?? '—'}</TableCell>
                  <TableCell>
                    {mySubmission ? (
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                        <Badge variant="secondary" className="text-xs w-fit">
                          Submitted {new Date(mySubmission.submittedAt).toLocaleDateString()}
                        </Badge>
                        {mySubmission.feedback && (
                          <Badge variant="default" className="bg-primary/90 text-xs w-fit">Has feedback</Badge>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs w-fit">Not submitted</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                        onClick={() => setViewAssignmentId(assignment.id)}
                      >
                        <Eye className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> 
                        <span className="hidden sm:inline">View</span>
                      </Button>
                      {mySubmission ? (
                        <>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                            onClick={() => setEditSubmissionId(mySubmission.id)}
                          >
                            <Pencil className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> 
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs text-destructive hover:text-destructive sm:h-9 sm:px-3 sm:text-sm"
                            onClick={() => setDeleteSubmissionId(mySubmission.id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> 
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </>
                      ) : (
                        <Dialog open={submitDialogOpen === assignment.id} onOpenChange={(open) => !open && setSubmitDialogOpen(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                              onClick={() => openSubmitDialog(assignment.id)}
                            >
                              <Send className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> 
                              Submit
                            </Button>
                          </DialogTrigger>
                        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Submit: {assignment.title}</DialogTitle>
                            <DialogDescription>
                              Add your work in the text box and/or attach a document (PDF, Word, image, etc.).
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-2">
                            <div className="grid gap-2">
                              <Label htmlFor="submit-text">Your work (required if no file)</Label>
                              <Textarea
                                id="submit-text"
                                placeholder="Type your answer or notes here..."
                                value={submitText}
                                onChange={(e) => setSubmitText(e.target.value)}
                                rows={5}
                                className="resize-y"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="submit-file">Attach document (optional)</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id="submit-file"
                                  type="file"
                                  accept="*/*"
                                  className="cursor-pointer"
                                  onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)}
                                />
                                {submitFile && (
                                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Paperclip className="h-4 w-4" />
                                    {submitFile.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Any file type allowed (PDF, Word, images, etc.).
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setSubmitDialogOpen(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              disabled={submitting || (!submitText.trim() && !submitFile)}
                              onClick={() => handleSubmit(assignment)}
                            >
                              {submitting ? 'Submitting…' : 'Submit'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {studentAssignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  You have no assignments.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewAssignmentId} onOpenChange={(open) => !open && setViewAssignmentId(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              {viewAssignment?.title ?? 'Assignment'}
            </DialogTitle>
            <DialogDescription>
              {viewAssignmentClass?.name ? `${viewAssignmentClass.name}${viewAssignmentClass.subject ? ` – ${viewAssignmentClass.subject}` : ''}` : 'Assignment details'}
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
                  <p className="text-xs font-medium text-muted-foreground">Description / Instructions</p>
                  <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
                    {viewAssignment.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Use the Submit button in the table to submit your work when you are ready.
              </p>
              {viewAssignmentId && (() => {
                const sub = getSubmissionForAssignment(viewAssignmentId);
                if (!sub?.feedback) return null;
                return (
                  <div className="border-t pt-4 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Teacher feedback</p>
                    <p className="whitespace-pre-wrap rounded-md border bg-primary/5 p-3 text-sm">{sub.feedback}</p>
                    {(sub.feedbackBy || sub.feedbackAt) && (
                      <p className="text-xs text-muted-foreground">
                        {sub.feedbackBy && `— ${sub.feedbackBy}`}
                        {sub.feedbackBy && sub.feedbackAt && ' · '}
                        {sub.feedbackAt && new Date(sub.feedbackAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSubmissionId} onOpenChange={(open) => !open && setEditSubmissionId(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit your submission</DialogTitle>
            <DialogDescription>
              Update your work below. You can change the text and/or replace the attachment.
            </DialogDescription>
          </DialogHeader>
          {editSubmission && (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-submit-text">Your work</Label>
                  <Textarea
                    id="edit-submit-text"
                    placeholder="Type your answer or notes here..."
                    value={editSubmitText}
                    onChange={(e) => setEditSubmitText(e.target.value)}
                    rows={5}
                    className="resize-y"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Attachment</Label>
                  {editSubmission.attachmentUrl && !editRemoveAttachment ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={editSubmission.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {editSubmission.attachmentName ?? 'Current file'}
                      </a>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditRemoveAttachment(true)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        type="file"
                        accept="*/*"
                        className="cursor-pointer"
                        onChange={(e) => {
                          setEditSubmitFile(e.target.files?.[0] ?? null);
                          setEditRemoveAttachment(false);
                        }}
                      />
                      {editSubmitFile && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Paperclip className="h-4 w-4" />
                          {editSubmitFile.name}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditSubmissionId(null)}>Cancel</Button>
                <Button
                  disabled={
                    editSubmitting ||
                    (!editSubmitText.trim() && !editSubmitFile && (!editSubmission.attachmentUrl || editRemoveAttachment))
                  }
                  onClick={() => void handleEditSubmission()}
                >
                  {editSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSubmissionId} onOpenChange={(open) => !open && setDeleteSubmissionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your submitted work for this assignment. You can submit again later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInProgress}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteInProgress} onClick={() => void handleDeleteSubmission()}>
              {deleteInProgress ? 'Removing…' : 'Remove submission'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
