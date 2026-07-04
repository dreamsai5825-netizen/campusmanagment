'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, setDoc, doc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useToast } from '@/hooks/use-toast';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { generateStudentDocId, generateParentId } from '@/lib/id-utils';
import {
  uploadAdmissionDocument,
  uploadAdmissionPhoto,
} from '@/lib/admission-upload';
import type { Class } from '@/lib/types';
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Loader2,
  UserPlus,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

const GENDERS = ['Male', 'Female', 'Other'] as const;
const BLOOD_GROUPS = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

const initialForm = {
  firstName: '',
  lastName: '',
  caste: '',
  subCaste: '',
  religion: '',
  classId: '',
  gender: '',
  bloodGroup: '',
  admissionDate: '',
  admissionNumber: '',
  phone: '',
  emergencyNumber: '',
  email: '',
  homeAddress: '',
  aadharNumber: '',
  dateOfBirth: '',
  parentPhone: '',
  parentName: '',
  parentRelationship: 'Father',
};

const initialFees = {
  collegeFees: '0',
  libraryFees: '0',
  hostelFees: '0',
  examFees: '0',
  transportFees: '0',
  otherFees: '0',
};

type FeeFieldKey = keyof typeof initialFees;

const FEE_FIELDS: { key: FeeFieldKey; label: string; column: 'left' | 'right' }[] = [
  { key: 'collegeFees', label: 'College Fees', column: 'left' },
  { key: 'libraryFees', label: 'Library Fees', column: 'right' },
  { key: 'hostelFees', label: 'Hostel Fees', column: 'left' },
  { key: 'examFees', label: 'Exam Fees', column: 'right' },
  { key: 'transportFees', label: 'Transport Fees', column: 'left' },
  { key: 'otherFees', label: 'Other Fees', column: 'right' },
];

