'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { collection, doc, onSnapshot, query, updateDoc, setDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateParentId } from '@/lib/id-utils';
import { useCurrentStudent } from '@/hooks/use-current-user';
import type { Parent, Class, College, Subject } from '@/lib/types';
import { getCollegeById } from '@/lib/college-service';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  CircleEllipsis,
  Landmark,
  CalendarDays,
  NotebookText,
  Building2,
  Users,
  BookOpen,
  CreditCard,
  Coins,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePhoto } from '@/lib/profile-photo';

export default function StudentProfilePage() {
  const student = useCurrentStudent();
  const { toast } = useToast();
  const [studentParent, setStudentParent] = useState<Parent | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [studentIdValue, setStudentIdValue] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentRelationship, setParentRelationship] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [currentCollege, setCurrentCollege] = useState<College | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [caste, setCaste] = useState('');
  const [subCaste, setSubCaste] = useState('');
  const [payingOnline, setPayingOnline] = useState(false);
  const [partialPaymentOpen, setPartialPaymentOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!student?.collegeId) {
      setCurrentCollege(null);
      return;
    }
    getCollegeById(student.collegeId).then(setCurrentCollege);
  }, [student?.collegeId]);

  useEffect(() => {
    if (!student?.collegeId) {
      setSubjects([]);
      return;
    }
    const q = query(
      collection(db, 'subjects'),
      where('collegeId', '==', student.collegeId)
    );
    const unsub = onSnapshot(q, (snap) =>
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)))
    );
    return () => unsub();
  }, [student?.collegeId]);

  useEffect(() => {
    if (student) {
      setName(student.name ?? '');
      setEmail(student.email ?? '');
      setPhone(student.phone ?? '');
      setStudentIdValue(student.studentId ?? student.usn ?? '');
      setDateOfBirth(student.dateOfBirth ?? '');
      setCaste(student.caste ?? '');
      setSubCaste(student.subCaste ?? '');
    }
  }, [student]);

  useEffect(() => {
    if (!student?.id) return;
    const q = query(collection(db, 'parents'), where('studentId', '==', student.id));
    const unsub = onSnapshot(q, (snap) => {
      const docSnap = snap.docs[0];
      const parent = docSnap ? { id: docSnap.id, ...docSnap.data() } as Parent : null;
      setStudentParent(parent);
      if (parent) {
        setParentName(parent.name ?? '');
        setParentRelationship(parent.relationship ?? '');
        setParentPhone(parent.phone ?? '');
      } else {
        setParentName('');
        setParentRelationship('');
        setParentPhone('');
      }
    });
    return () => unsub();
  }, [student?.id]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'classes'), (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class))));
    return () => unsub();
  }, []);

  if (!student) return null;

  const studentClass = classes.find((c) => c.id === student.classId);
  const classSubjectIds = studentClass?.subjectIds ?? [];
  const classSubjects = subjects.filter((s) => classSubjectIds.includes(s.id));
  const profilePlaceholder = PlaceHolderImages.find((img) => img.id === student.id);
  const photoUrl = student.photoUrl ?? (photoFile ? URL.createObjectURL(photoFile) : null);
  const displayUrl = photoUrl || profilePlaceholder?.imageUrl;

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
  const feeStatusInfo = getFeeStatus(student.fees?.status ?? '');
  const FeeStatusIcon = feeStatusInfo.icon;

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayOnline = async (requestedAmount?: number) => {
    if (!student?.collegeId || !student?.id) return;
    const balance = student.fees?.balance ?? 0;
    if (balance <= 0) {
      toast({
        title: 'No Outstanding Balance',
        description: 'Your fees are already fully paid.',
      });
      return;
    }

    const amountToPay = requestedAmount !== undefined ? requestedAmount : balance;
    if (isNaN(amountToPay) || amountToPay <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a valid payment amount greater than ₹0.',
      });
      return;
    }

    if (amountToPay > balance) {
      toast({
        variant: 'destructive',
        title: 'Amount Exceeds Balance',
        description: `You cannot pay more than the outstanding balance of ₹${balance.toLocaleString('en-IN')}.`,
      });
      return;
    }

    setPayingOnline(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast({
          variant: 'destructive',
          title: 'SDK Load Error',
          description: 'Failed to load Razorpay Payment Gateway script. Please check your internet connection.',
        });
        return;
      }

      // Fetch fresh college settings if not loaded yet
      let collegeSettings = currentCollege;
      if (!collegeSettings) {
        collegeSettings = await getCollegeById(student.collegeId);
        setCurrentCollege(collegeSettings);
      }

      const orderFetch = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeId: student.collegeId,
          amountInRupees: amountToPay,
          studentId: student.id,
          studentName: student.name,
          feeType: amountToPay < balance ? 'Partial Fee Payment' : 'Student Outstanding Fees',
          collegeName: collegeSettings?.name,
        }),
      });

      const orderRes = await orderFetch.json().catch(() => ({}));

      if (!orderRes.success || !orderRes.orderId || !orderRes.keyId) {
        toast({
          variant: 'destructive',
          title: 'Payment Gateway Notice',
          description: orderRes.error || 'Online payment gateway is not configured for your institution. Please contact your administrator.',
        });
        return;
      }

      const options = {
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency || 'INR',
        name: orderRes.collegeName || 'College Management System',
        description: amountToPay < balance ? `Partial Fee Payment (₹${amountToPay.toLocaleString('en-IN')})` : 'Outstanding Fee Collection',
        order_id: orderRes.orderId,
        handler: async function (response: any) {
          toast({
            title: 'Verifying Transaction...',
            description: 'Authenticating payment signature with Razorpay...',
          });

          const verifyFetch = await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collegeId: student.collegeId,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              studentId: student.id,
              amountPaid: amountToPay,
              receiptNumber: response.razorpay_payment_id,
              remarks: `Razorpay Online ${amountToPay < balance ? 'Partial ' : ''}Payment for Student ID: ${student.studentId || student.id}`,
            }),
          });

          const verifyRes = await verifyFetch.json().catch(() => ({}));

          if (verifyRes.success) {
            // Update student fee record directly in Firestore
            try {
              const existingFees = student.fees;
              const currentPaid = existingFees?.paid ?? 0;
              const currentTotal = existingFees?.totalFees ?? (currentPaid + balance);
              const newPaid = currentPaid + amountToPay;
              const newBalance = Math.max(0, currentTotal - newPaid);
              const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';
              const newPaymentRecord = {
                id: response.razorpay_payment_id,
                amount: amountToPay,
                date: new Date().toISOString(),
                method: 'Online' as const,
                receiptNumber: response.razorpay_payment_id,
                remarks: `Razorpay Online ${amountToPay < balance ? 'Partial ' : ''}Payment (Order: ${response.razorpay_order_id})`,
              };
              const updatedPaymentHistory = [...(existingFees?.paymentHistory ?? []), newPaymentRecord];

              await updateDoc(doc(db, 'students', student.id), {
                'fees.paid': newPaid,
                'fees.balance': newBalance,
                'fees.status': newStatus,
                'fees.paymentHistory': updatedPaymentHistory,
              });
            } catch (updateErr) {
              console.error('Client Firestore update error:', updateErr);
            }

            setPartialPaymentOpen(false);
            setCustomAmount('');

            toast({
              title: 'Payment Complete! 🎉',
              description: `Paid ₹${amountToPay.toLocaleString('en-IN')}. Transaction ID: ${response.razorpay_payment_id}`,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Verification Failed',
              description: verifyRes.error || 'Payment signature verification failed.',
            });
          }
        },
        prefill: {
          name: student.name || 'Student',
          email: student.email || undefined,
          contact: student.phone ? student.phone.replace(/[^0-9]/g, '').slice(-10) : undefined,
        },
        theme: {
          color: '#0284c7',
        },
        modal: {
          ondismiss: function () {
            setPayingOnline(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Razorpay payment failed:', response.error);
        toast({
          variant: 'destructive',
          title: 'Payment Incomplete',
          description: response.error?.description || 'The transaction was cancelled or failed.',
        });
      });
      rzp.open();
    } catch (err: any) {
      console.error('Error initiating Razorpay checkout:', err);
      toast({
        variant: 'destructive',
        title: 'Checkout Error',
        description: err.message || 'Failed to initiate Razorpay checkout.',
      });
    } finally {
      setPayingOnline(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student.id) return;
    setSaving(true);
    try {
      let newPhotoUrl: string | undefined = student.photoUrl;
      if (photoFile) {
        try {
          newPhotoUrl = await uploadProfilePhoto('student', student.id, photoFile);
        } catch (err) {
          console.error('Profile photo upload failed:', err);
          toast({
            variant: 'destructive',
            title: 'Photo upload failed',
            description: 'Profile will be updated without the new photo. Check Storage rules and CORS.',
          });
        }
      }
      const usn = studentIdValue.trim() || student.studentId || student.usn || '';
      await updateDoc(doc(db, 'students', student.id), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '',
        studentId: usn,
        dateOfBirth: dateOfBirth.trim() || '',
        caste: caste.trim() || '',
        subCaste: subCaste.trim() || '',
        ...(usn ? { usn } : {}),
        ...(newPhotoUrl !== undefined && { photoUrl: newPhotoUrl }),
      });
      const pName = parentName.trim();
      const pRel = parentRelationship.trim();
      const pPhone = parentPhone.trim();
      if (studentParent) {
        await updateDoc(doc(db, 'parents', studentParent.id), {
          name: pName || '',
          relationship: pRel || '',
          phone: pPhone || '',
        });
      } else if (pName || pRel || pPhone) {
        const parentId = generateParentId(student.id, pName || 'Guardian');
        await setDoc(doc(db, 'parents', parentId), {
          studentId: student.id,
          name: pName || '',
          relationship: pRel || '',
          phone: pPhone || '',
          ...(student.collegeId && { collegeId: student.collegeId }),
        });
      }
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      toast({ title: 'Profile updated', description: 'Your profile has been saved.' });
    } catch (err) {
      console.error('Profile update failed:', err);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: 'Could not save profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          My Profile
        </h1>
        <p className="text-muted-foreground">
          View and update your personal information, and track your progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editable Profile Details</CardTitle>
          <CardDescription>
            Keep your profile information up to date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center gap-6">
            {displayUrl && (
              <Image
                src={displayUrl}
                alt="Your Profile Photo"
                width={100}
                height={100}
                className="rounded-full border-4 border-primary/20 object-cover"
                unoptimized={!!photoUrl && (photoUrl.startsWith('blob:') || photoUrl.startsWith('data:'))}
              />
            )}
            <div>
              <h3 className="text-xl font-semibold">{name || student.name}</h3>
              <p className="text-muted-foreground">
                USN / Student ID: {student.studentId || student.usn || '—'}
              </p>
              {studentClass && (
                <Badge className="mt-2">{studentClass.name}</Badge>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => photoInputRef.current?.click()}
              >
                Change Photo
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-5 w-5 shrink-0" />
              <span className="font-medium">College</span>
            </div>
            <p className="text-sm font-medium">
              {currentCollege ? (
                <>
                  {currentCollege.name}
                  {currentCollege.code && (
                    <span className="text-muted-foreground font-normal"> — Code: {currentCollege.code}</span>
                  )}
                </>
              ) : student.collegeId ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : (
                <span className="text-muted-foreground">Not linked</span>
              )}
            </p>
          </div>

          <form className="grid gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name ?? ''} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="studentId">USN / Student ID</Label>
              <Input
                id="studentId"
                value={studentIdValue ?? ''}
                onChange={(e) => setStudentIdValue(e.target.value)}
                placeholder="e.g. U15SE2550001"
              />
              <p className="text-xs text-muted-foreground">You can correct your USN or Student ID here if it was entered wrongly.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={email ?? ''} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input id="dateOfBirth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caste">Caste</Label>
              <Input id="caste" value={caste} onChange={(e) => setCaste(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subCaste">Sub-caste</Label>
              <Input id="subCaste" value={subCaste} onChange={(e) => setSubCaste(e.target.value)} />
            </div>

            <h4 className="md:col-span-2 text-lg font-semibold border-t pt-6">
              Parent/Guardian Information
            </h4>

            <div className="space-y-2">
              <Label htmlFor="parentName">Parent/Guardian Name</Label>
              <Input id="parentName" value={parentName ?? ''} onChange={(e) => setParentName(e.target.value)} placeholder="e.g. Father, Mother" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentRelationship">Relationship</Label>
              <Input id="parentRelationship" value={parentRelationship ?? ''} onChange={(e) => setParentRelationship(e.target.value)} placeholder="e.g. Father, Mother, Guardian" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentPhone">Parent/Guardian Phone</Label>
              <Input id="parentPhone" type="tel" value={parentPhone ?? ''} onChange={(e) => setParentPhone(e.target.value)} placeholder="Phone number" />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Update Profile'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Class &amp; Subjects
            </CardTitle>
            <CardDescription>
              Your current class and the subjects assigned to it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Class</div>
              <p className="font-medium">
                {studentClass ? studentClass.name : 'Not assigned'}
              </p>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Subjects</div>
              {classSubjects.length > 0 ? (
                <ul className="space-y-1.5">
                  {classSubjects.map((sub) => (
                    <li key={sub.id} className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{sub.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {studentClass
                    ? 'No subjects assigned to this class yet.'
                    : 'Select a class to see subjects.'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-sky-500/20 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Fee Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-2 font-medium">
                <FeeStatusIcon
                  className={cn('h-5 w-5', feeStatusInfo.color)}
                />
                <span className={feeStatusInfo.color}>
                  {student.fees?.status ?? '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Balance Outstanding</span>
              <span className="font-bold text-lg text-foreground">
                ₹{(student.fees?.balance ?? 0).toLocaleString('en-IN')}
              </span>
            </div>

            {(student.fees?.balance ?? 0) > 0 && (
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  onClick={() => handlePayOnline()}
                  disabled={payingOnline}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs gap-2 shadow-sm"
                >
                  {payingOnline ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Opening Payment Gateway...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay Full Outstanding (₹{(student.fees?.balance ?? 0).toLocaleString('en-IN')})
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCustomAmount('');
                    setPartialPaymentOpen(true);
                  }}
                  disabled={payingOnline}
                  className="w-full border-sky-500/40 text-sky-700 hover:bg-sky-50 hover:text-sky-800 dark:text-sky-300 dark:hover:bg-sky-950 font-semibold text-xs gap-2"
                >
                  <Coins className="h-4 w-4 text-sky-600" />
                  Pay Partial / Custom Amount
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Link href="/student-dashboard/attendance" className="block">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Attendance Record
              </CardTitle>
              <CardDescription>
                Click to view subject-wise attendance distribution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Overall Percentage</span>
                <span className="font-bold text-lg">
                  {attendancePercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={attendancePercentage} className="h-2" />
              <div className="flex items-center justify-between pt-2">
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
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookText className="h-5 w-5 text-primary" />
              Your Grades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(student.assessments ?? []).map((assessment, index) => (
              <React.Fragment key={assessment.subject}>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    {assessment.subject}
                  </span>
                  <span className="font-bold">{assessment.marks} / 100</span>
                </div>
                {index < (student.assessments ?? []).length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Partial Payment Dialog Modal */}
      <Dialog open={partialPaymentOpen} onOpenChange={setPartialPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-sky-600" />
              Pay Partial Amount
            </DialogTitle>
            <DialogDescription>
              Enter the amount you would like to pay towards your outstanding fees.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 p-3 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Current Total Outstanding:</span>
              <span className="font-bold text-foreground text-base">
                ₹{(student.fees?.balance ?? 0).toLocaleString('en-IN')}
              </span>
            </div>

            {/* Quick Amount Suggestion Chips */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quick Select Amount:</Label>
              <div className="flex flex-wrap gap-2">
                {[1000, 2000, 5000, 10000, 20000]
                  .filter((amt) => amt < (student.fees?.balance ?? 0))
                  .map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2.5 hover:border-sky-500 hover:text-sky-600"
                      onClick={() => setCustomAmount(amt.toString())}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </Button>
                  ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-amount">Enter Payment Amount (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-base">₹</span>
                <Input
                  id="custom-amount"
                  type="number"
                  min="1"
                  max={student.fees?.balance ?? 0}
                  placeholder="e.g. 5000"
                  className="pl-8 text-base font-semibold"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
            </div>

            {Number(customAmount) > 0 && (
              <div className="text-xs text-muted-foreground space-y-1.5 border-t pt-3">
                <div className="flex justify-between">
                  <span>Amount to Pay Now:</span>
                  <span className="font-bold text-sky-600 text-sm">
                    ₹{Number(customAmount).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining Balance After Payment:</span>
                  <span className="font-semibold text-foreground">
                    ₹{Math.max(0, (student.fees?.balance ?? 0) - Number(customAmount)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPartialPaymentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                payingOnline ||
                !Number(customAmount) ||
                Number(customAmount) <= 0 ||
                Number(customAmount) > (student.fees?.balance ?? 0)
              }
              onClick={() => handlePayOnline(Number(customAmount))}
              className="bg-sky-600 hover:bg-sky-700 text-white gap-2 font-semibold"
            >
              {payingOnline ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening Gateway...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Proceed to Pay ₹{Number(customAmount || 0).toLocaleString('en-IN')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
