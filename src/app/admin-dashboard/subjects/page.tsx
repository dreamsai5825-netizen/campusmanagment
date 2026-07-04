'use client';

import React, { useState, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Edit, Trash2, BookCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, setDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch, query, where } from 'firebase/firestore';
import type { Class, Subject } from '@/lib/types';
import { generateSubjectId } from '@/lib/id-utils';
import { getClassSubjectsDisplay } from '@/lib/subject-utils';
import { useCurrentPrincipal } from '@/hooks/use-current-user';


export default function SubjectsPage() {
  const principal = useCurrentPrincipal();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  
  const [isAllocateDialogOpen, setIsAllocateDialogOpen] = useState(false);
  const [subjectToAllocate, setSubjectToAllocate] = useState<Subject | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const { toast } = useToast();

  useEffect(() => {
    if (!principal?.collegeId) {
      setSubjects([]);
      setClasses([]);
      return;
    }
    const qSubjects = query(collection(db, 'subjects'), where('collegeId', '==', principal.collegeId));
    const unsubSubjects = onSnapshot(qSubjects, (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });
    const qClasses = query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });
    return () => {
      unsubSubjects();
      unsubClasses();
    };
  }, [principal?.collegeId]);

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Subject name cannot be empty.' });
      return;
    }
    if (!principal?.collegeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'College not loaded.' });
      return;
    }
    if (subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase())) {
        toast({ variant: 'destructive', title: 'Error', description: 'Subject already exists.' });
        return;
    }
    try {
      const subjectId = generateSubjectId(newSubjectName.trim());
      await setDoc(doc(db, 'subjects', subjectId), { name: newSubjectName.trim(), collegeId: principal.collegeId });
      setNewSubjectName('');
      setIsAddDialogOpen(false);
      toast({ title: 'Subject Added', description: `"${newSubjectName}" has been added.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add subject.' });
    }
  };

  const handleEditSubject = async () => {
    if (!editingSubject || !newSubjectName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Subject name cannot be empty.' });
      return;
    }

    const oldName = editingSubject.name;
    const newName = newSubjectName.trim();
    
    if (!principal?.collegeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'College not loaded.' });
      return;
    }
    try {
      const subjectRef = doc(db, 'subjects', editingSubject.id);
      await updateDoc(subjectRef, { name: newName });
      
      const classesQuery = await getDocs(query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)));
      const batch = writeBatch(db);
      classesQuery.forEach(classDoc => {
        const data = classDoc.data();
        if (data.subject === oldName) {
          batch.update(classDoc.ref, { subject: newName });
        }
      });
      await batch.commit();
      
      setEditingSubject(null);
      setNewSubjectName('');
      setIsEditDialogOpen(false);
      toast({ title: 'Subject Updated', description: 'The subject and associated classes have been updated.' });
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to update subject.' });
    }
  };

  const openEditDialog = (subject: Subject) => {
    setEditingSubject(subject);
    setNewSubjectName(subject.name);
    setIsEditDialogOpen(true);
  };

  const handleDeleteSubject = async (subjectId: string) => {
    const subjectToDelete = subjects.find(s => s.id === subjectId);
    if (!subjectToDelete) return;
    const isInUse = classes.some(
      (c) => c.subjectIds?.includes(subjectId) || c.subject === subjectToDelete.name
    );
    if (isInUse) {
        toast({
            variant: 'destructive',
            title: 'Cannot Delete Subject',
            description: `"${subjectToDelete.name}" is allocated to one or more classes. Please re-allocate them before deleting.`,
        });
        return;
    }

    try {
      await deleteDoc(doc(db, 'subjects', subjectId));
      toast({ variant: 'destructive', title: 'Subject Deleted', description: 'The subject has been removed.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete subject.' });
    }
  };

  const openAllocateDialog = (subject: Subject) => {
    setSubjectToAllocate(subject);
    setSelectedClassId('');
    setIsAllocateDialogOpen(true);
  };

  const handleAllocateSubject = async () => {
    if (!subjectToAllocate || !selectedClassId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a class.' });
      return;
    }
    const allocatedClass = classes.find((c) => c.id === selectedClassId);
    if (!allocatedClass) return;
    const currentIds = allocatedClass.subjectIds ?? [];
    if (currentIds.includes(subjectToAllocate.id)) {
      toast({ variant: 'destructive', title: 'Already Allocated', description: 'This class already has this subject.' });
      return;
    }
    const newSubjectIds = [...currentIds, subjectToAllocate.id];
    const firstSubjectName = subjects.find((s) => s.id === newSubjectIds[0])?.name ?? '';
    try {
      await updateDoc(doc(db, 'classes', selectedClassId), {
        subjectIds: newSubjectIds,
        subject: firstSubjectName,
      });
      toast({ title: 'Subject Allocated', description: `"${subjectToAllocate.name}" has been added to "${allocatedClass.name}".` });
      setIsAllocateDialogOpen(false);
      setSubjectToAllocate(null);
      setSelectedClassId('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to allocate subject.' });
    }
  };


  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Manage Subjects
          </h1>
          <p className="text-muted-foreground">
            Add, edit, or remove subjects from the school curriculum.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Subject</DialogTitle>
              <DialogDescription>
                Enter the name for the new subject.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., Physics"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddSubject}>Save Subject</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Subjects</CardTitle>
        </CardHeader>
        <CardContent>
          {subjects.length > 0 ? (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <p className="font-medium">{subject.name}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAllocateDialog(subject)}
                    >
                      <BookCheck className="mr-2 h-4 w-4" />
                      Allocate
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(subject)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the "{subject.name}" subject. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteSubject(subject.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No subjects found. Add one to get started.
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Subject</DialogTitle>
              <DialogDescription>
                Update the name of the subject.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
              <Button onClick={handleEditSubject}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      
      <Dialog open={isAllocateDialogOpen} onOpenChange={setIsAllocateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Allocate "{subjectToAllocate?.name}"</DialogTitle>
            <DialogDescription>
              Add this subject to a class. The class can have multiple subjects.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="class-select" className="text-right">
                Class
              </Label>
              <Select onValueChange={setSelectedClassId} value={selectedClassId}>
                <SelectTrigger id="class-select" className="col-span-3">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} (Current: {getClassSubjectsDisplay(c, subjects)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAllocateSubject} disabled={!selectedClassId}>Allocate Subject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
