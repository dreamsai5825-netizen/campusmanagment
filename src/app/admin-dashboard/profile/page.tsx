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
import { doc, updateDoc, getDoc, getDocs, collection, query, where, arrayUnion, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { uploadProfilePhoto, uploadCollegeLogo } from '@/lib/profile-photo';
import { getCollegeById, regenerateCollegeCode, linkCollegeToInstitution, unlinkCollegeFromInstitution } from '@/lib/college-service';
import type { College, CollegeBankAccountDetails, RazorpaySettings } from '@/lib/types';
import {
  Loader2,
  Building2,
  School,
  CreditCard,
  Key,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  Network,
  Unlink,
  Link2,
  CheckCircle2,
  Copy,
  Check,
  Landmark,
  AlertCircle,
  HelpCircle,
  Edit,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

  const [institutionName, setInstitutionName] = useState('');
  const [collegeAddress, setCollegeAddress] = useState('');
  const [logoCount, setLogoCount] = useState<'1' | '2'>('1');
  const [logo1File, setLogo1File] = useState<File | null>(null);
  const [logo2File, setLogo2File] = useState<File | null>(null);
  const [logo1Url, setLogo1Url] = useState('');
  const [logo2Url, setLogo2Url] = useState('');
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Parent Institution Link States
  const [parentInstitutionInput, setParentInstitutionInput] = useState('');
  const [connectingInstitution, setConnectingInstitution] = useState(false);
  const [unlinkingInstitution, setUnlinkingInstitution] = useState(false);

  const handleRegenerateCode = async () => {
    if (!principal?.collegeId) return;
    setRegeneratingCode(true);
    try {
      const newCode = await regenerateCollegeCode(principal.collegeId);
      setCollege((prev) => (prev ? { ...prev, code: newCode } : null));
      toast({
        title: 'College Code Regenerated',
        description: `Your new college code is: ${newCode}`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to regenerate code.',
      });
    } finally {
      setRegeneratingCode(false);
    }
  };

  const handleConnectInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!college?.id || !parentInstitutionInput.trim()) return;
    setConnectingInstitution(true);
    try {
      const res = await linkCollegeToInstitution({
        collegeId: college.id,
        institutionCode: parentInstitutionInput.trim(),
      });
      setCollege((prev) => prev ? {
        ...prev,
        institutionId: res.institutionId,
        institutionCode: res.institutionCode,
        institutionName: res.institutionName,
      } : null);
      setParentInstitutionInput('');
      toast({
        title: 'Connected to Parent Institution',
        description: `Successfully linked this college to "${res.institutionName}" (${res.institutionCode}).`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: err?.message || 'Could not link to institution. Please check the institution code.',
      });
    } finally {
      setConnectingInstitution(false);
    }
  };

  const handleUnlinkInstitution = async () => {
    if (!college?.id) return;
    setUnlinkingInstitution(true);
    try {
      await unlinkCollegeFromInstitution(college.id);
      setCollege((prev) => prev ? {
        ...prev,
        institutionId: undefined,
        institutionCode: undefined,
        institutionName: undefined,
      } : null);
      toast({
        title: 'Disconnected from Institution',
        description: 'This college is no longer linked to a parent institution.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Unlink Failed',
        description: err?.message || 'Failed to disconnect from institution.',
      });
    } finally {
      setUnlinkingInstitution(false);
    }
  };
  
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

  // Razorpay Gateway States
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);
  const [savingRazorpay, setSavingRazorpay] = useState(false);

  // College Bank Account & Route States
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [savingBankAccount, setSavingBankAccount] = useState(false);

  // College Admin quick-edit dialog state for child college
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editAccountHolderName, setEditAccountHolderName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editIfscCode, setEditIfscCode] = useState('');
  const [editLinkedAccountId, setEditLinkedAccountId] = useState('');
  const [savingEditCollege, setSavingEditCollege] = useState(false);

  // Load master credentials if logged in as College Admin
  useEffect(() => {
    if (principal?.userCollection === 'college_admins' && principal?.id) {
      getDoc(doc(db, 'college_admins', principal.id)).then((snap) => {
        if (snap.exists()) {
          const rzp = snap.data()?.razorpaySettings;
          if (rzp) {
            setRazorpayEnabled(rzp.enabled ?? false);
            setRazorpayKeyId(rzp.keyId ?? '');
            setRazorpayKeySecret(rzp.keySecret ?? '');
          }
        }
      });
    }
  }, [principal?.id, principal?.userCollection]);

  useEffect(() => {
    if (college) {
      setInstitutionName(college.name ?? '');
      setCollegeAddress(college.address ?? '');
      setLogoCount(college.logo2Url ? '2' : '1');
      setLogo1Url(college.logoUrl ?? '');
      setLogo2Url(college.logo2Url ?? '');

      if (college.razorpaySettings) {
        setRazorpayEnabled(college.razorpaySettings.enabled || false);
        setRazorpayKeyId(college.razorpaySettings.keyId || '');
        setRazorpayKeySecret(college.razorpaySettings.keySecret || '');
      }

      if (college.bankAccountDetails) {
        setBankName(college.bankAccountDetails.bankName || '');
        setAccountHolderName(college.bankAccountDetails.accountHolderName || '');
        setAccountNumber(college.bankAccountDetails.accountNumber || '');
        setIfscCode(college.bankAccountDetails.ifscCode || '');
        setLinkedAccountId(college.bankAccountDetails.linkedAccountId || '');
      }
    }
  }, [college]);

  // College Admin: Save Master Gateway & sync to affiliated colleges
  const handleSaveMasterRazorpaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.id) return;

    setSavingRazorpay(true);
    try {
      const masterSettings: RazorpaySettings = {
        enabled: razorpayEnabled,
        keyId: razorpayKeyId.trim(),
        keySecret: razorpayKeySecret.trim(),
        routeEnabled: true,
        updatedAt: new Date().toISOString(),
      };

      // 1. Save in college_admins collection
      await updateDoc(doc(db, 'college_admins', principal.id), {
        razorpaySettings: masterSettings,
      });

      // 2. Sync master razorpaySettings across all associated colleges
      if (associatedColleges.length > 0) {
        const batch = writeBatch(db);
        associatedColleges.forEach((col) => {
          batch.update(doc(db, 'colleges', col.id), {
            razorpaySettings: masterSettings,
          });
        });
        await batch.commit();

        setAssociatedColleges((prev) =>
          prev.map((c) => ({
            ...c,
            razorpaySettings: masterSettings,
          }))
        );
      }

      toast({
        title: 'Master Razorpay Gateway Saved',
        description: razorpayEnabled
          ? 'Master Razorpay credentials saved and synced to all affiliated colleges. Razorpay Route is active.'
          : 'Razorpay payment gateway disabled for all colleges.',
      });
    } catch (err: any) {
      console.error('Error saving master Razorpay settings:', err);
      toast({
        variant: 'destructive',
        title: 'Error Saving Master Gateway',
        description: err.message || 'Failed to update master Razorpay credentials.',
      });
    } finally {
      setSavingRazorpay(false);
    }
  };

  // College Principal: Save College Bank Account & Linked Account ID
  const handleSaveCollegeBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.collegeId) return;

    setSavingBankAccount(true);
    try {
      const bankDetails: CollegeBankAccountDetails = {
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        linkedAccountId: linkedAccountId.trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'colleges', principal.collegeId), {
        bankAccountDetails: bankDetails,
      });

      setCollege((prev) => (prev ? { ...prev, bankAccountDetails: bankDetails } : null));

      toast({
        title: 'Bank Account Saved',
        description: linkedAccountId.trim()
          ? 'College bank account details & Razorpay Route ID saved. Student fee payments will route directly to this account.'
          : 'College bank account saved. Please configure your Razorpay Linked Account ID to enable automated fee routing.',
      });
    } catch (err: any) {
      console.error('Error saving bank account details:', err);
      toast({
        variant: 'destructive',
        title: 'Error Saving Bank Details',
        description: err.message || 'Failed to update bank account details.',
      });
    } finally {
      setSavingBankAccount(false);
    }
  };

  // College Admin: Quick Edit Child College Settlement Details
  const handleOpenEditCollege = (colItem: College) => {
    setEditingCollege(colItem);
    setEditBankName(colItem.bankAccountDetails?.bankName || '');
    setEditAccountHolderName(colItem.bankAccountDetails?.accountHolderName || '');
    setEditAccountNumber(colItem.bankAccountDetails?.accountNumber || '');
    setEditIfscCode(colItem.bankAccountDetails?.ifscCode || '');
    setEditLinkedAccountId(colItem.bankAccountDetails?.linkedAccountId || '');
  };

  const handleSaveChildCollegeSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollege) return;

    setSavingEditCollege(true);
    try {
      const updatedDetails: CollegeBankAccountDetails = {
        bankName: editBankName.trim(),
        accountHolderName: editAccountHolderName.trim(),
        accountNumber: editAccountNumber.trim(),
        ifscCode: editIfscCode.trim().toUpperCase(),
        linkedAccountId: editLinkedAccountId.trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'colleges', editingCollege.id), {
        bankAccountDetails: updatedDetails,
      });

      setAssociatedColleges((prev) =>
        prev.map((c) => (c.id === editingCollege.id ? { ...c, bankAccountDetails: updatedDetails } : c))
      );

      if (college?.id === editingCollege.id) {
        setBankName(updatedDetails.bankName || '');
        setAccountHolderName(updatedDetails.accountHolderName || '');
        setAccountNumber(updatedDetails.accountNumber || '');
        setIfscCode(updatedDetails.ifscCode || '');
        setLinkedAccountId(updatedDetails.linkedAccountId || '');
        setCollege((prev) => (prev ? { ...prev, bankAccountDetails: updatedDetails } : null));
      }

      toast({
        title: 'College Settlement Account Updated',
        description: `Updated settlement details for ${editingCollege.name}.`,
      });
      setEditingCollege(null);
    } catch (err: any) {
      console.error('Error updating child college settlement:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to update settlement details.',
      });
    } finally {
      setSavingEditCollege(false);
    }
  };

  // Fallback for standalone college direct settings
  const handleSaveRazorpaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.collegeId) return;

    setSavingRazorpay(true);
    try {
      await updateDoc(doc(db, 'colleges', principal.collegeId), {
        razorpaySettings: {
          enabled: razorpayEnabled,
          keyId: razorpayKeyId.trim(),
          keySecret: razorpayKeySecret.trim(),
          updatedAt: new Date().toISOString(),
        },
      });

      setCollege((prev) =>
        prev
          ? {
              ...prev,
              razorpaySettings: {
                enabled: razorpayEnabled,
                keyId: razorpayKeyId.trim(),
                keySecret: razorpayKeySecret.trim(),
                updatedAt: new Date().toISOString(),
              },
            }
          : null
      );

      toast({
        title: 'Razorpay Credentials Saved',
        description: razorpayEnabled
          ? 'Online payment gateway is now active for fee collections.'
          : 'Razorpay payment settings saved.',
      });
    } catch (err: any) {
      console.error('Error saving Razorpay settings:', err);
      toast({
        variant: 'destructive',
        title: 'Error Saving Credentials',
        description: err.message || 'Failed to update Razorpay credentials.',
      });
    } finally {
      setSavingRazorpay(false);
    }
  };

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
          name: institutionName.trim() || (college?.name ?? ''),
          address: collegeAddress.trim(),
          logoUrl: finalLogoUrl,
          logo2Url: logoCount === '2' ? finalLogoUrl2 : '',
        });

        setCollege(prev => prev ? {
          ...prev,
          name: institutionName.trim() || prev.name,
          address: collegeAddress.trim(),
          logoUrl: finalLogoUrl,
          logo2Url: logoCount === '2' ? finalLogoUrl2 : '',
        } : null);
      }

      const collectionName = principal.userCollection || (principal.isSuperAdmin ? 'super_admins' : 'principals');
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
              <Label htmlFor="institution-name">Institution Name</Label>
              <Input
                id="institution-name"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. Cambridge International Institute"
              />
              <p className="text-xs text-muted-foreground">
                This name will appear on all fee receipts, student sheets, and OMR answer sheets.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="college-code">College Code</Label>
              <div className="flex gap-2">
                <Input
                  id="college-code"
                  value={college?.code || 'Loading...'}
                  readOnly
                  className="bg-muted font-mono uppercase font-bold text-primary tracking-wider"
                />
                {college && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (college?.code) {
                          navigator.clipboard.writeText(college.code);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                          toast({ title: 'Copied', description: 'College code copied to clipboard.' });
                        }
                      }}
                      title="Copy College Code"
                      className="shrink-0"
                    >
                      {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRegenerateCode}
                      disabled={regeneratingCode}
                      className="shrink-0"
                    >
                      {regeneratingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Regenerate Code'}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Share this College Code with your teachers, staff, and students so they can join this college.
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

      {/* Parent Institution Connection (System Admin) Card */}
      {principal?.collegeId && (
        <Card className="border-indigo-500/30 dark:border-indigo-800/40 shadow-sm">
          <CardHeader className="bg-indigo-500/5 dark:bg-indigo-950/20 border-b pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-indigo-950 dark:text-indigo-100">
                  <Network className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Parent Institution Connection (System Admin)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Connect your college to the overarching Institution / System Admin to enable central management, cross-campus coordination, and multi-college reporting.
                </CardDescription>
              </div>
              <div>
                {college?.institutionCode ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-muted text-muted-foreground border px-3 py-1 rounded-full text-xs font-semibold">
                    Standalone College
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {college?.institutionCode ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Linked Parent Institution
                    </div>
                    <div className="text-base font-bold text-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-indigo-600" />
                      {college.institutionName || 'Central Institution / Trust'}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                      <span>Institution Code: <strong className="text-foreground tracking-wide font-bold">{college.institutionCode}</strong></span>
                      {college.institutionId && (
                        <span className="text-[11px] text-muted-foreground">ID: {college.institutionId}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={unlinkingInstitution}
                    onClick={handleUnlinkInstitution}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0 gap-1.5"
                  >
                    {unlinkingInstitution ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Unlink className="h-3.5 w-3.5" />
                        Disconnect Institution
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnectInstitution} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="parent-inst-code" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-indigo-600" />
                    Enter Institution Code (From System Admin)
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="parent-inst-code"
                      placeholder="e.g. INST-8492 or System Admin ID"
                      value={parentInstitutionInput}
                      onChange={(e) => setParentInstitutionInput(e.target.value)}
                      className="font-mono uppercase tracking-wide uppercase"
                    />
                    <Button
                      type="submit"
                      disabled={connectingInstitution || !parentInstitutionInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 gap-1.5"
                    >
                      {connectingInstitution ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Connecting…
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4" />
                          Connect to Institution
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ask your System Admin / Management for their <strong>Institution Code</strong> (starts with <code>INST-</code>). Connecting links this college to their multi-campus dashboard.
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* COLLEGE ADMIN: Master Razorpay Route Gateway Configuration */}
      {principal?.userCollection === 'college_admins' && (
        <>
          <Card className="border-indigo-500/30 dark:border-indigo-800/40 shadow-sm">
            <CardHeader className="bg-indigo-500/5 dark:bg-indigo-950/20 border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 border-indigo-500/30 font-semibold text-[11px]">
                      Razorpay Route Multi-College Gateway
                    </Badge>
                  </div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-indigo-950 dark:text-indigo-100">
                    <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Master Razorpay Gateway Integration
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Configure your institution's central Razorpay credentials. Student fee payments across all affiliated colleges are processed through this account and automatically routed to each college's individual bank account via <strong>Razorpay Route</strong>.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 bg-background border px-3 py-1.5 rounded-full shadow-xs shrink-0 self-start sm:self-auto">
                  <Switch
                    id="master-razorpay-switch"
                    checked={razorpayEnabled}
                    onCheckedChange={setRazorpayEnabled}
                  />
                  <Label htmlFor="master-razorpay-switch" className="text-xs font-semibold cursor-pointer">
                    {razorpayEnabled ? 'Active' : 'Disabled'}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <form onSubmit={handleSaveMasterRazorpaySettings} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="master-razorpay-key-id" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-indigo-600" />
                      Master Razorpay Key ID
                    </Label>
                    <Input
                      id="master-razorpay-key-id"
                      placeholder="e.g. rzp_live_xxxxxxxxxxxx or rzp_test_xxxxxxxxxxxx"
                      value={razorpayKeyId}
                      onChange={(e) => setRazorpayKeyId(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Obtained from your Master Razorpay Dashboard under API Keys.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="master-razorpay-key-secret" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-indigo-600" />
                      Master Razorpay Key Secret
                    </Label>
                    <div className="relative">
                      <Input
                        id="master-razorpay-key-secret"
                        type={showRazorpaySecret ? 'text' : 'password'}
                        placeholder="e.g. xxxxxxxxxxxxxxxxxxxxxxxx"
                        value={razorpayKeySecret}
                        onChange={(e) => setRazorpayKeySecret(e.target.value)}
                        className="font-mono text-xs pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRazorpaySecret(!showRazorpaySecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRazorpaySecret ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Kept encrypted & safe. Used server-side to sign and verify student payment orders.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-md text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Razorpay Route Settlement Architecture:</strong> When a student of <em>College A</em> pays fees, Razorpay instantly transfers 100% of the funds to College A's linked bank account. The money never mixes with College B, C, or D.
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Synchronizes across all affiliated colleges automatically.</span>
                  </div>
                  <Button type="submit" disabled={savingRazorpay} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    {savingRazorpay ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Gateway...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Master Gateway & Sync Colleges
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Affiliated Colleges Settlement Status Table */}
          <Card className="border-sky-500/30 dark:border-sky-800/40 shadow-sm">
            <CardHeader className="bg-sky-500/5 dark:bg-sky-950/20 border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-sky-950 dark:text-sky-100">
                    <Landmark className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                    College Settlement Bank Accounts (Razorpay Route)
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Manage bank accounts and Razorpay Linked Account IDs for each college in your institution network.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {associatedColleges.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No colleges currently connected to your institution network.
                </div>
              ) : (
                <div className="space-y-3">
                  {associatedColleges.map((colItem) => {
                    const bank = colItem.bankAccountDetails;
                    const hasRouteId = !!bank?.linkedAccountId && bank.linkedAccountId.trim().startsWith('acc_');
                    const hasBank = !!bank?.accountNumber && !!bank?.ifscCode;

                    return (
                      <div
                        key={colItem.id}
                        className="p-4 border rounded-lg bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-sky-500/40"
                      >
                        <div className="space-y-1 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-foreground">{colItem.name}</h4>
                            <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                              {colItem.code}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {hasBank ? (
                              <span>
                                {bank?.bankName || 'Bank'} | A/C: ••••{bank?.accountNumber?.slice(-4)} | IFSC: {bank?.ifscCode}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Bank details not configured by Principal
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div>
                            <div className="text-[11px] text-muted-foreground font-semibold">
                              Razorpay Route Account ID:
                            </div>
                            {hasRouteId ? (
                              <span className="font-mono text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                                {bank?.linkedAccountId}
                              </span>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px]">
                                Pending Setup
                              </Badge>
                            )}
                          </div>

                          <div>
                            {hasRouteId ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 text-xs py-1">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                Ready for Auto-Routing
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs py-1">
                                <AlertCircle className="h-3.5 w-3.5 mr-1 text-amber-600" />
                                Action Required
                              </Badge>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditCollege(colItem)}
                            className="gap-1.5 shrink-0 text-xs border-sky-300 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Manage Settlement A/C
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step-by-Step Razorpay Route Setup Guide */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <HelpCircle className="h-5 w-5 text-indigo-600" />
                How to Setup Razorpay Route for Multiple Colleges
              </CardTitle>
              <CardDescription className="text-xs">
                Follow these simple steps to ensure student fee payments route into the correct college bank account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-indigo-600">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[11px]">1</span>
                    Activate Route
                  </div>
                  <p className="text-muted-foreground">
                    Log in to your master Razorpay Dashboard and enable <strong>Route</strong> from the left navigation menu.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-indigo-600">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[11px]">2</span>
                    Add Linked Accounts
                  </div>
                  <p className="text-muted-foreground">
                    Under <strong>Route → Accounts</strong>, click "Add Account" for College A, B, C, D with their respective legal names & bank account numbers.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-indigo-600">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[11px]">3</span>
                    Copy Account ID
                  </div>
                  <p className="text-muted-foreground">
                    Razorpay generates an Account ID starting with <code>acc_</code> (e.g. <code>acc_Lz89x1K0abcXYZ</code>) for each college.
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-indigo-600">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[11px]">4</span>
                    Auto-Route Fees
                  </div>
                  <p className="text-muted-foreground">
                    Paste the <code>acc_...</code> ID into the table above or let each Principal enter it. All student payments will instantly route to that college's account!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* COLLEGE PRINCIPAL: Bank Account Details & Route Settlement Card */}
      {principal?.userCollection !== 'college_admins' && principal?.collegeId && (
        <>
          <Card className="border-sky-500/30 dark:border-sky-800/40 shadow-sm">
            <CardHeader className="bg-sky-500/5 dark:bg-sky-950/20 border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 font-semibold text-[11px]">
                      {college?.institutionName ? `Managed by ${college.institutionName}` : 'College Settlement Account'}
                    </Badge>
                  </div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-sky-950 dark:text-sky-100">
                    <Landmark className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                    College Bank Account & Settlement Details
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Configure your college's official bank account and Razorpay Route Account ID. Student fees collected online will be deposited 100% directly into this bank account.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <form onSubmit={handleSaveCollegeBankAccount} className="space-y-4">
                {/* Routing Status Indicator */}
                {linkedAccountId?.trim()?.startsWith('acc_') ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong>Auto-Routing is Active ({linkedAccountId}):</strong> Online student fee payments for <strong>{college?.name || 'this college'}</strong> are automatically routed 100% to this bank account via Razorpay Route.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Action Required:</strong> Enter your college's <strong>Razorpay Linked Account ID</strong> (provided by your College Admin, starts with <code>acc_</code>) below to enable automated settlement directly into your bank account.
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5 text-sky-600" />
                      Bank Name
                    </Label>
                    <Input
                      id="bank-name"
                      placeholder="e.g. State Bank of India, HDFC Bank, etc."
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-holder-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-sky-600" />
                      Account Holder / Beneficiary Name
                    </Label>
                    <Input
                      id="account-holder-name"
                      placeholder="e.g. Annapurna College of Arts & Science"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-number" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-sky-600" />
                      Bank Account Number
                    </Label>
                    <Input
                      id="account-number"
                      placeholder="e.g. 102938475610"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ifsc-code" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-sky-600" />
                      IFSC Code
                    </Label>
                    <Input
                      id="ifsc-code"
                      placeholder="e.g. SBIN0001234"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="linked-account-id" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                    Razorpay Route Linked Account ID
                  </Label>
                  <Input
                    id="linked-account-id"
                    placeholder="e.g. acc_Lz89x1K0abcXYZ"
                    value={linkedAccountId}
                    onChange={(e) => setLinkedAccountId(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Provided by your College Admin from the institution's master Razorpay Route dashboard. Unique to this college.
                  </p>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Settlement funds deposit directly to this bank account.</span>
                  </div>
                  <Button type="submit" disabled={savingBankAccount} className="bg-sky-600 hover:bg-sky-700 text-white gap-2">
                    {savingBankAccount ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving Bank Details...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save College Bank Details
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Standalone Fallback: Direct Razorpay API Keys Card (Only if NOT connected to parent institution) */}
          {!college?.institutionId && !college?.institutionCode && (
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      Standalone Direct Razorpay API Credentials (Optional)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      If your college operates independently without a parent institution, you can enter your own Razorpay API keys directly.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 bg-background border px-3 py-1 rounded-full shadow-xs">
                    <Switch
                      id="standalone-razorpay-switch"
                      checked={razorpayEnabled}
                      onCheckedChange={setRazorpayEnabled}
                    />
                    <Label htmlFor="standalone-razorpay-switch" className="text-xs font-semibold cursor-pointer">
                      {razorpayEnabled ? 'Active' : 'Disabled'}
                    </Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <form onSubmit={handleSaveRazorpaySettings} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="direct-key-id" className="text-xs font-semibold">Key ID</Label>
                      <Input
                        id="direct-key-id"
                        placeholder="rzp_live_..."
                        value={razorpayKeyId}
                        onChange={(e) => setRazorpayKeyId(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="direct-key-secret" className="text-xs font-semibold">Key Secret</Label>
                      <Input
                        id="direct-key-secret"
                        type="password"
                        placeholder="Secret Key"
                        value={razorpayKeySecret}
                        onChange={(e) => setRazorpayKeySecret(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={savingRazorpay} variant="outline" size="sm">
                    {savingRazorpay ? 'Saving...' : 'Save Direct Keys'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Associated Colleges Panel for System Admin */}
      {principal?.userCollection === 'college_admins' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Connected Colleges (Institution Network)
            </CardTitle>
            <CardDescription>
              View and switch context between all colleges connected under your Institution Code, or attach a new college to your network.
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
                                Active Context
                              </span>
                            )}
                          </h4>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            ID: {colItem.id} | College Code: <span className="uppercase font-bold text-foreground">{colItem.code}</span>
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
              <h3 className="text-sm font-semibold text-foreground">Attach Another College</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-college-id" className="sr-only">College ID or Code</Label>
                  <Input
                    id="new-college-id"
                    placeholder="Enter College Code or ID (e.g. XLQB4T)"
                    value={newCollegeId}
                    onChange={(e) => setNewCollegeId(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={addingCollege} className="shrink-0">
                  {addingCollege ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Attaching…
                    </>
                  ) : (
                    'Attach College'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a college's <strong>College Code</strong> (or database ID) to attach it to your System Admin institution network.
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {/* College Admin: Manage Child College Settlement Account Dialog */}
      <Dialog open={!!editingCollege} onOpenChange={(open) => !open && setEditingCollege(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-sky-600" />
              Manage Settlement Account
            </DialogTitle>
            <DialogDescription>
              Update bank account and Razorpay Route Account ID for <strong>{editingCollege?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveChildCollegeSettlement} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-route-id" className="text-xs font-bold text-sky-700 dark:text-sky-400">
                Razorpay Route Account ID (Required for Auto-Split)
              </Label>
              <Input
                id="edit-route-id"
                placeholder="e.g. acc_Lz89x1K0abcXYZ"
                value={editLinkedAccountId}
                onChange={(e) => setEditLinkedAccountId(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Account ID generated in your Razorpay Dashboard under Route → Accounts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label htmlFor="edit-bank-name" className="text-xs">Bank Name</Label>
                <Input
                  id="edit-bank-name"
                  placeholder="e.g. HDFC Bank"
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-holder-name" className="text-xs">Account Holder Name</Label>
                <Input
                  id="edit-holder-name"
                  placeholder="e.g. College Account"
                  value={editAccountHolderName}
                  onChange={(e) => setEditAccountHolderName(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-account-num" className="text-xs">Account Number</Label>
                <Input
                  id="edit-account-num"
                  placeholder="e.g. 102938475610"
                  value={editAccountNumber}
                  onChange={(e) => setEditAccountNumber(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-ifsc" className="text-xs">IFSC Code</Label>
                <Input
                  id="edit-ifsc"
                  placeholder="e.g. HDFC0001234"
                  value={editIfscCode}
                  onChange={(e) => setEditIfscCode(e.target.value)}
                  className="font-mono text-xs uppercase"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingCollege(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingEditCollege}
                className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
              >
                {savingEditCollege ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settlement Details
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
