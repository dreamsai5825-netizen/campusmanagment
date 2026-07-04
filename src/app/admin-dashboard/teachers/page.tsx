'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { PlusCircle, KeyRound, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, setDoc, doc, query, where } from 'firebase/firestore';
import type { Teacher, Subject, College } from '@/lib/types';
import { generateTeacherId } from '@/lib/id-utils';
import { getTeacherSubjectsDisplay } from '@/lib/subject-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { getCollegeById } from '@/lib/college-service';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { filterByAcademicYear } from '@/lib/academic-year-filter';
import { DEFAULT_NEW_USER_PASSWORD } from '@/lib/default-user-password';

export default function TeachersPage() {
    const principal = useCurrentPrincipal();
    const { selectedAcademicYear } = useAcademicYear();
    const { getPath } = useDashboardPath();
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [currentCollege, setCurrentCollege] = useState<College | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isCreatingLogins, setIsCreatingLogins] = useState(false);
    const [newTeacher, setNewTeacher] = useState({ name: '', email: '', phone: '', role: '', subjectIds: [] as string[] });
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (!principal?.collegeId) {
            setTeachers([]);
            setAllSubjects([]);
            setCurrentCollege(null);
            return;
        }
        getCollegeById(principal.collegeId).then(setCurrentCollege);
        const unsubTeachers = onSnapshot(
            query(collection(db, 'teachers'), where('collegeId', '==', principal.collegeId)),
            (snapshot) => {
                setTeachers(snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as Teacher[]);
            }
        );
        const unsubSubjects = onSnapshot(
            query(collection(db, 'subjects'), where('collegeId', '==', principal.collegeId)),
            (snapshot) => {
                setAllSubjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Subject[]);
            }
        );
        return () => { unsubTeachers(); unsubSubjects(); };
    }, [principal?.collegeId]);

    const teachersForYear = useMemo(
        () => filterByAcademicYear(teachers, selectedAcademicYear),
        [teachers, selectedAcademicYear]
    );

    const handleRowClick = (teacherId: string) => {
        router.push(getPath(`/teachers/${teacherId}`));
    };

    const toggleNewTeacherSubject = (subjectId: string) => {
        setNewTeacher((prev) => ({
            ...prev,
            subjectIds: prev.subjectIds.includes(subjectId)
                ? prev.subjectIds.filter((id) => id !== subjectId)
                : [...prev.subjectIds, subjectId],
        }));
    };

    const handleAddTeacher = async () => {
        if (!principal?.collegeId) {
            toast({ variant: 'destructive', title: 'Error', description: 'College not loaded.' });
            return;
        }
        if (!newTeacher.name || !newTeacher.email) {
            toast({
                variant: 'destructive',
                title: 'Missing Fields',
                description: 'Name and email are required.',
            });
            return;
        }
        const firstSubjectName = newTeacher.subjectIds.length
            ? allSubjects.find((s) => s.id === newTeacher.subjectIds[0])?.name ?? ''
            : '';
        const email = newTeacher.email.trim().toLowerCase();
        const payload = {
            name: newTeacher.name,
            email,
            phone: newTeacher.phone || '',
            role: newTeacher.role || '',
            collegeId: principal.collegeId,
            subjectIds: newTeacher.subjectIds,
            subjectSpecialty: firstSubjectName,
            academicYear: selectedAcademicYear,
        };
        const teacherId = generateTeacherId(newTeacher.name);
        const teacherName = newTeacher.name;
        try {
            await setDoc(doc(db, 'teachers', teacherId), payload);

            let loginNote = '';
            const user = auth.currentUser;
            if (user) {
                try {
                    const token = await user.getIdToken();
                    const loginRes = await fetch('/api/create-teacher-login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ email }),
                    });
                    const loginData = await loginRes.json().catch(() => ({}));
                    if (loginRes.ok && loginData.created) {
                        loginNote = ` Login: ${email} / ${DEFAULT_NEW_USER_PASSWORD}`;
                    } else if (loginRes.ok && loginData.skipped) {
                        loginNote = ' (login already existed; password unchanged)';
                    } else if (!loginRes.ok) {
                        loginNote = ' Login not created — use Create logins button.';
                    }
                } catch {
                    loginNote = ' Login not created — use Create logins button.';
                }
            }

            setNewTeacher({ name: '', email: '', phone: '', role: '', subjectIds: [] });
            setIsDialogOpen(false);
            toast({
                title: 'Teacher Added',
                description: `${teacherName} has been added.${loginNote}`,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to add teacher.',
            });
        }
    };

    const handleCreateLogins = async () => {
        const user = auth.currentUser;
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please sign in first.' });
            return;
        }
        setIsCreatingLogins(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/create-teacher-logins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast({ variant: 'destructive', title: 'Error', description: data.error ?? 'Failed to create logins.' });
                return;
            }
            const msg = data.message ?? `Created ${data.created ?? 0} logins. ${data.skipped ?? 0} already had accounts.`;
            toast({ title: 'Logins created', description: msg });
            if (data.errors?.length) {
                toast({ variant: 'destructive', title: 'Some errors', description: data.errors.slice(0, 3).join('; ') });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create logins.' });
        } finally {
            setIsCreatingLogins(false);
        }
    };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
            Manage Teachers
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Teachers for {selectedAcademicYear}. Add or view profiles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={handleCreateLogins}
          disabled={isCreatingLogins || teachersForYear.length === 0}
          title={`Create logins for teachers without accounts (password: ${DEFAULT_NEW_USER_PASSWORD})`}
        >
          {isCreatingLogins ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Create logins
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Teacher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Teacher</DialogTitle>
              <DialogDescription>
                Fill in the details to add a new teacher to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {principal?.collegeId && (
                <div className="grid gap-2 rounded-md bg-muted/50 p-3 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <Label className="text-muted-foreground sm:text-right">College</Label>
                  <div className="text-sm font-medium sm:col-span-3">
                    {currentCollege ? (
                      <>
                        {currentCollege.name} <span className="text-muted-foreground">({currentCollege.code})</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Your college (default)</span>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="name" className="sm:text-right">
                  Name
                </Label>
                <Input id="name" value={newTeacher.name} onChange={(e) => setNewTeacher({...newTeacher, name: e.target.value})} className="sm:col-span-3" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="email" className="sm:text-right">
                  Email (login ID)
                </Label>
                <div className="sm:col-span-3 space-y-1">
                  <Input
                    id="email"
                    type="email"
                    value={newTeacher.email}
                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    New teachers get login password {DEFAULT_NEW_USER_PASSWORD}. Existing
                    logins are not changed.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="phone" className="sm:text-right">
                  Phone
                </Label>
                <Input id="phone" value={newTeacher.phone} onChange={(e) => setNewTeacher({...newTeacher, phone: e.target.value})} className="sm:col-span-3" />
              </div>
              <div className="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <Label htmlFor="role" className="sm:text-right">
                  Role
                </Label>
                <Input id="role" placeholder="e.g. Teacher, Senior Teacher" value={newTeacher.role} onChange={(e) => setNewTeacher({...newTeacher, role: e.target.value})} className="sm:col-span-3" />
              </div>
              <div className="space-y-3">
                <Label className="sm:text-right">Subjects</Label>
                <div className="grid gap-2 max-h-36 overflow-y-auto rounded-md border p-3 sm:col-span-3">
                  {allSubjects.map((subject) => (
                    <label key={subject.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={newTeacher.subjectIds.includes(subject.id)}
                        onCheckedChange={() => toggleNewTeacherSubject(subject.id)}
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
              <Button onClick={handleAddTeacher}>Save Teacher</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Subjects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachersForYear.map((teacher) => {
              const teacherImageId = teacher.id === 'teacher-01' ? 'teacher-profile' : `${teacher.id}-profile`;
              const teacherImage = PlaceHolderImages.find(p => p.id === teacherImageId);
              const avatarSrc = teacher.photoUrl ?? teacherImage?.imageUrl;

              return (
                <TableRow key={teacher.id} onClick={() => handleRowClick(teacher.id)} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={avatarSrc} />
                        <AvatarFallback>{teacher.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{teacher.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{teacher.email}</TableCell>
                  <TableCell>{teacher.phone}</TableCell>
                  <TableCell>
                    {teacher.roles && teacher.roles.length > 0
                      ? teacher.roles.join(', ')
                      : teacher.role || 'Teacher'}
                  </TableCell>
                  <TableCell>{getTeacherSubjectsDisplay(teacher, allSubjects)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
