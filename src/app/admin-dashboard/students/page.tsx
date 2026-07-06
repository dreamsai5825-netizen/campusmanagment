'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, KeyRound, Loader2, Users, BookOpen, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, setDoc, doc, query, where } from 'firebase/firestore';
import { generateStudentDocId } from '@/lib/id-utils';
import type { Student, Class } from '@/lib/types';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { filterByAcademicYear } from '@/lib/academic-year-filter';

export default function StudentsPage() {
    const principal = useCurrentPrincipal();
    const { selectedAcademicYear } = useAcademicYear();
    const { getPath } = useDashboardPath();
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [studentCountByClass, setStudentCountByClass] = useState<Record<string, number>>({});
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreatingLogins, setIsCreatingLogins] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: '', email: '', phone: '', classId: '' });
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (!principal?.collegeId) {
            setStudents([]);
            setClasses([]);
            setStudentCountByClass({});
            return;
        }
        const unsubscribeStudents = onSnapshot(
            query(collection(db, 'students'), where('collegeId', '==', principal.collegeId)),
            (snapshot) => {
                const studentsData = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Student[];
                setStudents(studentsData);
            }
        );
        const unsubscribeClasses = onSnapshot(
            query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
            (snapshot) => {
                const classesData = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Class[];
                setClasses(classesData);

                // Calculate student counts per class
                const counts: Record<string, number> = {};
                classesData.forEach((cls) => {
                    const count = snapshot.docs.filter(d => {
                        const classDoc = d.data() as Class;
                        return classDoc.id === cls.id;
                    }).length;
                    counts[cls.id] = 0;
                });
                setStudentCountByClass(counts);
            }
        );

        return () => {
            unsubscribeStudents();
            unsubscribeClasses();
        };
    }, [principal?.collegeId]);

    const studentsForYear = useMemo(
        () => filterByAcademicYear(students, selectedAcademicYear),
        [students, selectedAcademicYear]
    );

    useEffect(() => {
        const counts: Record<string, number> = {};
        classes.forEach((cls) => {
            counts[cls.id] = studentsForYear.filter((s) => s.classId === cls.id).length;
        });
        setStudentCountByClass(counts);
    }, [studentsForYear, classes]);

    const handleClassClick = (classId: string) => {
        router.push(getPath(`/students/class/${classId}`));
    };

    const handleRowClick = (studentId: string) => {
        router.push(getPath(`/students/${studentId}`));
    };

    const handleCreateStudentLogins = async () => {
        const user = auth.currentUser;
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please sign in first.' });
            return;
        }
        setIsCreatingLogins(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/create-student-logins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast({ variant: 'destructive', title: 'Error', description: data.error ?? 'Failed to create student logins.' });
                return;
            }
            const msg = data.message ?? `Created ${data.created ?? 0} logins. ${data.skipped ?? 0} already had accounts.`;
            toast({ title: 'Student logins created', description: msg });
            if (data.errors?.length) {
                toast({ variant: 'destructive', title: 'Some errors', description: data.errors.slice(0, 3).join('; ') });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create student logins.' });
        } finally {
            setIsCreatingLogins(false);
        }
    };

    const handleAddStudent = async () => {
        if (!principal?.collegeId) {
            toast({ variant: 'destructive', title: 'Error', description: 'College not loaded.' });
            return;
        }
        if (!newStudent.name || !newStudent.email || !newStudent.classId) {
            toast({
                variant: 'destructive',
                title: 'Missing Fields',
                description: 'Please fill out name, email, and class.',
            });
            return;
        }

        try {
            const newStudentId = `S${String(Date.now()).slice(-6).padStart(6, '0')}`;
            const docId = generateStudentDocId(newStudentId);

            await setDoc(doc(db, 'students', docId), {
                studentId: newStudentId,
                name: newStudent.name,
                email: newStudent.email,
                phone: newStudent.phone,
                classId: newStudent.classId,
                collegeId: principal.collegeId,
                academicYear: selectedAcademicYear,
                fees: { status: 'Not Paid', balance: 1000 },
                attendance: {
                    summary: { present: 0, absent: 0, totalDays: 0 },
                    bySubject: [],
                },
                assessments: [],
            });
            
            setNewStudent({ name: '', email: '', phone: '', classId: '' });
            setIsDialogOpen(false);
            toast({
                title: 'Student Added',
                description: `${newStudent.name} has been added to the system.`,
            });
        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Error adding student',
                description: 'There was a problem saving the new student.',
            });
            console.error("Error adding student: ", error);
        }
    };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
            Students by Class
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Select a class to view and manage students for {selectedAcademicYear}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCreateStudentLogins}
            disabled={isCreatingLogins || studentsForYear.length === 0}
            title="Create Firebase Auth logins for all students in this college"
          >
            {isCreatingLogins ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Create student login
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(getPath('/students/import'))}
            title="Import students from Excel/CSV"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Students
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Student
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Fill in the details to add a new student to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="name" className="sm:text-right">
                  Name
                </Label>
                <Input id="name" value={newStudent.name} onChange={(e) => setNewStudent({...newStudent, name: e.target.value})} className="sm:col-span-3" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="email" className="sm:text-right">
                  Email
                </Label>
                <Input id="email" type="email" value={newStudent.email} onChange={(e) => setNewStudent({...newStudent, email: e.target.value})} className="sm:col-span-3" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="phone" className="sm:text-right">
                  Phone
                </Label>
                <Input id="phone" value={newStudent.phone} onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})} className="sm:col-span-3" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="class" className="sm:text-right">
                  Class
                </Label>
                 <Select onValueChange={(value) => setNewStudent({...newStudent, classId: value})}>
                    <SelectTrigger className="sm:col-span-3">
                        <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                        {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                            {c.name}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddStudent}>Save Student</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Card
            key={c.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleClassClick(c.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {c.name}
              </CardTitle>
              <CardDescription>
                {c.branch && `${c.branch} • `}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{studentCountByClass[c.id] ?? 0} Students</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {classes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No classes found. Create classes first in the Classes section.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
