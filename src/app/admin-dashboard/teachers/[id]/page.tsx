'use client';

import Image from 'next/image';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { use } from 'react';
import {
  ArrowLeft,
  Book,
  Mail,
  Phone,
  User,
  Hash,
  Trash2,
  BookOpenCheck,
  PlusCircle,
  BookUp,
  Edit,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, deleteDoc, updateDoc, collection, setDoc, query, where } from 'firebase/firestore';
import type { Teacher, Class, Subject, College } from '@/lib/types';
import { getClassSubjectsDisplay, getTeacherSubjectsDisplay } from '@/lib/subject-utils';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { getCollegeById } from '@/lib/college-service';


export default function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: teacherId } = use(params);
  const principal = useCurrentPrincipal();
  const { getPath } = useDashboardPath();
  
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [currentCollege, setCurrentCollege] = useState<College | null>(null);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<Class[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  const router = useRouter();
  const { toast } = useToast();
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedClassToAssign, setSelectedClassToAssign] = useState<string | null>(null);
  
  const [isAssignSubjectDialogOpen, setIsAssignSubjectDialogOpen] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', subjectIds: [] as string[] });
  
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');


  useEffect(() => {
    if (!teacherId) return;
    const unsubTeacher = onSnapshot(doc(db, 'teachers', teacherId), (docSnap) => {
      if (docSnap.exists()) {
        const teacherData = { id: docSnap.id, ...docSnap.data() } as Teacher;
        setTeacher(teacherData);
        setRoles(teacherData.roles || []);
      } else {
        setTeacher(null);
        notFound();
      }
    });
    return () => unsubTeacher();
  }, [teacherId]);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setCurrentCollege(null);
      return;
    }
    getCollegeById(teacher.collegeId).then(setCurrentCollege);
  }, [teacher?.collegeId]);

  useEffect(() => {
    if (!principal?.collegeId) {
      setAllClasses([]);
      setAllSubjects([]);
      return;
    }
    const qClasses = query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
        setAllClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });
    const qSubjects = query(collection(db, 'subjects'), where('collegeId', '==', principal.collegeId));
    const unsubSubjects = onSnapshot(qSubjects, (snapshot) => {
        setAllSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });
    return () => {
        unsubClasses();
        unsubSubjects();
    };
  }, [principal?.collegeId]);

  useEffect(() => {
    if (!teacherId || allClasses.length === 0) return;

    const assignedClassesRef = collection(db, 'teachers', teacherId, 'assignedClasses');
    const unsubAssigned = onSnapshot(assignedClassesRef, (snapshot) => {
        const classIds = snapshot.docs.map(d => d.id);
        setAssignedClasses(allClasses.filter(c => classIds.includes(c.id)));
    });

    return () => unsubAssigned();
  }, [teacherId, allClasses]);

  
  if (!teacher) {
    return null; // Or a loading indicator
  }

  const handleEditDialogOpenChange = (open: boolean) => {
    setIsEditDialogOpen(open);
    if (open && teacher) {
      setEditForm({
        name: teacher.name ?? '',
        email: teacher.email ?? '',
        phone: teacher.phone ?? '',
        subjectIds: teacher.subjectIds ?? [],
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!teacher) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name and email are required.' });
      return;
    }
    try {
      const firstSubjectName = editForm.subjectIds.length && allSubjects.length
        ? (allSubjects.find((s) => s.id === editForm.subjectIds[0])?.name ?? '')
        : '';
      await updateDoc(doc(db, 'teachers', teacher.id), {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: (editForm.phone ?? '').trim(),
        subjectIds: editForm.subjectIds,
        subjectSpecialty: firstSubjectName,
      });
      toast({ title: 'Profile updated', description: `${editForm.name}'s profile has been saved.` });
      setIsEditDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update profile.' });
    }
  };

  const toggleEditSubject = (subjectId: string) => {
    setEditForm((prev) => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter((id) => id !== subjectId)
        : [...prev.subjectIds, subjectId],
    }));
  };

  const handleDeleteTeacher = async () => {
    if (!teacher) return;
    try {
      await deleteDoc(doc(db, 'teachers', teacher.id));
      toast({
        variant: 'destructive',
        title: 'Teacher Removed',
        description: `${teacher.name} has been removed.`,
      });
      router.push(getPath('/teachers'));
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove teacher.' });
    }
  };

  const handleUnassignClass = async (classId: string) => {
    if(!teacher) return;
    const classToUnassign = assignedClasses.find((c) => c.id === classId);
    try {
        await deleteDoc(doc(db, 'teachers', teacher.id, 'assignedClasses', classId));
        if (classToUnassign) {
            toast({
                variant: 'destructive',
                title: 'Class Unassigned',
                description: `${classToUnassign.name} has been unassigned from ${teacher.name}.`,
            });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to unassign class.' });
    }
  };

  const handleAssignClass = async () => {
    if (!selectedClassToAssign || !teacher) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a class to assign.' });
      return;
    }
    const classToAssign = allClasses.find((c) => c.id === selectedClassToAssign);
    if (classToAssign) {
      try {
        await setDoc(doc(db, 'teachers', teacher.id, 'assignedClasses', classToAssign.id), {});
        toast({
            title: 'Class Assigned',
            description: `${classToAssign.name} has been assigned to ${teacher.name}.`,
        });
        setSelectedClassToAssign(null);
        setIsAssignDialogOpen(false);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign class.' });
      }
    }
  };

  const openAssignSubjectDialog = () => {
    if (teacher?.subjectIds?.length) {
      setSelectedSubjectIds([...teacher.subjectIds]);
    } else if (teacher?.subjectSpecialty) {
      const id = allSubjects.find((s) => s.name === teacher.subjectSpecialty)?.id;
      setSelectedSubjectIds(id ? [id] : []);
    } else {
      setSelectedSubjectIds([]);
    }
    setIsAssignSubjectDialogOpen(true);
  };

  const toggleTeacherSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleAssignSubject = async () => {
    if (!teacher) return;
    try {
      const teacherRef = doc(db, 'teachers', teacher.id);
      const firstSubjectName = selectedSubjectIds.length
        ? allSubjects.find((s) => s.id === selectedSubjectIds[0])?.name ?? ''
        : '';
      await updateDoc(teacherRef, { subjectIds: selectedSubjectIds, subjectSpecialty: firstSubjectName });
      const names = selectedSubjectIds
        .map((id) => allSubjects.find((s) => s.id === id)?.name)
        .filter(Boolean);
      toast({
        title: 'Subjects Assigned',
        description: names.length
          ? `${names.join(', ')} assigned to ${teacher.name}.`
          : `Subjects updated for ${teacher.name}.`,
      });
      setSelectedSubjectIds([]);
      setIsAssignSubjectDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign subjects.' });
    }
  };

  const handleAddRole = async () => {
    if (!roleInput.trim()) return;
    const newRole = roleInput.trim();
    if (roles.includes(newRole)) {
      toast({ variant: 'destructive', title: 'Error', description: 'This role is already added.' });
      return;
    }
    const updatedRoles = [...roles, newRole];
    setRoles(updatedRoles);
    setRoleInput('');
    
    // Save to database
    if (teacher) {
      try {
        await updateDoc(doc(db, 'teachers', teacher.id), { roles: updatedRoles });
        toast({ title: 'Role added', description: `${newRole} has been added to ${teacher.name}.` });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add role.' });
        setRoles(roles);
      }
    }
  };

  const handleRemoveRole = async (index: number) => {
    const removedRole = roles[index];
    const updatedRoles = roles.filter((_, i) => i !== index);
    setRoles(updatedRoles);
    
    // Save to database
    if (teacher) {
      try {
        await updateDoc(doc(db, 'teachers', teacher.id), { roles: updatedRoles });
        toast({ title: 'Role removed', description: `${removedRole} has been removed.` });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove role.' });
        setRoles([...updatedRoles.slice(0, index), removedRole, ...updatedRoles.slice(index)]);
      }
    }
  };

  const unassignedClasses = allClasses.filter(
    (c) => !assignedClasses.some((ac) => ac.id === c.id)
  );
  
  const teacherImageId =
    teacher.id === 'teacher-01' ? 'teacher-profile' : `${teacher.id}-profile`;
  const teacherImage = PlaceHolderImages.find((p) => p.id === teacherImageId);
  const profilePhotoUrl = teacher.photoUrl ?? teacherImage?.imageUrl;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={getPath('/teachers')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Teacher Profile
            </h1>
            <p className="text-muted-foreground">
              Detailed information about {teacher.name}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit Profile: {teacher.name}</DialogTitle>
                <DialogDescription>
                  Update teacher details. Name and email are required.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="grid gap-4 py-4 pr-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subjects</Label>
                    <div className="grid gap-2 max-h-32 overflow-y-auto rounded-md border p-3">
                      {allSubjects.map((subject) => (
                        <label key={subject.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={editForm.subjectIds.includes(subject.id)}
                            onCheckedChange={() => toggleEditSubject(subject.id)}
                          />
                          <span className="text-sm">{subject.name}</span>
                        </label>
                      ))}
                      {allSubjects.length === 0 && (
                        <p className="text-sm text-muted-foreground">No subjects in college.</p>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Teacher
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  this teacher's account and remove their data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTeacher}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="text-center">
            <CardHeader className="items-center">
              {profilePhotoUrl ? (
                <Image
                  src={profilePhotoUrl}
                  alt={teacher.name}
                  width={128}
                  height={128}
                  className="rounded-full border-4 border-primary/20 size-32 object-cover"
                  style={{ width: 128, height: 128, objectFit: 'cover' }}
                  data-ai-hint={teacherImage?.imageHint}
                />
              ) : (
                <div className="rounded-full border-4 border-primary/20 size-32 flex items-center justify-center bg-muted text-2xl font-semibold">
                  {teacher.name.charAt(0)}
                </div>
              )}
              <CardTitle className="pt-4">{teacher.name}</CardTitle>
              <CardDescription>{getTeacherSubjectsDisplay(teacher, allSubjects)}</CardDescription>
            </CardHeader>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Contact & Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="flex items-center">
                <Building2 className="h-5 w-5 mr-3 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium w-32 block text-muted-foreground">College</span>
                  <span className="font-medium text-foreground">
                    {currentCollege ? (
                      <>
                        {currentCollege.name}
                        {currentCollege.code && (
                          <span className="text-muted-foreground font-normal"> ({currentCollege.code})</span>
                        )}
                      </>
                    ) : teacher.collegeId ? (
                      <span className="text-muted-foreground">Loading…</span>
                    ) : (
                      <span className="text-muted-foreground">Not linked</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center">
                <Hash className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Teacher ID:</span>
                <span className="text-muted-foreground font-mono">
                  {teacher.id}
                </span>
              </div>
              <div className="flex items-center">
                <User className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Full Name:</span>
                <span className="text-muted-foreground">{teacher.name}</span>
              </div>
              <div className="flex items-center">
                <Mail className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Email:</span>
                <span className="text-muted-foreground">{teacher.email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Phone:</span>
                <span className="text-muted-foreground">{teacher.phone}</span>
              </div>
              <div className="flex items-center">
                <Book className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Subjects:</span>
                <span className="text-muted-foreground">
                  {getTeacherSubjectsDisplay(teacher, allSubjects)}
                </span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Roles & Designations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter role (e.g. Senior Teacher, HOD)..."
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRole();
                    }
                  }}
                />
                <Button onClick={handleAddRole} size="sm" variant="outline">
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.length > 0 ? (
                  roles.map((role, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                    >
                      <span className="text-sm font-medium">{role}</span>
                      <button
                        onClick={() => handleRemoveRole(index)}
                        className="text-primary hover:bg-primary/20 rounded-full p-0.5"
                        aria-label="Remove role"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No roles assigned yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Assigned Classes</CardTitle>
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Assign Class
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Class to {teacher.name}</DialogTitle>
                    <DialogDescription>
                      Select a class from the list to assign it.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-2">
                    <Label htmlFor="class-select">Available Classes</Label>
                    <Select onValueChange={setSelectedClassToAssign}>
                      <SelectTrigger id="class-select">
                        <SelectValue placeholder="Select a class..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedClasses.length > 0 ? (
                          unassignedClasses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} - {getClassSubjectsDisplay(c, allSubjects)}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-center text-muted-foreground">
                            No available classes to assign.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAssignClass} disabled={!selectedClassToAssign}>
                      Assign
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {assignedClasses.length > 0 ? (
                <ul className="space-y-2">
                  {assignedClasses.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/50"
                    >
                      <BookOpenCheck className="h-5 w-5 text-primary" />
                      <div className="flex-grow">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted-foreground">{getClassSubjectsDisplay(c, allSubjects)}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will unassign "{c.name}" from {teacher.name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleUnassignClass(c.id)}>
                              Unassign
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No classes assigned.
                </p>
              )}
            </CardContent>
          </Card>
          
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Subject Assignment</CardTitle>
              <Dialog open={isAssignSubjectDialogOpen} onOpenChange={setIsAssignSubjectDialogOpen}>
                  <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={openAssignSubjectDialog}>
                      <BookUp className="mr-2 h-4 w-4" />
                      Assign Subjects
                  </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                      <DialogTitle>Assign Subjects to {teacher.name}</DialogTitle>
                      <DialogDescription>
                      Select one or more subjects this teacher teaches.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-2">
                      <Label>Subjects</Label>
                      <div className="grid gap-2 max-h-48 overflow-y-auto rounded-md border p-3">
                          {allSubjects.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={selectedSubjectIds.includes(s.id)}
                                onCheckedChange={() => toggleTeacherSubject(s.id)}
                              />
                              <span className="text-sm">{s.name}</span>
                            </label>
                          ))}
                          {allSubjects.length === 0 && (
                            <p className="text-sm text-muted-foreground">No subjects. Add subjects first.</p>
                          )}
                      </div>
                  </div>
                  <DialogFooter>
                      <Button onClick={handleAssignSubject}>
                      Save Changes
                      </Button>
                  </DialogFooter>
                  </DialogContent>
              </Dialog>
              </CardHeader>
              <CardContent>
                  <div className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/50">
                      <Book className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-muted-foreground">
                          {getTeacherSubjectsDisplay(teacher, allSubjects) || 'No subjects assigned.'}
                      </span>
                  </div>
              </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

    