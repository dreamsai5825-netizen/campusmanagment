'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, BookPlus, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import type { Class, Student, Subject } from '@/lib/types';
import { getClassSubjectsDisplay } from '@/lib/subject-utils';
import { cn } from '@/lib/utils';

export default function MyClassesPage() {
  const teacher = useCurrentTeacher();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [addStudentsDialogClass, setAddStudentsDialogClass] = useState<Class | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [addingToClass, setAddingToClass] = useState(false);
  const [showSubjectsDialogClass, setShowSubjectsDialogClass] = useState<Class | null>(null);

  const collegeId = teacher?.collegeId ?? null;
  const teacherId = teacher?.id ?? null;

  useEffect(() => {
    if (!collegeId) {
      setClasses([]);
      return;
    }
    const q = query(collection(db, 'classes'), where('collegeId', '==', collegeId));
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
    const q = query(collection(db, 'students'), where('collegeId', '==', collegeId));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
    });
    return () => unsub();
  }, [collegeId]);

  useEffect(() => {
    if (!collegeId) {
      setAllSubjects([]);
      return;
    }
    const q = query(collection(db, 'subjects'), where('collegeId', '==', collegeId));
    const unsub = onSnapshot(q, (snap) => {
      setAllSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
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
      (snap) => setAssignedClassIds(snap.docs.map((d) => d.id))
    );
    return () => unsub();
  }, [teacherId]);

  const assignedClasses = classes.filter((c) => assignedClassIds.includes(c.id));
  const getStudentCountForClass = (classId: string) =>
    students.filter((s) => s.classId === classId).length;

  const studentsNotInClass = addStudentsDialogClass
    ? students
        .filter((s) => (s.classId || '') !== addStudentsDialogClass.id)
        .sort((a, b) => (a.usn || a.studentId || '').localeCompare(b.usn || b.studentId || '', undefined, { numeric: true }))
    : [];

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllNotInClass = () => {
    if (selectedStudentIds.size === studentsNotInClass.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(studentsNotInClass.map((s) => s.id)));
    }
  };

  const handleAddStudentsToClass = async () => {
    if (!addStudentsDialogClass || selectedStudentIds.size === 0) return;
    setAddingToClass(true);
    try {
      const batch = writeBatch(db);
      selectedStudentIds.forEach((studentId) => {
        batch.update(doc(db, 'students', studentId), { classId: addStudentsDialogClass.id });
      });
      await batch.commit();
      toast({
        title: 'Students added',
        description: `${selectedStudentIds.size} student(s) added to ${addStudentsDialogClass.name}.`,
      });
      setSelectedStudentIds(new Set());
      setAddStudentsDialogClass(null);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Failed to add students',
        description: 'Please try again.',
      });
    } finally {
      setAddingToClass(false);
    }
  };

  const openAddStudents = (c: Class) => {
    setAddStudentsDialogClass(c);
    setSelectedStudentIds(new Set());
  };

  const assignedSubjectsForClass = showSubjectsDialogClass
    ? (showSubjectsDialogClass.subjectIds ?? [])
        .map((id) => allSubjects.find((s) => s.id === id)?.name)
        .filter((n): n is string => Boolean(n))
    : [];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          My Classes
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage your assigned classes, students, and subjects.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {assignedClasses.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{c.name}</CardTitle>
              <CardDescription>
                Subjects: {getClassSubjectsDisplay(c, allSubjects)} | Students: {getStudentCountForClass(c.id)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="text-sm text-muted-foreground">
                <p>
                  A brief description of the class, its objectives, and what
                  students will learn throughout the semester.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              <Dialog open={addStudentsDialogClass?.id === c.id} onOpenChange={(open) => !open && setAddStudentsDialogClass(null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => openAddStudents(c)}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add Students
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Add Students to {c.name}</DialogTitle>
                    <DialogDescription>
                      Select students from your college who are not in this class. They will be assigned to this class.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col flex-1 min-h-0 py-2">
                    {studentsNotInClass.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No other students available. All students in your college are already in this class, or there are no students yet.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 pb-2 border-b">
                          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <Checkbox
                              checked={selectedStudentIds.size === studentsNotInClass.length && studentsNotInClass.length > 0}
                              onCheckedChange={selectAllNotInClass}
                            />
                            Select all ({studentsNotInClass.length})
                          </label>
                          {selectedStudentIds.size > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {selectedStudentIds.size} selected
                            </span>
                          )}
                        </div>
                        <div className="overflow-y-auto max-h-[40vh] space-y-1 py-2">
                          {studentsNotInClass.map((s) => (
                            <label
                              key={s.id}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                                selectedStudentIds.has(s.id) && 'bg-primary/5 border-primary/30'
                              )}
                            >
                              <Checkbox
                                checked={selectedStudentIds.has(s.id)}
                                onCheckedChange={() => toggleStudent(s.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{s.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {s.studentId} {s.classId ? `· Current class: ${classes.find((cl) => cl.id === s.classId)?.name ?? s.classId}` : '· No class'}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setAddStudentsDialogClass(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddStudentsToClass}
                      disabled={addingToClass || selectedStudentIds.size === 0}
                    >
                      {addingToClass ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding…
                        </>
                      ) : (
                        <>Add {selectedStudentIds.size > 0 ? `${selectedStudentIds.size} ` : ''}to class</>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={showSubjectsDialogClass?.id === c.id} onOpenChange={(open) => !open && setShowSubjectsDialogClass(null)}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setShowSubjectsDialogClass(c)}>
                    <BookPlus className="mr-2 h-4 w-4" /> Show assigned subjects
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Assigned subjects – {c.name}</DialogTitle>
                    <DialogDescription>
                      Subjects assigned to this class (managed by admin).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-2">
                    {assignedSubjectsForClass.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No subjects assigned to this class yet.
                      </p>
                    ) : (
                      <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {assignedSubjectsForClass.map((name, i) => (
                          <li key={i} className="rounded-lg border px-3 py-2 text-sm font-medium">
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setShowSubjectsDialogClass(null)}>Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        ))}
        {assignedClasses.length === 0 && (
          <p className="text-muted-foreground col-span-full py-8 text-center">
            No classes assigned to you yet. Ask admin to assign classes from the Admin Dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
