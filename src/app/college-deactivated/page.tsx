'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut, GraduationCap } from 'lucide-react';

function CollegeDeactivatedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useAuth();

  const reasonParam = searchParams.get('reason') || '';
  const collegeId = searchParams.get('collegeId') || '';

  const [reason, setReason] = useState(reasonParam);

  useEffect(() => {
    if (!collegeId) return;

    // Listen to changes in the college's status
    const unsub = onSnapshot(doc(db, 'colleges', collegeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'active') {
          // If the college is reactivated, redirect to login
          router.push('/');
        } else if (data.deactivationReason) {
          setReason(data.deactivationReason);
        }
      }
    }, (err) => {
      console.error('Error listening to college status in deactivation page:', err);
    });

    return () => unsub();
  }, [collegeId, router]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-accent/5" aria-hidden />
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-destructive/10 blur-3xl" aria-hidden />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl" aria-hidden />

      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-xl border-destructive/20 bg-card/95 backdrop-blur-sm ring-1 ring-black/5">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <CardTitle className="text-2xl font-bold font-headline text-foreground">
                Portal Suspended
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-sm">
              Your college portal access has been temporarily restricted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              The system administrator has deactivated this institution's access. If you believe this is an error, please contact support.
            </p>

            <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-xl space-y-1.5 text-left">
              <span className="text-xs font-bold text-destructive uppercase tracking-wider">Deactivation Reason</span>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {reason || 'No specific reason provided by the administrator.'}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign Out / Login to Another Account
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function CollegeDeactivatedPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    }>
      <CollegeDeactivatedContent />
    </Suspense>
  );
}
