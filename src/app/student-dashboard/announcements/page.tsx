'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import type { Announcement } from '@/lib/types';
import { Megaphone } from 'lucide-react';

export default function StudentAnnouncementsPage() {
  const principal = useCurrentPrincipal();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Announcements
        </h1>
        <p className="text-muted-foreground">
          Important messages from the school.
        </p>
      </div>

      <div className="space-y-6">
        {announcements.map((announcement) => (
          <Card key={announcement.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{announcement.title}</CardTitle>
                <Megaphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardDescription>
                Sent on {new Date(announcement.date).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{announcement.content}</p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Sent by: {principal?.name ?? '—'}
              </p>
            </CardFooter>
          </Card>
        ))}
        {announcements.length === 0 && (
            <Card>
                <CardContent className="h-48 flex items-center justify-center">
                    <p className="text-muted-foreground">No announcements right now.</p>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  );
}
