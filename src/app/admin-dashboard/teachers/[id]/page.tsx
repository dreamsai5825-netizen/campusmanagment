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
  CalendarOff,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';
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
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, deleteDoc, updateDoc, collection, setDoc, query, where } from 'firebase/firestore';
import type { Teacher, Class, Subject, College, TeacherLeave } from '@/lib/types';
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

  // Leave Management States
  const [leaves, setLeaves] = useState<TeacherLeave[]>([]);
  const [isLogLeaveDialogOpen, setIsLogLeaveDialogOpen] = useState(false);
  const [isEditQuotaDialogOpen, setIsEditQuotaDialogOpen] = useState(false);
  const [leaveQuotaInput, setLeaveQuotaInput] = useState('12');
  const [savingQuota, setSavingQuota] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    date: new Date().toISOString().split('T')[0],
    typeCategory: 'Casual Leave (CL)',
    customTypeName: '',
    isHalfDay: false,
    halfDaySession: 'First Half (Morning)' as 'First Half (Morning)' | 'Second Half (Afternoon)',
    reason: '',
  });


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

  // Subscribe to Teacher Leaves
  useEffect(() => {
    if (!teacherId) return;
    const qLeaves = query(collection(db, 'teachers', teacherId, 'leaves'));
    const unsubLeaves = onSnapshot(qLeaves, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as TeacherLeave[];
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLeaves(list);
    });
    return () => unsubLeaves();
  }, [teacherId]);

  const DEFAULT_LEAVE_QUOTAS = useMemo<Record<string, number>>(() => ({
    'Casual Leave (CL)': 12,
    'Medical Leave (ML)': 8,
    'Loss of Pay (LOP)': 12,
    'Earned Leave (EL)': 10,
    'Duty Leave (OD)': 5,
  }), []);

  const categoryQuotas: Record<string, number> = useMemo(() => {
    return { ...DEFAULT_LEAVE_QUOTAS, ...(teacher?.leaveQuotas ?? {}) };
  }, [DEFAULT_LEAVE_QUOTAS, teacher?.leaveQuotas]);

  const [categoryQuotaForm, setCategoryQuotaForm] = useState<Record<string, number>>({});
  const [newCatName, setNewCatName] = useState('');
  const [newCatDays, setNewCatDays] = useState('');

  // Compute Category-wise Breakdown
  const categoryBreakdown = useMemo(() => {
    const categories = Array.from(
      new Set([...Object.keys(categoryQuotas), ...leaves.map((l) => l.type)])
    );

    const map: Record<string, { allotted: number; taken: number; balance: number }> = {};

    categories.forEach((cat) => {
      const allotted = categoryQuotas[cat] ?? 0;
      const taken = leaves
        .filter((l) => l.type === cat)
        .reduce((sum, l) => sum + (l.duration ?? 1.0), 0);
      const balance = Math.max(0, allotted - taken);
      map[cat] = { allotted, taken, balance };
    });

    return map;
  }, [categoryQuotas, leaves]);

  // Overall totals across all categories
  const overallTotals = useMemo(() => {
    let totalAllotted = 0;
    let totalTaken = 0;
    Object.values(categoryBreakdown).forEach((item) => {
      totalAllotted += item.allotted;
      totalTaken += item.taken;
    });
    const totalBalance = Math.max(0, totalAllotted - totalTaken);
    return { totalAllotted, totalTaken, totalBalance };
  }, [categoryBreakdown]);

  const openEditQuotaDialog = () => {
    setCategoryQuotaForm({ ...categoryQuotas });
    setNewCatName('');
    setNewCatDays('');
    setIsEditQuotaDialogOpen(true);
  };

  const handleAddCategoryQuota = () => {
    if (!newCatName.trim()) return;
    const days = parseFloat(newCatDays) || 0;
    setCategoryQuotaForm((prev) => ({
      ...prev,
      [newCatName.trim()]: days,
    }));
    setNewCatName('');
    setNewCatDays('');
  };

  const handleRemoveCategoryQuota = (catName: string) => {
    setCategoryQuotaForm((prev) => {
      const copy = { ...prev };
      delete copy[catName];
      return copy;
    });
  };

  const handleSaveCategoryQuotas = async () => {
    if (!teacher) return;
    setSavingQuota(true);
    try {
      await updateDoc(doc(db, 'teachers', teacher.id), { leaveQuotas: categoryQuotaForm });
      toast({
        title: 'Category Quotas Saved',
        description: `Leave category quotas updated for ${teacher.name}.`,
      });
      setIsEditQuotaDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save leave quotas.' });
    } finally {
      setSavingQuota(false);
    }
  };

  const handleLogLeave = async () => {
    if (!teacher || !leaveForm.date) {
      toast({ variant: 'destructive', title: 'Missing Date', description: 'Please select a leave date.' });
      return;
    }
    setSavingLeave(true);
    try {
      const finalType =
        leaveForm.typeCategory === 'Custom'
          ? leaveForm.customTypeName.trim() || 'Custom Leave'
          : leaveForm.typeCategory;

      const duration = leaveForm.isHalfDay ? 0.5 : 1.0;
      const leaveDocData: Omit<TeacherLeave, 'id'> = {
        teacherId: teacher.id,
        collegeId: teacher.collegeId,
        date: leaveForm.date,
        type: finalType,
        duration,
        ...(leaveForm.isHalfDay && { halfDaySession: leaveForm.halfDaySession }),
        reason: leaveForm.reason.trim() || 'No reason specified',
        createdAt: new Date().toISOString(),
        appliedBy: principal?.name || 'Principal',
      };

      const newRef = doc(collection(db, 'teachers', teacher.id, 'leaves'));
      await setDoc(newRef, leaveDocData);

      toast({
        title: 'Leave Logged Successfully',
        description: `${finalType} (${duration === 0.5 ? '0.5 Day' : '1.0 Day'}) recorded on ${format(new Date(leaveForm.date), 'dd MMM yyyy')} for ${teacher.name}.`,
      });

      setLeaveForm({
        date: new Date().toISOString().split('T')[0],
        typeCategory: 'Casual Leave (CL)',
        customTypeName: '',
        isHalfDay: false,
        halfDaySession: 'First Half (Morning)',
        reason: '',
      });
      setIsLogLeaveDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to record leave entry.' });
    } finally {
      setSavingLeave(false);
    }
  };

  const handleDeleteLeave = async (leaveId: string) => {
    if (!teacher) return;
    try {
      await deleteDoc(doc(db, 'teachers', teacher.id, 'leaves', leaveId));
      toast({ title: 'Leave Entry Revoked', description: 'Leave entry deleted and balance restored.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete leave entry.' });
    }
  };

  
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

          {/* Teacher Leave Management Card */}
          <Card className="border-purple-200/60 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 pb-4 rounded-t-xl">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CalendarOff className="h-5 w-5 text-purple-600" />
                  Leave Record & Quota
                </CardTitle>
                <CardDescription className="text-xs">
                  Track allotted leaves, half days, and leave balance for {teacher.name}.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Edit Category Quotas Button */}
                <Dialog open={isEditQuotaDialogOpen} onOpenChange={setIsEditQuotaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openEditQuotaDialog}
                      className="text-xs gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Configure Quotas
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle>Configure Leave Category Quotas</DialogTitle>
                      <DialogDescription>
                        Set annual allotted days for each leave category for {teacher.name}.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-3 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Category Quotas List
                        </Label>
                        {Object.entries(categoryQuotaForm).map(([catName, days]) => (
                          <div key={catName} className="flex items-center justify-between gap-3 border p-2.5 rounded-xl bg-card">
                            <span className="text-sm font-semibold text-foreground flex-1">{catName}</span>
                            <div className="flex items-center gap-2 w-32">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                value={days}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setCategoryQuotaForm((prev) => ({ ...prev, [catName]: val }));
                                }}
                                className="h-8 text-right font-bold"
                              />
                              <span className="text-xs text-muted-foreground">days</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCategoryQuota(catName)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Category Quota Section */}
                      <div className="border p-3 rounded-xl bg-muted/30 space-y-2">
                        <Label className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                          + Add New Leave Category
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Category Name (e.g. Maternity Leave)"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            className="h-8 text-xs flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Days"
                            value={newCatDays}
                            onChange={(e) => setNewCatDays(e.target.value)}
                            className="h-8 text-xs w-20 text-right"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddCategoryQuota}
                            variant="secondary"
                            className="h-8 text-xs shrink-0"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditQuotaDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveCategoryQuotas} disabled={savingQuota}>
                        {savingQuota ? 'Saving...' : 'Save Category Quotas'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Log Leave Button */}
                <Dialog open={isLogLeaveDialogOpen} onOpenChange={setIsLogLeaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
                      <PlusCircle className="h-4 w-4" />
                      Grant / Log Leave
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CalendarOff className="h-5 w-5 text-purple-600" />
                        Log Leave for {teacher.name}
                      </DialogTitle>
                      <DialogDescription>
                        Record a full day or half day leave entry.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                      {/* Leave Date */}
                      <div className="space-y-1.5">
                        <Label htmlFor="leave-date">Leave Date</Label>
                        <Input
                          id="leave-date"
                          type="date"
                          value={leaveForm.date}
                          onChange={(e) => setLeaveForm((prev) => ({ ...prev, date: e.target.value }))}
                          required
                        />
                      </div>

                      {/* Full Day vs Half Day Switcher */}
                      <div className="space-y-2 border p-3.5 rounded-xl bg-muted/30">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                          Leave Duration & Session
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setLeaveForm((prev) => ({ ...prev, isHalfDay: false }))}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              !leaveForm.isHalfDay
                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 ring-1 ring-purple-600'
                                : 'bg-card hover:border-muted-foreground/30'
                            }`}
                          >
                            <div className="font-bold text-sm text-foreground">Full Day</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Deducts 1.0 day</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setLeaveForm((prev) => ({ ...prev, isHalfDay: true }))}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              leaveForm.isHalfDay
                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 ring-1 ring-purple-600'
                                : 'bg-card hover:border-muted-foreground/30'
                            }`}
                          >
                            <div className="font-bold text-sm text-foreground">Half Day 🌓</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Deducts 0.5 day</div>
                          </button>
                        </div>

                        {/* If Half Day -> Choose Session */}
                        {leaveForm.isHalfDay && (
                          <div className="space-y-2 pt-2 border-t mt-3">
                            <Label className="text-xs font-medium">Select Half Day Session</Label>
                            <RadioGroup
                              value={leaveForm.halfDaySession}
                              onValueChange={(val) =>
                                setLeaveForm((prev) => ({
                                  ...prev,
                                  halfDaySession: val as 'First Half (Morning)' | 'Second Half (Afternoon)',
                                }))
                              }
                              className="grid grid-cols-2 gap-2"
                            >
                              <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-card cursor-pointer">
                                <RadioGroupItem value="First Half (Morning)" id="r1" />
                                <Label htmlFor="r1" className="cursor-pointer text-xs font-medium">
                                  🌅 First Half (Morning)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-card cursor-pointer">
                                <RadioGroupItem value="Second Half (Afternoon)" id="r2" />
                                <Label htmlFor="r2" className="cursor-pointer text-xs font-medium">
                                  🌆 Second Half (Afternoon)
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>

                      {/* Leave Type / Category Selector */}
                      <div className="space-y-1.5">
                        <Label htmlFor="leave-type">Leave Category / Type</Label>
                        <Select
                          value={leaveForm.typeCategory}
                          onValueChange={(val) =>
                            setLeaveForm((prev) => ({ ...prev, typeCategory: val }))
                          }
                        >
                          <SelectTrigger id="leave-type">
                            <SelectValue placeholder="Select leave category..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(categoryBreakdown).map(([catName, info]) => (
                              <SelectItem key={catName} value={catName}>
                                {catName} — (Bal: {info.balance.toFixed(1)} / {info.allotted} days)
                              </SelectItem>
                            ))}
                            <SelectItem value="Custom">✏️ Enter Custom Leave Type...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Custom Leave Type Text Input if "Custom" is selected */}
                      {leaveForm.typeCategory === 'Custom' && (
                        <div className="space-y-1.5 bg-purple-50/60 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200">
                          <Label htmlFor="custom-type-name" className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                            Enter Custom Leave Type Name
                          </Label>
                          <Input
                            id="custom-type-name"
                            placeholder="e.g. Quarantine Leave, Exam Duty, Sabbatical..."
                            value={leaveForm.customTypeName}
                            onChange={(e) =>
                              setLeaveForm((prev) => ({ ...prev, customTypeName: e.target.value }))
                            }
                            required
                          />
                        </div>
                      )}

                      {/* Reason / Remarks */}
                      <div className="space-y-1.5">
                        <Label htmlFor="leave-reason">Reason / Remarks</Label>
                        <Input
                          id="leave-reason"
                          placeholder="e.g. Personal work, Doctor appointment, etc."
                          value={leaveForm.reason}
                          onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsLogLeaveDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleLogLeave} disabled={savingLeave} className="bg-purple-600 hover:bg-purple-700 text-white">
                        {savingLeave ? 'Recording...' : 'Grant & Save Leave'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">
              {/* Overall Summary Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-xl p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200">
                  <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                    Total Allotted
                  </div>
                  <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1">
                    {overallTotals.totalAllotted.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">days</span>
                  </div>
                </div>

                <div className="border rounded-xl p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Total Taken
                  </div>
                  <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                    {overallTotals.totalTaken.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">days</span>
                  </div>
                </div>

                <div
                  className={`border rounded-xl p-3.5 ${
                    overallTotals.totalBalance > 5
                      ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20'
                      : overallTotals.totalBalance > 0
                      ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-950/20'
                      : 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/20'
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Balance
                  </div>
                  <div
                    className={`text-2xl font-extrabold mt-1 ${
                      overallTotals.totalBalance > 5
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : overallTotals.totalBalance > 0
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {overallTotals.totalBalance.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">days</span>
                  </div>
                </div>
              </div>

              {/* Category-Wise Quotas Breakdown Grid */}
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Category-Wise Quotas Breakdown
                </Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(categoryBreakdown).map(([catName, item]) => (
                    <div key={catName} className="border rounded-xl p-3 bg-card space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="truncate pr-1">{catName}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0 ${
                            item.balance > 2
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : item.balance > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}
                        >
                          Bal: {item.balance.toFixed(1)}d
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground pt-1 border-t">
                        <div>Alloted: <span className="font-semibold text-foreground">{item.allotted}</span></div>
                        <div>Taken: <span className="font-semibold text-amber-600">{item.taken.toFixed(1)}</span></div>
                        <div>Bal: <span className="font-semibold text-emerald-600">{item.balance.toFixed(1)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave History List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground tracking-wider border-b pb-2">
                  <span>Leave Log History ({leaves.length})</span>
                  <span>Duration / Type</span>
                </div>

                {leaves.length === 0 ? (
                  <div className="text-center py-8 border rounded-xl bg-muted/20 text-muted-foreground">
                    <CalendarOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No leave records entered yet.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Use &quot;Grant / Log Leave&quot; above to record teacher leaves.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {leaves.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">
                              {format(new Date(item.date), 'dd MMM yyyy')}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0 font-semibold ${
                                item.duration === 0.5
                                  ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {item.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-sm">
                            {item.reason}
                            {item.halfDaySession && (
                              <span className="ml-1 text-purple-600 dark:text-purple-400 font-medium">
                                ({item.halfDaySession})
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span
                              className={`text-sm font-extrabold px-2.5 py-1 rounded-lg ${
                                item.duration === 0.5
                                  ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}
                            >
                              {item.duration === 0.5 ? '0.5 Day' : '1.0 Day'}
                            </span>
                          </div>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke Leave Entry?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the leave entry for {format(new Date(item.date), 'dd MMM yyyy')} and credit {item.duration} day(s) back to {teacher.name}&apos;s balance.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteLeave(item.id)}>
                                  Revoke Leave
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

    