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
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { doc, updateDoc, getDoc, getDocs, collection, query, where, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePhoto, uploadCollegeLogo } from '@/lib/profile-photo';
import { getCollegeById } from '@/lib/college-service';
import type { College } from '@/lib/types';
import { Loader2, Building2, School } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminProfilePage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();
  const profilePlaceholder = PlaceHolderImages.find(
    (img) => img.id === 'principal-profile'
  );
  const [name, setName] = useState(principal?.name ?? '');
  const [email, setEmail] = useState(principal?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [college, setCollege] = useState<College | null>(null);

  const [collegeAddress, setCollegeAddress] = useState('');
  const [logoCount, setLogoCount] = useState<'1' | '2'>('1');
  const [logo1File, setLogo1File] = useState<File | null>(null);
  const [logo2File, setLogo2File] = useState<File | null>(null);
  const [logo1Url, setLogo1Url] = useState('');
  const [logo2Url, setLogo2Url] = useState('');
  
  const logo1InputRef = useRef<HTMLInputElement>(null);
  const logo2InputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (principal) {
      setName(principal.name ?? '');
      setEmail(principal.email ?? '');
    }
  }, [principal]);

  useEffect(() => {
    if (!principal?.collegeId) {
      setCollege(null);
      return;
    }
    getCollegeById(principal.collegeId).then(setCollege);
  }, [principal?.collegeId]);

  useEffect(() => {
    if (college) {
      setCollegeAddress(college.address ?? '');
      setLogoCount(college.logo2Url ? '2' : '1');
      setLogo1Url(college.logoUrl ?? '');
      setLogo2Url(college.logo2Url ?? '');
    }
  }, [college]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const photoUrl = principal?.photoUrl ?? (photoFile ? URL.createObjectURL(photoFile) : null);
  const displayUrl = photoUrl || profilePlaceholder?.imageUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.id) return;
    setSaving(true);
    try {
      let newPhotoUrl: string | undefined = principal.photoUrl;
      if (photoFile) {
        try {
          newPhotoUrl = await uploadProfilePhoto('principal', principal.id, photoFile);
        } catch (err) {
          console.error('Profile photo upload failed:', err);
          toast({
            variant: 'destructive',
            title: 'Photo upload failed',
            description: 'Profile will be updated without the new photo. Check Storage rules and CORS.',
          });
        }
      }

      let finalLogoUrl = logo1Url;
      let finalLogoUrl2 = logo2Url;

      if (principal.collegeId) {
        if (logo1File) {
          try {
            finalLogoUrl = await uploadCollegeLogo(principal.collegeId, 1, logo1File);
            setLogo1Url(finalLogoUrl);
          } catch (err) {
            console.error('Logo 1 upload failed:', err);
            toast({
              variant: 'destructive',
              title: 'Logo 1 upload failed',
              description: 'College settings will be updated without the new primary logo.',
            });
          }
        }

        if (logoCount === '2' && logo2File) {
          try {
            finalLogoUrl2 = await uploadCollegeLogo(principal.collegeId, 2, logo2File);
            setLogo2Url(finalLogoUrl2);
          } catch (err) {
            console.error('Logo 2 upload failed:', err);
            toast({
              variant: 'destructive',
              title: 'Logo 2 upload failed',
              description: 'College settings will be updated without the new secondary logo.',
            });
          }
        } else if (logoCount === '1') {
          finalLogoUrl2 = '';
        }

        await updateDoc(doc(db, 'colleges', principal.collegeId), {
          address: collegeAddress.trim(),
          logoUrl: finalLogoUrl,
          logo2Url: logoCount === '2' ? finalLogoUrl2 : '',
        });

        setCollege(prev => prev ? {
          ...prev,
          address: collegeAddress.trim(),
          logoUrl: finalLogoUrl,
          logo2Url: logoCount === '2' ? finalLogoUrl2 : '',
        } : null);
      }

      const collectionName = principal.isSuperAdmin ? 'super_admins' : 'principals';
      await updateDoc(doc(db, collectionName, principal.id), {
        name: name.trim(),
        email: email.trim(),
        ...(newPhotoUrl !== undefined && { photoUrl: newPhotoUrl }),
      });

      setPhotoFile(null);
      setLogo1File(null);
      setLogo2File(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (logo1InputRef.current) logo1InputRef.current.value = '';
      if (logo2InputRef.current) logo2InputRef.current.value = '';

      toast({ title: 'Profile updated', description: 'Your profile and college details have been saved.' });
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

  // --- MULTI-COLLEGE CODE START ---
  const [associatedColleges, setAssociatedColleges] = useState<College[]>([]);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [newCollegeId, setNewCollegeId] = useState('');
  const [addingCollege, setAddingCollege] = useState(false);

  useEffect(() => {
    const fetchColleges = async () => {
      const ids = principal?.collegeIds && principal.collegeIds.length > 0
        ? principal.collegeIds
        : principal?.collegeId
        ? [principal.collegeId]
        : [];
      
      if (ids.length === 0) {
        setAssociatedColleges([]);
        return;
      }

      setLoadingColleges(true);
      try {
        const fetched = await Promise.all(
          ids.map(async (id) => {
            try {
              const col = await getCollegeById(id);
              return col;
            } catch (err) {
              console.error(`Failed to fetch college ${id}:`, err);
              return null;
            }
          })
        );
        setAssociatedColleges(fetched.filter((c): c is College => c !== null));
      } catch (err) {
        console.error('Error fetching associated colleges:', err);
      } finally {
        setLoadingColleges(false);
      }
    };

    fetchColleges();
  }, [principal?.collegeIds, principal?.collegeId]);

  const handleAddOtherCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.id || !principal.userCollection) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User details not fully loaded.'
      });
      return;
    }

    const userInput = newCollegeId.trim();
    if (!userInput) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a valid College ID or Code.'
      });
      return;
    }

    setAddingCollege(true);
    try {
      let targetId = userInput;
      let collegeData: College | null = null;

      // 1. Try to fetch by document ID
      const colSnap = await getDoc(doc(db, 'colleges', userInput));
      if (colSnap.exists()) {
        collegeData = { id: colSnap.id, ...colSnap.data() } as College;
      } else {
        // 2. Try to query by unique college code (case-insensitive uppercase)
        const codeQuery = await getDocs(
          query(collection(db, 'colleges'), where('code', '==', userInput.toUpperCase()))
        );
        if (!codeQuery.empty) {
          const docFound = codeQuery.docs[0];
          targetId = docFound.id;
          collegeData = { id: docFound.id, ...docFound.data() } as College;
        }
      }

      if (!collegeData) {
        toast({
          variant: 'destructive',
          title: 'Institution not found',
          description: `No institution exists with ID or Code: "${userInput}"`
        });
        return;
      }

      const currentIds = principal.collegeIds && principal.collegeIds.length > 0
        ? principal.collegeIds
        : principal.collegeId
        ? [principal.collegeId]
        : [];
      
      if (currentIds.includes(targetId)) {
        toast({
          title: 'Already linked',
          description: `"${collegeData.name}" is already associated with your account.`
        });
        setNewCollegeId('');
        return;
      }

      // Add to list and switch active immediately
      const userRef = doc(db, principal.userCollection, principal.id);
      await updateDoc(userRef, {
        collegeIds: arrayUnion(targetId),
        collegeId: targetId
      });

      toast({
        title: 'Institution Linked',
        description: `Successfully linked "${collegeData.name}" and switched your dashboard.`
      });
      setNewCollegeId('');
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Link failed',
        description: 'Failed to link institution. Try again.'
      });
    } finally {
      setAddingCollege(false);
    }
  };

  const handleSwitchCollege = async (targetId: string) => {
    if (!principal?.id || !principal.userCollection) return;
    
    try {
      const userRef = doc(db, principal.userCollection, principal.id);
      await updateDoc(userRef, {
        collegeId: targetId
      });
      
      toast({
        title: 'Institution Switched',
        description: 'Your dashboard has switched context to this institution.'
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Switch failed',
        description: 'Failed to change the active institution.'
      });
    }
  };
  // --- MULTI-COLLEGE CODE END ---

  if (!principal) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          My Profile
        </h1>
        <p className="text-muted-foreground">
          View and update your admin (principal) information.
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
                alt="Principal Profile"
                width={100}
                height={100}
                className="rounded-full border-4 border-primary/20 object-cover"
                unoptimized={!!photoUrl && (photoUrl.startsWith('blob:') || photoUrl.startsWith('data:'))}
              />
            )}
            <div>
              <h3 className="text-xl font-semibold">{name || 'Principal'}</h3>
              <p className="text-muted-foreground">{email || '—'}</p>
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

          <form className="grid gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value="Principal / Admin"
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-name">Institution name</Label>
              <Input
                id="institution-name"
                value={college?.name ?? '—'}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution-code">Institution code</Label>
              <Input
                id="institution-code"
                value={college?.code ?? '—'}
                readOnly
                className="bg-muted font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Share this code with teachers and students so they can join your institution.
              </p>
            </div>
            {college && (
              <div className="md:col-span-2 border-t pt-6 mt-4 space-y-6">
                <h3 className="text-lg font-semibold font-headline">Institution Details</h3>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="institution-address">Institution Address</Label>
                    <Textarea
                      id="institution-address"
                      value={collegeAddress}
                      onChange={(e) => setCollegeAddress(e.target.value)}
                      placeholder="Enter the official address of the institution"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logo-count">Number of College Logos</Label>
                    <Select
                      value={logoCount}
                      onValueChange={(val: '1' | '2') => setLogoCount(val)}
                    >
                      <SelectTrigger id="logo-count">
                        <SelectValue placeholder="Select number of logos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Logo</SelectItem>
                        <SelectItem value="2">2 Logos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4 md:col-span-2 grid gap-6 md:grid-cols-2">
                    <div className="space-y-2 border p-4 rounded-lg bg-muted/10">
                      <Label className="font-semibold">Primary Logo (Logo 1)</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="relative border rounded-md w-20 h-20 overflow-hidden flex items-center justify-center bg-muted/20 shrink-0">
                          {logo1File ? (
                            <img
                              src={URL.createObjectURL(logo1File)}
                              alt="New Logo 1 Preview"
                              className="object-contain w-full h-full"
                            />
                          ) : logo1Url ? (
                            <img
                              src={logo1Url}
                              alt="Current Logo 1"
                              className="object-contain w-full h-full"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground text-center p-1">No Logo</span>
                          )}
                        </div>
                        <div>
                          <input
                            ref={logo1InputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setLogo1File(e.target.files?.[0] ?? null)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logo1InputRef.current?.click()}
                          >
                            Upload Logo 1
                          </Button>
                          {logo1File && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                              {logo1File.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {logoCount === '2' && (
                      <div className="space-y-2 border p-4 rounded-lg bg-muted/10">
                        <Label className="font-semibold">Secondary Logo (Logo 2)</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="relative border rounded-md w-20 h-20 overflow-hidden flex items-center justify-center bg-muted/20 shrink-0">
                            {logo2File ? (
                              <img
                                src={URL.createObjectURL(logo2File)}
                                alt="New Logo 2 Preview"
                                className="object-contain w-full h-full"
                              />
                            ) : logo2Url ? (
                              <img
                                src={logo2Url}
                                alt="Current Logo 2"
                                className="object-contain w-full h-full"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground text-center p-1">No Logo</span>
                            )}
                          </div>
                          <div>
                            <input
                              ref={logo2InputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => setLogo2File(e.target.files?.[0] ?? null)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => logo2InputRef.current?.click()}
                            >
                              Upload Logo 2
                            </Button>
                            {logo2File && (
                              <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                                {logo2File.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

      {/* Associated Institutions Panel */}
      {principal?.userCollection === 'college_admins' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Associated Institutions
            </CardTitle>
            <CardDescription>
              Link your account to other institutions and switch the active context of your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingColleges ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {associatedColleges.map((colItem) => {
                  const isActive = colItem.id === principal?.collegeId;
                  return (
                    <div
                      key={colItem.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:bg-muted/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 border rounded-md overflow-hidden flex items-center justify-center bg-muted/20 shrink-0">
                          {colItem.logoUrl ? (
                            <img
                              src={colItem.logoUrl}
                              alt={colItem.name}
                              className="object-contain w-full h-full"
                            />
                          ) : (
                            <School className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground flex items-center gap-2">
                            {colItem.name}
                            {isActive && (
                              <span className="inline-flex items-center text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                Active
                              </span>
                            )}
                          </h4>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            ID: {colItem.id} | Code: <span className="uppercase">{colItem.code}</span>
                          </div>
                        </div>
                      </div>

                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 sm:mt-0 shrink-0"
                          onClick={() => handleSwitchCollege(colItem.id)}
                        >
                          Switch Context
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add College Form */}
            <form onSubmit={handleAddOtherCollege} className="border-t pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Add Another Institution</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-college-id" className="sr-only">Institution ID or Code</Label>
                  <Input
                    id="new-college-id"
                    placeholder="Enter College ID or Code (e.g. XLQB4T)"
                    value={newCollegeId}
                    onChange={(e) => setNewCollegeId(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={addingCollege} className="shrink-0">
                  {addingCollege ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Linking…
                    </>
                  ) : (
                    'Link Institution'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Provide the exact database ID or Institution Code to link it to your profile.
              </p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
