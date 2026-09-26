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
import { createCollege, getCollegeByCode, getInstitutionByCode } from '@/lib/college-service';
import { generateInstitutionCode } from '@/lib/college-utils';
import { getDashboardPath } from '@/lib/auth-role';

type Role = 'principal' | 'teacher' | 'student' | 'college-admin' | 'clerk' | 'asset-manager' | 'account-manager';

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

  // Principal / System Admin: create college / institution
  const [collegeName, setCollegeName] = useState('');
  const [principalHasCode, setPrincipalHasCode] = useState<'yes' | 'no'>('no');
  const [principalCode, setPrincipalCode] = useState('');
  const [adminAction, setAdminAction] = useState<'create' | 'join'>('create');
  const [parentInstitutionCodeInput, setParentInstitutionCodeInput] = useState('');

  // Teacher / Student / Staff: join by college code
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
          toast({ variant: 'destructive', title: 'Error', description: role === 'college-admin' ? 'Please enter institution name.' : 'Please enter college name.' });
          return;
        }
        if (principalHasCode === 'yes' && !principalCode.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Please enter official college / DICE code.' });
          return;
        }
      } else {
        if (!collegeCode.trim()) {
          toast({ variant: 'destructive', title: 'Error', description: 'Please enter the college code.' });
          return;
        }
      }
    } else {
      if (!collegeCode.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter the college code.' });
        return;
      }
    }

    setIsSigningUp(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCred.user.uid;

      let collegeId: string;

      if (role === 'college-admin' && adminAction === 'create') {
        // System Admin (Institution Head)
        const instCode = generateInstitutionCode();
        const college = await createCollege({
          name: collegeName.trim(),
          code: principalHasCode === 'yes' ? principalCode.trim() : undefined,
          generateCodeIfPrivate: principalHasCode === 'no',
          institutionId: uid,
          institutionCode: instCode,
          institutionName: collegeName.trim(),
        });
        collegeId = college.id;

        await setDoc(doc(db, 'college_admins', uid), {
          name: name.trim(),
          email: email.trim(),
          collegeId,
          collegeIds: [collegeId],
          institutionCode: instCode,
          institutionName: collegeName.trim(),
        });

        toast({
          title: 'System Admin Account Created',
          description: `Your Institution Code is: ${instCode}. Share this with Principals so they can connect their colleges.`,
        });
      } else if (role === 'principal' && adminAction === 'create') {
        // Principal (College Head)
        let parentInst: any = null;
        if (parentInstitutionCodeInput.trim()) {
          parentInst = await getInstitutionByCode(parentInstitutionCodeInput.trim());
        }

        const college = await createCollege({
          name: collegeName.trim(),
          code: principalHasCode === 'yes' ? principalCode.trim() : undefined,
          generateCodeIfPrivate: principalHasCode === 'no',
          ...(parentInst ? {
            institutionId: parentInst.id,
            institutionCode: parentInst.institutionCode,
            institutionName: parentInst.institutionName,
          } : {}),
        });
        collegeId = college.id;

        await setDoc(doc(db, 'principals', uid), {
          name: name.trim(),
          email: email.trim(),
          collegeId,
          ...(parentInst ? {
            institutionId: parentInst.id,
            institutionCode: parentInst.institutionCode,
          } : {}),
        });

        toast({
          title: 'Principal Account Created',
          description: `Your College Code is: ${college.code}. Share this with your teachers, staff, and students.`,
        });
      } else {
        const college = await getCollegeByCode(collegeCode.trim());
        if (!college) {
          await userCred.user.delete();
          toast({ variant: 'destructive', title: 'Invalid code', description: 'No college found with this College Code.' });
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
            collegeIds: [collegeId],
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
        } else if (role === 'account-manager') {
          await setDoc(doc(db, 'account_managers', uid), {
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
                    <SelectItem value="principal">Principal (College / Campus Head)</SelectItem>
                    <SelectItem value="college-admin">System Admin (Institution / Trust Head)</SelectItem>
                    <SelectItem value="account-manager">Account Manager (Accounts Dept)</SelectItem>
                    <SelectItem value="asset-manager">Asset Manager</SelectItem>
                    <SelectItem value="clerk">Admission Clerk</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
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
                      <SelectItem value="create">
                        {role === 'college-admin' ? 'Create New Institution / Trust' : 'Register a New College'}
                      </SelectItem>
                      <SelectItem value="join">
                        {role === 'college-admin' ? 'Attach Existing College by Code' : 'Join an Existing College by Code'}
                      </SelectItem>
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
                    <Label htmlFor="college-name">
                      {role === 'college-admin' ? 'Institution / Trust Name' : 'College / Campus Name'}
                    </Label>
                    <Input
                      id="college-name"
                      placeholder={role === 'college-admin' ? 'e.g. Oxford Educational Trust' : 'e.g. Cambridge Institute of Technology'}
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Do you have an official college code (DICE / University / State Govt)?</Label>
                    <Select value={principalHasCode} onValueChange={(v) => setPrincipalHasCode(v as 'yes' | 'no')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes, I have an official code</SelectItem>
                        <SelectItem value="no">No (generate a private code for me)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {principalHasCode === 'yes' && (
                    <div className="space-y-2">
                      <Label htmlFor="principal-code">Official College / DICE Code</Label>
                      <Input
                        id="principal-code"
                        placeholder="DICE / University code"
                        value={principalCode}
                        onChange={(e) => setPrincipalCode(e.target.value)}
                        className="uppercase"
                      />
                    </div>
                  )}
                  {role === 'principal' && (
                    <div className="space-y-2 border-t pt-3 mt-2">
                      <Label htmlFor="parent-inst-code-input">Parent Institution Code (Optional)</Label>
                      <Input
                        id="parent-inst-code-input"
                        placeholder="e.g. INST-8492 (From System Admin)"
                        value={parentInstitutionCodeInput}
                        onChange={(e) => setParentInstitutionCodeInput(e.target.value)}
                        className="font-mono uppercase"
                      />
                      <p className="text-xs text-muted-foreground">
                        If your System Admin / Organization provided an Institution Code, enter it here to link your college now (or link later in Profile).
                      </p>
                    </div>
                  )}
                </>
              )}
 
              {(role === 'teacher' || role === 'student' || role === 'clerk' || role === 'asset-manager' || role === 'account-manager' || ((role === 'principal' || role === 'college-admin') && adminAction === 'join')) && (
                <div className="space-y-2">
                  <Label htmlFor="college-code">College Code</Label>
                  <Input
                    id="college-code"
                    placeholder="Enter College Code (e.g. XLQB4T)"
                    value={collegeCode}
                    onChange={(e) => setCollegeCode(e.target.value)}
                    className="uppercase font-mono tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">
                    {role === 'college-admin' 
                      ? 'Enter the College Code to attach that college to your institution.'
                      : 'Ask your Principal for the College Code.'}
                  </p>
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
