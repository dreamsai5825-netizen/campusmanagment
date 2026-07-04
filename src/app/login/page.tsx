'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { signIn, signInWithGoogle, signOut } = useAuth();
  const [firebaseEmail, setFirebaseEmail] = useState('');
  const [firebasePassword, setFirebasePassword] = useState('');
  const [showFirebasePassword, setShowFirebasePassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleFirebaseSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseEmail.trim() || !firebasePassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter email and password.' });
      return;
    }
    setIsSigningIn(true);
    try {
      const { getAuthRole, getAuthRoleByEmail, getDashboardPath } = await import('@/lib/auth-role');
      const { auth } = await import('@/lib/firebase');
      await signIn(firebaseEmail.trim(), firebasePassword);
      const uid = auth.currentUser?.uid;
      const email = auth.currentUser?.email;
      if (!uid) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not get user.' });
        return;
      }
      let role = await getAuthRole(uid);
      if (role === null && email) {
        role = await getAuthRoleByEmail(email);
      }
      const path = getDashboardPath(role);
      if (path === '/') {
        toast({
          variant: 'destructive',
          title: 'Account not found',
          description: 'No principal/teacher/student record for this email. If your principal added you, sign up first with the same email, then sign in.',
        });
        return;
      }
      toast({ title: 'Signed in' });
      router.push(path);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      const isInvalidCredential =
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-email' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found';
      const description = isInvalidCredential
        ? 'Wrong email or password. If you just reset your password, use the new password. If you usually sign in with Google, use "Sign in with Google" instead.'
        : err instanceof Error ? err.message : 'Failed to sign in.';
      toast({ variant: 'destructive', title: 'Sign in failed', description });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    try {
      const { getAuthRoleByEmail, getDashboardPath } = await import('@/lib/auth-role');
      const user = await signInWithGoogle();
      const email = user.email;
      if (!email) {
        await signOut();
        toast({ variant: 'destructive', title: 'Error', description: 'Google account has no email.' });
        return;
      }
      const role = await getAuthRoleByEmail(email);
      const path = getDashboardPath(role);
      if (path === '/') {
        await signOut();
        toast({ variant: 'destructive', title: 'No user found', description: 'This email is not registered. Ask your principal to add you, or sign up with email.' });
        return;
      }
      toast({ title: 'Signed in with Google' });
      router.push(path);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      toast({ variant: 'destructive', title: 'Sign in failed', description: message });
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your email.' });
      return;
    }
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail.trim());
      toast({ title: 'Check your email', description: 'Password reset link has been sent to your email.' });
      setForgotPasswordOpen(false);
      setForgotPasswordEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email.';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" aria-hidden />
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" aria-hidden />
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
            <CardDescription className="text-muted-foreground">Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleFirebaseSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firebase-email">Email</Label>
                <Input
                  id="firebase-email"
                  type="email"
                  placeholder="you@example.com"
                  value={firebaseEmail}
                  onChange={(e) => setFirebaseEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firebase-password">Password</Label>
                <div className="relative">
                  <Input
                    id="firebase-password"
                    type={showFirebasePassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={firebasePassword}
                    onChange={(e) => setFirebasePassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFirebasePassword(!showFirebasePassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    {showFirebasePassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                After resetting password, use the new password to sign in.
              </p>
              <Button type="submit" className="w-full" disabled={isSigningIn}>
                {isSigningIn ? 'Signing in…' : 'Sign in'}
              </Button>
              <div className="relative my-4">
                <span className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </span>
                <span className="relative flex justify-center text-xs uppercase text-muted-foreground">
                  Or continue with
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isGoogleSigningIn}
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon className="mr-2 h-5 w-5" />
                {isGoogleSigningIn ? 'Signing in…' : 'Sign in with Google'}
              </Button>
            </form>
            <p className="text-xs text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="underline text-primary">
                Create account
              </Link>
            </p>

            <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Forgot password</DialogTitle>
                  <DialogDescription>
                    Enter your email and we&apos;ll send you a link to reset your password.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setForgotPasswordOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSendingReset}>
                      {isSendingReset ? 'Sending…' : 'Send reset link'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
