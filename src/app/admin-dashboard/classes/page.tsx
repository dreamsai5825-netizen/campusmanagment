'use client';

import React, { useState, useEffect } from 'react';
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
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Edit, Trash2, BookCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, setDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import type { Class, Student, Subject } from '@/lib/types';
import { generateClassId } from '@/lib/id-utils';
import { getClassSubjectNames, getClassSubjectsDisplay } from '@/lib/subject-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useCurrentPrincipal } from '@/hooks/use-current-user';

export default function ClassesPage() {
  const principal = useCurrentPrincipal();
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignSubjectDialogOpen, setIsAssignSubjectDialogOpen] = useState(false);
  const [classGrade, setClassGrade] = useState('');
  const [classSection, setClassSection] = useState('');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!principal?.collegeId) {
      setClasses([]);
      setStudents([]);
      setAllSubjects([]);
      return;
    }
    const unsubClasses = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
      (snap) => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)))
    );
    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('collegeId', '==', principal.collegeId)),
      (snap) => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)))
    );
    const unsubSubjects = onSnapshot(
      query(collection(db, 'subjects'), where('collegeId', '==', principal.collegeId)),
      (snap) => setAllSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)))
    );

    return () => {
      unsubClasses();
      unsubStudents();
      unsubSubjects();
    };
  }, [principal?.collegeId]);

  const getStudentCountForClass = (classId: string) => {
    return students.filter((s) => s.classId === classId).length;
  };

  const handleAddClass = async () => {
    if (!principal?.collegeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'College not loaded.' });
      return;
    }
    if (!classGrade.trim() || !classSection.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Class and Section cannot be empty.' });
      return;
    }
    const name = `${classGrade} - Section ${classSection}`;
    const newClass = {
      name,
      collegeId: principal.collegeId,
      subjectIds: [] as string[],
    };
    const classId = generateClassId(name);
    try {
      await setDoc(doc(db, 'classes', classId), newClass);
      setClassGrade('');
      setClassSection('');
      setIsAddDialogOpen(false);
      toast({ title: 'Class Added', description: `"${name}" has been added.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add class.' });
    }
  };

  const openEditDialog = (classItem: Class) => {
    setSelectedClass(classItem);
    const nameParts = classItem.name.split(' - Section ');
    setClassGrade(nameParts[0] || '');
    setClassSection(nameParts[1] || '');
    setIsEditDialogOpen(true);
  };

  const handleEditClass = async () => {
    if (!selectedClass || !classGrade.trim() || !classSection.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Class and Section cannot be empty.' });
      return;
    }
    try {
      const classRef = doc(db, 'classes', selectedClass.id);
      await updateDoc(classRef, { name: `${classGrade} - Section ${classSection}` });
      setSelectedClass(null);
      setClassGrade('');
      setClassSection('');
      setIsEditDialogOpen(false);
      toast({ title: 'Class Updated', description: 'The class has been updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update class.' });
    }
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      await deleteDoc(doc(db, 'classes', classId));
      toast({ variant: 'destructive', title: 'Class Deleted', description: 'The class has been removed.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete class.' });
    }
  };

  const openAssignSubjectDialog = (classItem: Class) => {
    setSelectedClass(classItem);
    if (classItem.subjectIds?.length) {
      setSelectedSubjectIds([...classItem.subjectIds]);
    } else if (classItem.subject) {
      const id = allSubjects.find((s) => s.name === classItem.subject)?.id;
      setSelectedSubjectIds(id ? [id] : []);
    } else {
      setSelectedSubjectIds([]);
    }
    setIsAssignSubjectDialogOpen(true);
  };

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleAssignSubject = async () => {
    if (!selectedClass) return;
    try {
      const classRef = doc(db, 'classes', selectedClass.id);
      const firstSubjectName = selectedSubjectIds.length
        ? allSubjects.find((s) => s.id === selectedSubjectIds[0])?.name ?? ''
        : '';
      await updateDoc(classRef, {
        subjectIds: selectedSubjectIds,
        subject: firstSubjectName,
      });
      setSelectedClass(null);
      setSelectedSubjectIds([]);
      setIsAssignSubjectDialogOpen(false);
      const names = selectedSubjectIds
        .map((id) => allSubjects.find((s) => s.id === id)?.name)
        .filter(Boolean);
      toast({
        title: 'Subjects Assigned',
        description: names.length
          ? `${names.join(', ')} assigned to "${selectedClass.name}".`
          : `Subjects updated for "${selectedClass.name}".`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign subjects.' });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Manage Classes
          </h1>
          <p className="text-muted-foreground">
            Add, edit, or remove classes.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Class</DialogTitle>
              <DialogDescription>
                Enter the details for the new class.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="class" className="text-right">
                  Class
                </Label>
                <Input
                  id="class"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., Grade 8"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="section" className="text-right">
                  Section
                </Label>
                <Input
                  id="section"
                  value={classSection}
                  onChange={(e) => setClassSection(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., A"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddClass}>Save Class</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

       <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{c.name}</CardTitle>
              <CardDescription>
                Subjects: {getClassSubjectsDisplay(c, allSubjects)} | Students: {getStudentCountForClass(c.id)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                    Class ID: {c.id}
                </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openAssignSubjectDialog(c)}>
                    <BookCopy className="mr-2 h-4 w-4" /> Assign Subjects
                </Button>
                <Button variant="outline" size="icon" onClick={() => openEditDialog(c)}>
                    <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the "{c.name}" class.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteClass(c.id)}>
                        Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>

       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
              <DialogDescription>
                Update the details of the class.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-class" className="text-right">
                  Class
                </Label>
                <Input
                  id="edit-class"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="col-span-3"
                />
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-section" className="text-right">
                  Section
                </Label>
                <Input
                  id="edit-section"
                  value={classSection}
                  onChange={(e) => setClassSection(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
              <Button onClick={handleEditClass}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isAssignSubjectDialogOpen} onOpenChange={setIsAssignSubjectDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Assign Subjects to {selectedClass?.name}</DialogTitle>
              <DialogDescription>
                Select one or more subjects to assign to this class.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Subjects</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedSubjectIds(allSubjects.map((s) => s.id))}
                      disabled={allSubjects.length === 0}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedSubjectIds([])}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 max-h-48 overflow-y-auto rounded-md border p-3">
                  {allSubjects.map((subject) => (
                    <label
                      key={subject.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSubjectIds.includes(subject.id)}
                        onCheckedChange={() => toggleSubjectSelection(subject.id)}
                      />
                      <span className="text-sm">{subject.name}</span>
                    </label>
                  ))}
                  {allSubjects.length === 0 && (
                    <p className="text-sm text-muted-foreground">No subjects. Add subjects first.</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
              <Button onClick={handleAssignSubject}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
