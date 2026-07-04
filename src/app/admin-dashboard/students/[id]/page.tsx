'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { use } from 'react';
import {
  ArrowLeft,
  Book,
  Phone,
  User,
  Users,
  Landmark,
  CheckCircle2,
  XCircle,
  CircleEllipsis,
  CalendarDays,
  NotebookText,
  Mail,
  Trash2,
  Edit,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, deleteDoc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { generateParentId } from '@/lib/id-utils';
import type { Student, Class, Parent, Subject } from '@/lib/types';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { StudentAttendanceModal } from '@/components/student-attendance-modal';


function getFeeStatusFromAmounts(totalFees: number, paid: number): 'Paid' | 'Partially Paid' | 'Not Paid' {
  if (totalFees <= 0) return 'Not Paid';
  if (paid >= totalFees) return 'Paid';
  if (paid > 0) return 'Partially Paid';
  return 'Not Paid';
}

type StudentFormData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  studentId: string;
  classId: string;
  parentName: string;
  parentRelationship: string;
  parentPhone: string;
  totalFees: number;
  feePaid: number;
  dateOfBirth: string;
  caste: string;
  subCaste: string;
};

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = use(params);
  const principal = useCurrentPrincipal();
  const { getPath } = useDashboardPath();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [studentParent, setStudentParent] = useState<Parent | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  const router = useRouter();
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<StudentFormData | null>(null);

  useEffect(() => {
    if (studentId) {
      const unsubStudent = onSnapshot(doc(db, 'students', studentId), (doc) => {
        if (doc.exists()) {
          setStudent({ id: doc.id, ...doc.data() } as Student);
        } else {
          notFound();
        }
      });

      const q = query(collection(db, "parents"), where("studentId", "==", studentId));
      const unsubParent = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const parentDoc = snapshot.docs[0];
            setStudentParent({ id: parentDoc.id, ...parentDoc.data() } as Parent);
        } else {
            setStudentParent(null);
        }
      });

      return () => {
        unsubStudent();
        unsubParent();
      };
    }
  }, [studentId]);

  useEffect(() => {
    if (!principal?.collegeId) {
      setClasses([]);
      return;
    }
    const q = query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId));
    const unsubClasses = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });
    return () => unsubClasses();
  }, [principal?.collegeId]);

  useEffect(() => {
    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      setAllSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });
    return () => unsubSubjects();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('edit') === 'true') {
        setIsEditDialogOpen(true);
      }
    }
  }, []);


  useEffect(() => {
    if (isEditDialogOpen && student) {
      const totalFees = student.fees?.totalFees ?? 0;
      const paid = student.fees?.paid ?? 0;
      setFormData({
        id: student.id,
        name: student.name ?? '',
        email: student.email ?? '',
        phone: student.phone ?? '',
        studentId: student.studentId ?? student.usn ?? '',
        classId: student.classId ?? '',
        parentName: studentParent?.name || '',
        parentRelationship: studentParent?.relationship || '',
        parentPhone: studentParent?.phone || '',
        totalFees,
        feePaid: paid,
        dateOfBirth: student.dateOfBirth ?? '',
        caste: student.caste ?? '',
        subCaste: student.subCaste ?? '',
      });
    } else {
      setFormData(null);
    }
  }, [isEditDialogOpen, student, studentParent]);


  if (!student) {
    return null; // or a loading spinner
  }

  const studentImage = PlaceHolderImages.find((p) => p.id === student.id);
  const studentPhotoUrl = student.photoUrl ?? studentImage?.imageUrl;
  const studentClass = classes.find((c) => c.id === student.classId);

  const summary = student.attendance?.summary;
  const attendancePercentage =
    summary && summary.totalDays > 0
      ? (summary.present / summary.totalDays) * 100
      : 0;

  const getFeeStatus = (status: string) => {
    switch (status) {
      case 'Paid':
        return { icon: CheckCircle2, color: 'text-green-600' };
      case 'Partially Paid':
        return { icon: CircleEllipsis, color: 'text-yellow-500' };
      case 'Not Paid':
        return { icon: XCircle, color: 'text-red-600' };
      default:
        return { icon: CircleEllipsis, color: 'text-muted-foreground' };
    }
  };
  const totalFees = student.fees?.totalFees ?? 0;
  const feesPaid = student.fees?.paid ?? 0;
  const feeBalance = student.fees?.balance ?? Math.max(0, totalFees - feesPaid);
  const feeStatus = student.fees?.status ?? getFeeStatusFromAmounts(totalFees, feesPaid);
  const feeStatusInfo = getFeeStatus(feeStatus);
  const FeeStatusIcon = feeStatusInfo.icon;
  
  const handleDeleteStudent = async () => {
    if (!student) return;
    try {
        await deleteDoc(doc(db, 'students', student.id));
        // Also delete parent if exists
        if(studentParent) {
            await deleteDoc(doc(db, 'parents', studentParent.id));
        }
        toast({
        variant: 'destructive',
        title: 'Student Removed',
        description: `${student.name} has been removed from the system.`,
        });
        router.push(getPath('/students'));
    } catch(error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to remove student.',
        });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!formData) return;
    const { id, value, type } = e.target;
    const parsed = type === 'number' ? (parseFloat(value) || 0) : value;
    setFormData({ ...formData, [id]: parsed });
  };
  
  const handleSelectChange = (id: string, value: string) => {
    if (!formData) return;
    setFormData({ ...formData, [id]: value });
  };

  const handleSaveChanges = async () => {
    if (!formData) return;

    try {
        const totalFees = Number(formData.totalFees) || 0;
        const paid = Number(formData.feePaid) || 0;
        const balance = Math.max(0, totalFees - paid);
        const status = getFeeStatusFromAmounts(totalFees, paid);

        const studentRef = doc(db, 'students', formData.id);
        await updateDoc(studentRef, {
            name: (formData.name ?? '').trim(),
            email: (formData.email ?? '').trim(),
            phone: (formData.phone ?? '').trim(),
            studentId: (formData.studentId ?? '').trim(),
            usn: (formData.studentId ?? '').trim(),
            classId: (formData.classId ?? '').trim(),
            dateOfBirth: (formData.dateOfBirth ?? '').trim(),
            caste: (formData.caste ?? '').trim(),
            subCaste: (formData.subCaste ?? '').trim(),
            fees: {
                totalFees,
                paid,
                balance,
                status,
            }
        });

        if (studentParent) {
            const parentRef = doc(db, 'parents', studentParent.id);
            await updateDoc(parentRef, {
                name: (formData.parentName ?? '').trim(),
                relationship: (formData.parentRelationship ?? '').trim(),
                phone: (formData.parentPhone ?? '').trim(),
            });
        } else if ((formData.parentName ?? '').trim()) {
            const parentId = generateParentId(formData.id, formData.parentName);
            await setDoc(doc(db, 'parents', parentId), {
                studentId: formData.id,
                name: (formData.parentName ?? '').trim(),
                relationship: (formData.parentRelationship ?? '').trim(),
                phone: (formData.parentPhone ?? '').trim(),
            });
        }

        toast({
        title: 'Profile Updated',
        description: `${formData.name}'s profile has been updated successfully.`,
        });
        setIsEditDialogOpen(false);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update profile.';
        toast({
            variant: 'destructive',
            title: 'Error',
            description: message,
        });
    }
  };


  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href={getPath('/students')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Student Profile
            </h1>
            <p className="text-muted-foreground">
              Detailed information about {student.name}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline"><Edit className="mr-2 h-4 w-4" />Edit Profile</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit Profile: {student.name}</DialogTitle>
                        <DialogDescription>
                        Make changes to the student's profile below. Click save when you're done.
                        </DialogDescription>
                    </DialogHeader>
                    {formData && (
                    <ScrollArea className="max-h-[70vh] p-4">
                        <div className="space-y-8">
                        
                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold text-lg">Personal Details</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Full Name</Label>
                                        <Input id="name" value={formData.name} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="studentId">USN / Student ID</Label>
                                        <Input id="studentId" value={formData.studentId} onChange={handleInputChange} placeholder="e.g. U15SE2550001" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" value={formData.phone} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="classId">Class</Label>
                                        <Select
                                          value={formData.classId || '__none'}
                                          onValueChange={(value) =>
                                            handleSelectChange('classId', value === '__none' ? '' : value)
                                          }
                                        >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select class" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none">No class</SelectItem>
                                                {classes.map((c) => (
                                                  <SelectItem key={c.id} value={c.id}>
                                                    {c.name}
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">Assign or change the student&apos;s class.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                                        <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="caste">Caste</Label>
                                        <Input id="caste" value={formData.caste} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="subCaste">Sub-caste</Label>
                                        <Input id="subCaste" value={formData.subCaste} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold text-lg">Parent/Guardian Details</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="parentName">Full Name</Label>
                                        <Input id="parentName" value={formData.parentName} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="parentRelationship">Relationship</Label>
                                        <Input id="parentRelationship" value={formData.parentRelationship} onChange={handleInputChange} />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="parentPhone">Phone</Label>
                                        <Input id="parentPhone" value={formData.parentPhone} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold text-lg">Financial Details</h3>
                                <p className="text-sm text-muted-foreground">Status updates automatically from Total fees and Fees paid.</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="totalFees">Total fees (₹)</Label>
                                        <Input
                                          id="totalFees"
                                          type="number"
                                          min={0}
                                          value={formData.totalFees || ''}
                                          onChange={handleInputChange}
                                          placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="feePaid">Fees paid (₹)</Label>
                                        <Input
                                          id="feePaid"
                                          type="number"
                                          min={0}
                                          value={formData.feePaid || ''}
                                          onChange={handleInputChange}
                                          placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Balance (₹)</Label>
                                        <Input
                                          readOnly
                                          className="bg-muted font-medium"
                                          value={Math.max(0, (Number(formData.totalFees) || 0) - (Number(formData.feePaid) || 0))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Status</Label>
                                        <Input
                                          readOnly
                                          className="bg-muted font-medium capitalize"
                                          value={getFeeStatusFromAmounts(Number(formData.totalFees) || 0, Number(formData.feePaid) || 0)}
                                        />
                                    </div>
                                </div>
                            </div>

                             <div className="space-y-4 rounded-lg border p-4">
                                <h3 className="font-semibold text-lg">Profile Photo</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="photo">Upload new photo</Label>
                                    <div className="flex items-center gap-2">
                                        <Input id="photo" type="file" className="flex-1"/>
                                        <Button variant="outline" size="icon"><Upload className="h-4 w-4"/></Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">This is for demonstration and does not currently work.</p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    )}
                    <DialogFooter className="pt-4">
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveChanges}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Student
                </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    this student's account and remove their data from our servers.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteStudent}>
                    Continue
                    </AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="text-center">
            <CardHeader className="items-center">
              <Avatar className="h-32 w-32 rounded-full border-4 border-primary/20 mx-auto">
                <AvatarImage src={studentPhotoUrl ?? undefined} alt={student.name} />
                <AvatarFallback className="text-3xl">{student.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <CardTitle className="pt-4">{student.name}</CardTitle>
              <CardDescription>
                Student ID: {student.studentId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentClass && <Badge>{studentClass.name}</Badge>}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="flex items-center">
                <User className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Full Name:</span>
                <span className="text-muted-foreground">{student.name}</span>
              </div>
              <div className="flex items-center">
                <Mail className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Email:</span>
                <span className="text-muted-foreground">{student.email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Student Phone:</span>
                <span className="text-muted-foreground">{student.phone}</span>
              </div>
              {student.dateOfBirth && (
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-3 text-muted-foreground" />
                  <span className="font-medium w-32">Date of Birth:</span>
                  <span className="text-muted-foreground">{student.dateOfBirth}</span>
                </div>
              )}
              {student.caste && (
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-3 text-muted-foreground" />
                  <span className="font-medium w-32">Caste:</span>
                  <span className="text-muted-foreground">{student.caste}</span>
                </div>
              )}
              {student.subCaste && (
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-3 text-muted-foreground" />
                  <span className="font-medium w-32">Sub-caste:</span>
                  <span className="text-muted-foreground">{student.subCaste}</span>
                </div>
              )}
              <div className="flex items-center">
                <Book className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Class:</span>
                <span className="text-muted-foreground">
                  {studentClass?.name} - {studentClass?.subject}
                </span>
              </div>
              {studentParent && (
                <>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className="font-medium w-32">Parent/Guardian:</span>
                    <span className="text-muted-foreground">
                      {studentParent.name} ({studentParent.relationship})
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className="font-medium w-32">Parent's Phone:</span>
                    <span className="text-muted-foreground">
                      {studentParent.phone}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Fee Details
            </CardTitle>
            <CardDescription>
              Status is updated automatically from total fees and amount paid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total fees</span>
              <span className="font-medium">₹{totalFees.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fees paid</span>
              <span className="font-medium text-green-600">₹{feesPaid.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-bold text-lg">₹{feeBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-2 font-medium">
                <FeeStatusIcon className={cn('h-5 w-5', feeStatusInfo.color)} />
                <span className={feeStatusInfo.color}>{feeStatus}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Attendance Record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Present</span>
              <span className="font-medium text-green-600">
                {summary?.present ?? 0} days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Absent</span>
              <span className="font-medium text-red-600">
                {summary?.absent ?? 0} days
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Percentage</span>
                <span className="font-bold text-lg">
                  {attendancePercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={attendancePercentage} className="h-2" />
            </div>
            <StudentAttendanceModal
              studentId={student.id}
              studentName={student.name}
              allSubjects={allSubjects}
              viewAll={true}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookText className="h-5 w-5 text-primary" />
              Internal Assessment
            </CardTitle>
            <CardDescription>
              View student marks for each subject.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
                {(student.assessments ?? []).map(assessment => (
                    <div key={assessment.subject} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{assessment.subject}</span>
                        <span className="font-bold">{assessment.marks} / 100</span>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