function parseFeeAmount(value: string): number {
  if (!value.trim()) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function StudentAdmissionPage() {
  const principal = useCurrentPrincipal();
  const { selectedAcademicYear } = useAcademicYear();
  const { toast } = useToast();
  const router = useRouter();
  const { getPath } = useDashboardPath();

  const [classes, setClasses] = useState<Class[]>([]);
  const [form, setForm] = useState(initialForm);
  const [fees, setFees] = useState(initialFees);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [savedDocumentUrl, setSavedDocumentUrl] = useState<string | null>(null);
  const [savedDocumentName, setSavedDocumentName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!principal?.collegeId) {
      setClasses([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setClasses(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Class)));
      }
    );
    return () => unsub();
  }, [principal?.collegeId]);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (photoFile) {
      const url = URL.createObjectURL(photoFile);
      setPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPhotoPreview(savedPhotoUrl);
  }, [photoFile, savedPhotoUrl]);

  useEffect(() => {
    if (documentFile) {
      const url = URL.createObjectURL(documentFile);
      setDocumentPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setDocumentPreviewUrl(savedDocumentUrl);
  }, [documentFile, savedDocumentUrl]);

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateFee = (field: FeeFieldKey, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFees((prev) => ({ ...prev, [field]: value }));
    }
  };

  const feeBreakdown = useMemo(
    () => ({
      collegeFees: parseFeeAmount(fees.collegeFees),
      libraryFees: parseFeeAmount(fees.libraryFees),
      hostelFees: parseFeeAmount(fees.hostelFees),
      examFees: parseFeeAmount(fees.examFees),
      transportFees: parseFeeAmount(fees.transportFees),
      otherFees: parseFeeAmount(fees.otherFees),
    }),
    [fees]
  );

  const totalFees = useMemo(
    () =>
      feeBreakdown.collegeFees +
      feeBreakdown.libraryFees +
      feeBreakdown.hostelFees +
      feeBreakdown.examFees +
      feeBreakdown.transportFees +
      feeBreakdown.otherFees,
    [feeBreakdown]
  );

  const handleViewPhoto = () => {
    if (!photoPreview) {
      toast({
        variant: 'destructive',
        title: 'No photo',
        description: 'Upload a photo first.',
      });
      return;
    }
    window.open(photoPreview, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadDocument = () => {
    if (!documentPreviewUrl) {
      toast({
        variant: 'destructive',
        title: 'No document',
        description: 'Upload a PDF document first.',
      });
      return;
    }
    const link = document.createElement('a');
    link.href = documentPreviewUrl;
    link.download = documentFile?.name ?? savedDocumentName ?? 'admission-documents.pdf';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.collegeId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'College not loaded.',
      });
      return;
    }

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim().toLowerCase();
    const admissionNumber = form.admissionNumber.trim();

    if (!firstName || !lastName) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'First name and last name are required.',
      });
      return;
    }
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Email is required.',
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Enter a valid email — it will be the student login user ID.',
      });
      return;
    }
    if (!form.classId) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please select a class.',
      });
      return;
    }
    if (classes.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No classes',
        description: 'Add classes before admitting students.',
      });
      return;
    }

    const studentId =
      admissionNumber ||
      `S${String(Date.now()).slice(-6).padStart(6, '0')}`;
    const docId = generateStudentDocId(studentId);
    const fullName = `${firstName} ${lastName}`.trim();

    setSaving(true);
    try {
      let photoUrl: string | undefined;
      let documentsUrl: string | undefined;
      let documentsName: string | undefined;

      if (photoFile) {
        try {
          photoUrl = await uploadAdmissionPhoto(
            principal.collegeId,
            studentId,
            photoFile
          );
          setSavedPhotoUrl(photoUrl);
        } catch (err) {
          console.error('Photo upload failed:', err);
          toast({
            variant: 'destructive',
            title: 'Photo upload failed',
            description: 'Student will be saved without photo. Check Storage rules.',
          });
        }
      }

      if (documentFile) {
        try {
          const docUpload = await uploadAdmissionDocument(
            principal.collegeId,
            studentId,
            documentFile
          );
          documentsUrl = docUpload.url;
          documentsName = docUpload.name;
          setSavedDocumentUrl(documentsUrl);
          setSavedDocumentName(documentsName);
        } catch (err) {
          console.error('Document upload failed:', err);
          toast({
            variant: 'destructive',
            title: 'Document upload failed',
            description: 'Student will be saved without documents. Check Storage rules.',
          });
        }
      }

      await setDoc(doc(db, 'students', docId), {
        studentId,
        name: fullName,
        firstName,
        lastName,
        email, // student login user ID (Firebase Auth email)
        phone: form.phone.trim() || form.emergencyNumber.trim(),
        emergencyNumber: form.emergencyNumber.trim(),
        classId: form.classId,
        collegeId: principal.collegeId,
        academicYear: selectedAcademicYear,
        caste: form.caste.trim(),
        subCaste: form.subCaste.trim(),
        religion: form.religion.trim(),
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        admissionDate: form.admissionDate,
        dateOfBirth: form.dateOfBirth,
        admissionNumber: admissionNumber || studentId,
        homeAddress: form.homeAddress.trim(),
        aadharNumber: form.aadharNumber.trim(),
        ...(photoUrl && { photoUrl }),
        ...(documentsUrl && { documentsUrl, documentsName }),
        fees: {
          status: 'Not Paid',
          balance: totalFees,
          totalFees,
          paid: 0,
          breakdown: feeBreakdown,
        },
        attendance: {
          summary: { present: 0, absent: 0, totalDays: 0 },
          bySubject: [],
        },
        assessments: [],
      });

      if (form.parentPhone.trim()) {
        const pName = form.parentName.trim() || `Parent of ${fullName}`;
        const parentId = generateParentId(docId, pName);
        await setDoc(doc(db, 'parents', parentId), {
          studentId: docId,
          name: pName,
          relationship: form.parentRelationship.trim() || 'Parent',
          phone: form.parentPhone.trim(),
          collegeId: principal.collegeId,
        });
      }

      let loginMessage = '';
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken();
          const loginRes = await fetch('/api/create-student-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
          });
          const loginData = await loginRes.json().catch(() => ({}));
          if (loginRes.ok) {
            loginMessage = loginData.message ?? '';
          } else {
            loginMessage =
              loginData.error ??
              'Admission saved, but student login could not be created.';
          }
        } catch {
          loginMessage =
            'Admission saved, but student login could not be created. Use Create student login on the Students page.';
        }
      }

      toast({
        title: 'Admission saved',
        description:
          loginMessage ||
          `${fullName} admitted for ${selectedAcademicYear}. Student can sign in with ${email}.`,
      });

      setForm(initialForm);
      setFees(initialFees);
      setPhotoFile(null);
      setDocumentFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (documentInputRef.current) documentInputRef.current.value = '';

      router.push(getPath(`/students/${docId}`));
    } catch (err) {
      console.error('Admission save failed:', err);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Could not save admission. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={getPath('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
              <UserPlus className="h-7 w-7 text-primary shrink-0" />
              Student Admission
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Register a new student for {selectedAcademicYear}.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Basic information about the student.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={form.firstName || ''}
                onChange={(e) => updateField('firstName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={form.lastName || ''}
                onChange={(e) => updateField('lastName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caste">Caste</Label>
              <Input
                id="caste"
                value={form.caste || ''}
                onChange={(e) => updateField('caste', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subCaste">Sub-caste</Label>
              <Input
                id="subCaste"
                value={form.subCaste || ''}
                onChange={(e) => updateField('subCaste', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="religion">Religion</Label>
              <Input
                id="religion"
                value={form.religion || ''}
                onChange={(e) => updateField('religion', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={form.gender || undefined}
                onValueChange={(v) => updateField('gender', v)}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Select
                value={form.bloodGroup || undefined}
                onValueChange={(v) => updateField('bloodGroup', v)}
              >
                <SelectTrigger id="bloodGroup">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((bg) => (
                    <SelectItem key={bg} value={bg}>
                      {bg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth || ''}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="classId">Class *</Label>
              <Select
                value={form.classId || undefined}
                onValueChange={(v) => updateField('classId', v)}
                disabled={classes.length === 0}
              >
                <SelectTrigger id="classId">
                  <SelectValue
                    placeholder={
                      classes.length === 0
                        ? 'No classes — add classes first'
                        : 'Select class'
                    }
                  />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admission & contact</CardTitle>
            <CardDescription>Admission and emergency contact details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="admissionDate">Admission Date</Label>
              <Input
                id="admissionDate"
                type="date"
                value={form.admissionDate || ''}
                onChange={(e) => updateField('admissionDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admissionNumber">Admission Number</Label>
              <Input
                id="admissionNumber"
                value={form.admissionNumber || ''}
                onChange={(e) => updateField('admissionNumber', e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email (student login user ID) *</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="student@example.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                This email is the student login user ID. A new account is created
                on admission with default password Welcome@123 (existing student
                logins are not changed).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Student Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="Student phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyNumber">Emergency Number</Label>
              <Input
                id="emergencyNumber"
                type="tel"
                value={form.emergencyNumber || ''}
                onChange={(e) => updateField('emergencyNumber', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Parent / Guardian Details
              </h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentName">Parent/Guardian Name</Label>
              <Input
                id="parentName"
                value={form.parentName || ''}
                onChange={(e) => updateField('parentName', e.target.value)}
                placeholder="Parent's full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentPhone">Parent's Phone Number</Label>
              <Input
                id="parentPhone"
                type="tel"
                value={form.parentPhone || ''}
                onChange={(e) => updateField('parentPhone', e.target.value)}
                placeholder="Parent's phone number"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="parentRelationship">Relationship</Label>
              <Input
                id="parentRelationship"
                value={form.parentRelationship || ''}
                onChange={(e) => updateField('parentRelationship', e.target.value)}
                placeholder="e.g. Father, Mother, Guardian"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="homeAddress">Home Address</Label>
              <Textarea
                id="homeAddress"
                value={form.homeAddress || ''}
                onChange={(e) => updateField('homeAddress', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="aadharNumber">Aadhar Number</Label>
              <Input
                id="aadharNumber"
                value={form.aadharNumber || ''}
                onChange={(e) => updateField('aadharNumber', e.target.value)}
                placeholder="12-digit Aadhar"
                maxLength={12}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border shadow-md">
          <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 px-5 py-4 text-white sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-headline tracking-tight">
                  Fee Structure
                </h2>
                <p className="text-sm text-white/90">
                  Fee breakdown and payment details
                </p>
              </div>
            </div>
          </div>
          <CardContent className="bg-[#faf8f5] pt-6 pb-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                {FEE_FIELDS.filter((f) => f.column === 'left').map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="font-headline text-base">
                      {field.label}
                    </Label>
                    <Input
                      id={field.key}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={fees[field.key] || ''}
                      onChange={(e) => updateFee(field.key, e.target.value)}
                      className="bg-slate-50/80"
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="totalFees" className="font-headline text-base">
                    Total Fees
                  </Label>
                  <Input
                    id="totalFees"
                    type="number"
                    readOnly
                    value={totalFees || 0}
                    className="bg-slate-100 font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-4">
                {FEE_FIELDS.filter((f) => f.column === 'right').map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="font-headline text-base">
                      {field.label}
                    </Label>
                    <Input
                      id={field.key}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={fees[field.key] || ''}
                      onChange={(e) => updateFee(field.key, e.target.value)}
                      className="bg-slate-50/80"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Photo</CardTitle>
              <CardDescription>Upload and preview student photo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt="Student photo preview"
                    width={120}
                    height={120}
                    className="rounded-lg border object-cover h-[120px] w-[120px]"
                    unoptimized
                  />
                ) : (
                  <div className="h-[120px] w-[120px] rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm text-center px-2">
                    No photo
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPhotoFile(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Upload photo
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleViewPhoto}
                    disabled={!photoPreview}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Upload admission PDF documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <FileText className="h-10 w-10 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {documentFile?.name ??
                      savedDocumentName ??
                      'No document uploaded'}
                  </p>
                  <p className="text-xs text-muted-foreground">PDF only</p>
                </div>
              </div>
              <input
                ref={documentInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                    toast({
                      variant: 'destructive',
                      title: 'Invalid file',
                      description: 'Please upload a PDF file.',
                    });
                    return;
                  }
                  setDocumentFile(file);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => documentInputRef.current?.click()}
                >
                  Upload PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDownloadDocument}
                  disabled={!documentPreviewUrl}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href={getPath('/')}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving || classes.length === 0}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Complete admission
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
