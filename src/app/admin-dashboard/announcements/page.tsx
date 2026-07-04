'use client';

import React, { useState, useEffect } from 'react';
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
import { PlusCircle, Send, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
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
import { db } from '@/lib/firebase';
import { collection, onSnapshot, setDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import type { Announcement } from '@/lib/types';
import { generateAnnouncementId } from '@/lib/id-utils';


export default function AnnouncementsPage() {
    const principal = useCurrentPrincipal();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', audience: '' });
    const { toast } = useToast();

    useEffect(() => {
      if (!principal?.collegeId) {
        setAnnouncements([]);
        return;
      }
      const q = query(collection(db, 'announcements'), where('collegeId', '==', principal.collegeId));
      const unsub = onSnapshot(q, (snap) => {
        setAnnouncements(snap.docs.map(doc => ({...doc.data(), id: doc.id} as Announcement)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      });
      return () => unsub();
    }, [principal?.collegeId]);

    const handleAddAnnouncement = async () => {
        if (!newAnnouncement.title || !newAnnouncement.content || !newAnnouncement.audience) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all fields.' });
            return;
        }
        if (!principal?.collegeId) {
            toast({ variant: 'destructive', title: 'Error', description: 'College not loaded.' });
            return;
        }

        const announcementToAdd = {
            title: newAnnouncement.title,
            content: newAnnouncement.content,
            date: new Date().toISOString(),
            collegeId: principal.collegeId,
            audience: newAnnouncement.audience, // Store audience for tracking
        };
        const announcementId = generateAnnouncementId();

        try {
          await setDoc(doc(db, 'announcements', announcementId), announcementToAdd);
          
          // Send WhatsApp notifications and create in-app notifications for selected audience only
          // Call the broadcast API directly to include sender info
          fetch('/api/whatsapp/broadcast-announcement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collegeId: principal.collegeId,
              announcementTitle: newAnnouncement.title,
              announcementContent: newAnnouncement.content,
              audience: newAnnouncement.audience,
              senderName: principal.name || 'Principal',
              senderRole: 'principal',
            }),
          }).catch(err => console.error('Announcement notification failed:', err));

          setNewAnnouncement({ title: '', content: '', audience: '' });
          setIsDialogOpen(false);
          toast({ title: 'Announcement Posted', description: `Your announcement has been broadcast to ${newAnnouncement.audience}.` });
        } catch (error) {
           toast({ variant: 'destructive', title: 'Error', description: 'Failed to post announcement.' });
        }
    };
    
    const handleDeleteAnnouncement = async (id: string) => {
        try {
          await deleteDoc(doc(db, 'announcements', id));
          toast({ variant: 'destructive', title: 'Announcement Deleted' });
        } catch(error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete announcement.' });
        }
    }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Announcements
          </h1>
          <p className="text-muted-foreground">
            Broadcast messages to students and staff members.
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
                <Input id="title" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})} className="col-span-3" placeholder="e.g., School Holiday" />
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
                <Textarea id="message" value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})} className="col-span-3" placeholder="Your message here..."/>
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
            <CardFooter className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Sent by: {principal?.name ?? '—'}
              </p>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This will permanently delete this announcement.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAnnouncement(announcement.id)}>
                        Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
