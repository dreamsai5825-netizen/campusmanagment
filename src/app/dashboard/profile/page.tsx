'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
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
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePhoto } from '@/lib/profile-photo';
import { getCollegeById } from '@/lib/college-service';
import type { College, TeacherLeave } from '@/lib/types';
import { Loader2, Building2, CalendarOff, Calendar } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function ProfilePage() {
  const teacher = useCurrentTeacher();
  const { toast } = useToast();
  const profilePlaceholder = PlaceHolderImages.find((img) => img.id === 'teacher-profile');
  const [name, setName] = useState(teacher?.name ?? '');
  const [email, setEmail] = useState(teacher?.email ?? '');
  const [phone, setPhone] = useState(teacher?.phone ?? '');
  const [subjectSpecialty, setSubjectSpecialty] = useState(teacher?.subjectSpecialty ?? '');
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [currentCollege, setCurrentCollege] = useState<College | null>(null);
  const [leaves, setLeaves] = useState<TeacherLeave[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setCurrentCollege(null);
      return;
    }
    getCollegeById(teacher.collegeId).then(setCurrentCollege);
  }, [teacher?.collegeId]);

  useEffect(() => {
    if (!teacher?.id) return;
    const qLeaves = query(collection(db, 'teachers', teacher.id, 'leaves'));
    const unsub = onSnapshot(qLeaves, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as TeacherLeave[];
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLeaves(list);
    });
    return () => unsub();
  }, [teacher?.id]);

  useEffect(() => {
    if (teacher) {
      setName(teacher.name ?? '');
      setEmail(teacher.email ?? '');
      setPhone(teacher.phone ?? '');
      setSubjectSpecialty(teacher.subjectSpecialty ?? '');
    }
  }, [teacher]);

  const photoUrl = teacher?.photoUrl ?? (photoFile ? URL.createObjectURL(photoFile) : null);
  const displayUrl = photoUrl || profilePlaceholder?.imageUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher?.id) return;
    setSaving(true);
    try {
      let newPhotoUrl: string | undefined = teacher.photoUrl;
      if (photoFile) {
        try {
          newPhotoUrl = await uploadProfilePhoto('teacher', teacher.id, photoFile);
        } catch (err) {
          console.error('Profile photo upload failed:', err);
          toast({
            variant: 'destructive',
            title: 'Photo upload failed',
            description: 'Profile will be updated without the new photo. Check Storage rules and CORS.',
          });
        }
      }
      await updateDoc(doc(db, 'teachers', teacher.id), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subjectSpecialty: subjectSpecialty.trim() || undefined,
        ...(newPhotoUrl !== undefined && { photoUrl: newPhotoUrl }),
      });
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

  if (!teacher) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          My Profile
        </h1>
        <p className="text-muted-foreground">
          View and update your personal information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>
            Keep your profile information up to date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center gap-6">
            {displayUrl && (
              <Image
                src={displayUrl}
                alt="Teacher Profile"
                width={100}
                height={100}
                className="rounded-full border-4 border-primary/20 object-cover"
                unoptimized={!!photoUrl && (photoUrl.startsWith('blob:') || photoUrl.startsWith('data:'))}
              />
            )}
            <div>
              <h3 className="text-xl font-semibold">{name || 'Teacher'}</h3>
              <p className="text-muted-foreground">{subjectSpecialty || '—'}</p>
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
              <span className="font-medium">College (linked profile)</span>
            </div>
            <p className="text-sm font-medium">
              {currentCollege ? (
                <>
                  {currentCollege.name}
                  {currentCollege.code && (
                    <span className="text-muted-foreground font-normal"> — Code: {currentCollege.code}</span>
                  )}
                </>
              ) : teacher.collegeId ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : (
                <span className="text-muted-foreground">Not linked to a college</span>
              )}
            </p>
          </div>

          <form className="grid gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Specialty</Label>
              <Input
                id="subject"
                value={subjectSpecialty}
                onChange={(e) => setSubjectSpecialty(e.target.value)}
              />
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

      {/* Read-Only Teacher Leave Bank Card */}
      {(() => {
        const defaultQuotas: Record<string, number> = {
          'Casual Leave (CL)': 12,
          'Medical Leave (ML)': 8,
          'Loss of Pay (LOP)': 12,
          'Earned Leave (EL)': 10,
          'Duty Leave (OD)': 5,
        };
        const catQuotas: Record<string, number> = { ...defaultQuotas, ...(teacher.leaveQuotas ?? {}) };
        const categories = Array.from(new Set([...Object.keys(catQuotas), ...leaves.map((l) => l.type)]));

        const catBreakdown: Record<string, { allotted: number; taken: number; balance: number }> = {};
        let totAllotted = 0;
        let totTaken = 0;

        categories.forEach((cat) => {
          const allotted = catQuotas[cat] ?? 0;
          const taken = leaves
            .filter((l) => l.type === cat)
            .reduce((sum, l) => sum + (l.duration ?? 1.0), 0);
          const balance = Math.max(0, allotted - taken);
          catBreakdown[cat] = { allotted, taken, balance };
          totAllotted += allotted;
          totTaken += taken;
        });

        const totBalance = Math.max(0, totAllotted - totTaken);

        return (
          <Card className="shadow-sm border-purple-200/60">
            <CardHeader className="bg-gradient-to-r from-purple-50/60 to-blue-50/60 dark:from-purple-950/30 dark:to-blue-950/30 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <CalendarOff className="h-5 w-5 text-purple-600" />
                    My Leave Bank & Category Quotas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Read-only record of your category-wise annual leaves, taken days, and balance.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-300">
                  Read Only
                </Badge>
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
                    {totAllotted.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">days</span>
                  </div>
                </div>

                <div className="border rounded-xl p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Total Taken
                  </div>
                  <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                    {totTaken.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">days</span>
                  </div>
                </div>

                <div
                  className={`border rounded-xl p-3.5 ${
                    totBalance > 5
                      ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20'
                      : totBalance > 0
                      ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-950/20'
                      : 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/20'
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Total Balance
                  </div>
                  <div
                    className={`text-2xl font-extrabold mt-1 ${
                      totBalance > 5
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : totBalance > 0
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {totBalance.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">days</span>
                  </div>
                </div>
              </div>

              {/* Category-Wise Breakdown Grid */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Category-Wise Quotas Breakdown
                </span>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(catBreakdown).map(([cName, cInfo]) => (
                    <div key={cName} className="border rounded-xl p-3 bg-card space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="truncate pr-1">{cName}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            cInfo.balance > 2
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : cInfo.balance > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}
                        >
                          Bal: {cInfo.balance.toFixed(1)}d
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground pt-1 border-t">
                        <div>Alloted: <span className="font-semibold text-foreground">{cInfo.allotted}</span></div>
                        <div>Taken: <span className="font-semibold text-amber-600">{cInfo.taken.toFixed(1)}</span></div>
                        <div>Bal: <span className="font-semibold text-emerald-600">{cInfo.balance.toFixed(1)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground tracking-wider border-b pb-2">
                  <span>Leave History ({leaves.length})</span>
                  <span>Duration / Session</span>
                </div>

                {leaves.length === 0 ? (
                  <div className="text-center py-8 border rounded-xl bg-muted/20 text-muted-foreground">
                    <CalendarOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No leave records logged yet.</p>
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {leaves.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all"
                      >
                        <div>
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
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Reason: {item.reason}
                            {item.halfDaySession && (
                              <span className="ml-1 text-purple-600 dark:text-purple-400 font-medium">
                                ({item.halfDaySession})
                              </span>
                            )}
                          </p>
                        </div>

                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-lg shrink-0 ${
                            item.duration === 0.5
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          }`}
                        >
                          {item.duration === 0.5 ? '0.5 Day' : '1.0 Day'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
