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
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

export default function StudentLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { signIn } = useAuth();
  const [firebaseEmail, setFirebaseEmail] = useState('');
  const [firebasePassword, setFirebasePassword] = useState('');
  const [showFirebasePassword, setShowFirebasePassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleFirebaseSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseEmail.trim() || !firebasePassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter email and password.' });
      return;
    }
    setIsSigningIn(true);
    try {
      await signIn(firebaseEmail.trim().toLowerCase(), firebasePassword);
      toast({ title: 'Signed in' });
      router.push('/student-dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in.';
      toast({ variant: 'destructive', title: 'Sign in failed', description: message });
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center items-center gap-2">
              <GraduationCap className="h-8 w-8 text-primary" />
              <CardTitle className="text-2xl font-bold font-headline sm:text-3xl">
                CMS Portal
              </CardTitle>
            </div>
            <CardDescription>Student Login</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleFirebaseSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="firebase-email">Email</Label>
                    <Input
                      id="firebase-email"
                      type="email"
                      placeholder="student@example.com"
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
                  <Button type="submit" className="w-full" disabled={isSigningIn}>
                    {isSigningIn ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
                <p className="text-xs text-center text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="underline text-primary">
                    Create account
                  </Link>
                </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
