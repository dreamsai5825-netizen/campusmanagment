'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Announcement, College } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Megaphone, Trash2, Calendar, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SuperAdminCollegeAnnouncementsPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collegeId) return;

    // Fetch college details
    const fetchCollege = async () => {
      try {
        const collegeSnap = await getDoc(doc(db, 'colleges', collegeId));
        if (collegeSnap.exists()) {
          setCollege({ id: collegeSnap.id, ...collegeSnap.data() } as College);
        }
      } catch (err) {
        console.error('Error fetching college details:', err);
      }
    };
    fetchCollege();

    // Query announcements
    const q = query(
      collection(db, 'announcements'),
      where('collegeId', '==', collegeId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Announcement)
      );
      // Sort by date descending
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAnnouncements(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to announcements:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [collegeId]);

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({
        variant: 'destructive',
        title: 'Announcement Deleted',
        description: 'The announcement has been deleted from the database.',
      });
    } catch (err) {
      console.error('Error deleting announcement:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete announcement.',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground">{college?.name || 'College'} / Operational Data</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-pink-500" />
            Official Announcements
          </h1>
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-6">
        {announcements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No announcements found</p>
              <p className="text-sm text-muted-foreground/75 mt-1">This college has not broadcast any announcements yet.</p>
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card key={announcement.id} className="hover:border-primary/30 transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">{announcement.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-1 text-xs">
                      <Calendar className="h-3.5 w-3.5" />
                      Broadcast on {new Date(announcement.date).toLocaleString()}
                    </CardDescription>
                  </div>
                  <BadgeAudience audience={(announcement as any).audience} />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{announcement.content}</p>
              </CardContent>
              <CardFooter className="pt-3 border-t flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>Sender: Principal / Administrator</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this announcement. This action cannot be undone and it will be removed for all users.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function BadgeAudience({ audience }: { audience?: string }) {
  if (!audience) return null;
  const labelMap: Record<string, string> = {
    'all-users': 'All Users',
    'all-teachers': 'All Teachers',
    'all-students': 'All Students',
    'all-parents': 'All Parents',
  };
  const colorMap: Record<string, string> = {
    'all-users': 'bg-blue-100 text-blue-800 border-blue-200',
    'all-teachers': 'bg-purple-100 text-purple-800 border-purple-200',
    'all-students': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'all-parents': 'bg-amber-100 text-amber-800 border-amber-200',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorMap[audience] || 'bg-muted text-muted-foreground'}`}>
      {labelMap[audience] || audience}
    </span>
  );
}
