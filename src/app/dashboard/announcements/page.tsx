'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Send } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, setDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import { generateAnnouncementId } from '@/lib/id-utils';
import type { Announcement } from '@/lib/types';

export default function AnnouncementsPage() {
  const teacher = useCurrentTeacher();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', audience: '' });

  useEffect(() => {
    if (!teacher?.collegeId) {
      setAnnouncements([]);
      return;
    }
    const q = query(collection(db, 'announcements'), where('collegeId', '==', teacher.collegeId));
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    return () => unsub();
  }, [teacher?.collegeId]);

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content || !newAnnouncement.audience) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all fields.' });
      return;
    }
    if (!teacher?.collegeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'College not loaded.' });
      return;
    }

    const announcementToAdd = {
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      date: new Date().toISOString(),
      collegeId: teacher.collegeId,
      audience: newAnnouncement.audience, // Store audience for tracking
    };
    const announcementId = generateAnnouncementId();

    try {
      await setDoc(doc(db, 'announcements', announcementId), announcementToAdd);

      setNewAnnouncement({ title: '', content: '', audience: '' });
      setIsDialogOpen(false);
      toast({ title: 'Announcement Posted', description: `Your announcement has been broadcast to ${newAnnouncement.audience}.` });
    } catch (error) {
      console.error('Failed to post announcement:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to post announcement.' });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Announcements
          </h1>
          <p className="text-muted-foreground">
            Broadcast messages to students and other staff members.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create New Announcement</DialogTitle>
              <DialogDescription>
                This message will be broadcast to the selected audience.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input 
                  id="title" 
                  className="col-span-3" 
                  placeholder="e.g., School Holiday"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="audience" className="text-right">
                  Audience
                </Label>
                <Select onValueChange={(value) => setNewAnnouncement({...newAnnouncement, audience: value})}>
                  <SelectTrigger id="audience" className="col-span-3">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-users">All Users</SelectItem>
                    <SelectItem value="all-teachers">All Teachers</SelectItem>
                    <SelectItem value="all-students">All Students</SelectItem>
                    <SelectItem value="all-parents">All Parents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="message" className="text-right pt-2">
                  Message
                </Label>
                <Textarea 
                  id="message" 
                  className="col-span-3" 
                  placeholder="Your message here..."
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddAnnouncement}>
                <Send className="mr-2 h-4 w-4" /> Broadcast
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Recent Announcements</h2>
        {announcements.length === 0 && (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        )}
        {announcements.map((announcement) => (
          <Card key={announcement.id}>
            <CardHeader>
              <CardTitle>{announcement.title}</CardTitle>
              <CardDescription>
                Sent on {new Date(announcement.date).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{announcement.content}</p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                Sent by: {teacher?.name ?? '—'}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
