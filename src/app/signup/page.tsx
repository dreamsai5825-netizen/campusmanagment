'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { createCollege, getCollegeByCode } from '@/lib/college-service';
import { getDashboardPath } from '@/lib/auth-role';

type Role = 'principal' | 'teacher' | 'student' | 'college-admin' | 'clerk' | 'asset-manager';

export default function SignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [role, setRole] = useState<Role>('teacher');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usn, setUsn] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Principal: create college
  const [collegeName, setCollegeName] = useState('');
  const [principalHasCode, setPrincipalHasCode] = useState<'yes' | 'no'>('no');
  const [principalCode, setPrincipalCode] = useState('');
  const [adminAction, setAdminAction] = useState<'create' | 'join'>('create');

  // Teacher / Student: join by code
  const [collegeCode, setCollegeCode] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your name.' });
      return;
    }
    if (!email.trim() || !password || !confirmPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in email and password.' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match.' });
      return;
    }
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters.' });
      return;
    }

    if (role === 'principal' || role === 'college-admin') {
      if (adminAction === 'create') {
        if (!collegeName.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Please enter institution name.' });
          return;
        }
        if (principalHasCode === 'yes' && !principalCode.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Please enter DICE / institution code.' });
          return;
        }
      } else {
        if (!collegeCode.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Please enter your institution code.' });
          return;
        }
      }
    } else {
      if (!collegeCode.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter your institution code.' });
        return;
      }
    }

    setIsSigningUp(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCred.user.uid;

      let collegeId: string;

      if ((role === 'principal' || role === 'college-admin') && adminAction === 'create') {
        const college = await createCollege({
          name: collegeName.trim(),
          code: principalHasCode === 'yes' ? principalCode.trim() : undefined,
          generateCodeIfPrivate: principalHasCode === 'no',
        });
        collegeId = college.id;
        
        const colCollection = role === 'principal' ? 'principals' : 'college_admins';
        await setDoc(doc(db, colCollection, uid), {
          name: name.trim(),
          email: email.trim(),
          collegeId,
        });
        toast({
          title: 'Account created',
          description: principalHasCode === 'no'
            ? `Your institution code is: ${college.code}. Share this with teachers and students.`
            : undefined,
        });
      } else {
        const college = await getCollegeByCode(collegeCode.trim());
        if (!college) {
          await userCred.user.delete();
          toast({ variant: 'destructive', title: 'Invalid code', description: 'No institution found with this code.' });
          return;
        }
        collegeId = college.id;
 
        if (role === 'principal') {
          await setDoc(doc(db, 'principals', uid), {
            name: name.trim(),
            email: email.trim(),
            collegeId,
          });
        } else if (role === 'college-admin') {
          await setDoc(doc(db, 'college_admins', uid), {
            name: name.trim(),
            email: email.trim(),
            collegeId,
          });
        } else if (role === 'teacher') {
          await setDoc(doc(db, 'teachers', uid), {
            name: name.trim(),
            email: email.trim(),
            collegeId,
            ...(usn.trim() && { usn: usn.trim() }),
          });
        } else if (role === 'student') {
          await setDoc(doc(db, 'students', uid), {
            name: name.trim(),
            email: email.trim(),
            studentId: usn.trim() || uid.slice(0, 8),
            classId: '',
            collegeId,
            ...(usn.trim() && { usn: usn.trim() }),
          });
        } else if (role === 'clerk') {
          await setDoc(doc(db, 'clerks', uid), {
            name: name.trim(),
            email: email.trim(),
            collegeId,
          });
        } else if (role === 'asset-manager') {
          await setDoc(doc(db, 'asset_managers', uid), {
            name: name.trim(),
            email: email.trim(),
            collegeId,
          });
        }
        toast({ title: 'Account created' });
      }

      router.push(getDashboardPath(role === 'principal' ? 'admin' : role));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account.';
      toast({ variant: 'destructive', title: 'Sign up failed', description: message });
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" aria-hidden />
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-xl border-border/80 bg-card/95 backdrop-blur-sm ring-1 ring-black/5">
          <CardHeader className="space-y-1 text-center pb-2">
            <div className="flex justify-center items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-7 w-7" />
              </div>
              <CardTitle className="text-2xl font-bold font-headline sm:text-3xl text-foreground">
                CMS Portal
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">Create your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label>I am a</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Principal / Admin</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="college-admin">College / School Admin</SelectItem>
                    <SelectItem value="clerk">Clerk</SelectItem>
                    <SelectItem value="asset-manager">Asset Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(role === 'principal' || role === 'college-admin') && (
                <div className="space-y-2">
                  <Label>Registration Option</Label>
                  <Select value={adminAction} onValueChange={(v) => setAdminAction(v as 'create' | 'join')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create">Register/Create a New Institution</SelectItem>
                      <SelectItem value="join">Join an Existing Institution by Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-name">Full name</Label>
                <Input
                  id="signup-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {role === 'student' && (
                <div className="space-y-2">
                  <Label htmlFor="signup-usn">USN / Roll number</Label>
                  <Input
                    id="signup-usn"
                    placeholder="University seat number or roll no."
                    value={usn}
                    onChange={(e) => setUsn(e.target.value)}
                  />
                </div>
              )}

              {(role === 'principal' || role === 'college-admin') && adminAction === 'create' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="college-name">Institution name</Label>
                    <Input
                      id="college-name"
                      placeholder="School / College name"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Do you have an official code (DICE / University / State Govt)?</Label>
                    <Select value={principalHasCode} onValueChange={(v) => setPrincipalHasCode(v as 'yes' | 'no')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes, I have the code</SelectItem>
                        <SelectItem value="no">No (private – generate one for me)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {principalHasCode === 'yes' && (
                    <div className="space-y-2">
                      <Label htmlFor="principal-code">Institution code</Label>
                      <Input
                        id="principal-code"
                        placeholder="DICE / University code"
                        value={principalCode}
                        onChange={(e) => setPrincipalCode(e.target.value)}
                        className="uppercase"
                      />
                    </div>
                  )}
                </>
              )}
 
              {(role === 'teacher' || role === 'student' || role === 'clerk' || role === 'asset-manager' || ((role === 'principal' || role === 'college-admin') && adminAction === 'join')) && (
                <div className="space-y-2">
                  <Label htmlFor="college-code">Institution code</Label>
                  <Input
                    id="college-code"
                    placeholder="Enter code given by your institution"
                    value={collegeCode}
                    onChange={(e) => setCollegeCode(e.target.value)}
                    className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground">Ask your principal for the institution code.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">At least 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="signup-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSigningUp}>
                {isSigningUp ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="underline text-primary">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
