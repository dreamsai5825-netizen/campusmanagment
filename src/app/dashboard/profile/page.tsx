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
import type { College } from '@/lib/types';
import { Loader2, Building2 } from 'lucide-react';

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
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setCurrentCollege(null);
      return;
    }
    getCollegeById(teacher.collegeId).then(setCurrentCollege);
  }, [teacher?.collegeId]);

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
    </div>
  );
}
