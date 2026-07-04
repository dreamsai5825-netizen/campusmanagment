'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LifeBuoy, Send, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';

type TicketStatus = 'open' | 'in-progress' | 'resolved';

type SupportTicket = {
  id: string;
  collegeId: string;
  collegeName: string;
  principalId: string;
  principalName: string;
  principalEmail: string;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  resolution?: string;
  resolvedAt?: string;
};

export default function PrincipalSupportTicketsPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [collegeName, setCollegeName] = useState('');
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!principal?.collegeId) return;

    // Fetch college name
    getDoc(doc(db, 'colleges', principal.collegeId)).then((snap) => {
      if (snap.exists()) {
        setCollegeName(snap.data().name || '');
      }
    });

    // Fetch tickets for this college
    const q = query(
      collection(db, 'tickets'),
      where('collegeId', '==', principal.collegeId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SupportTicket));
      // Sort by date descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTickets(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to tickets:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [principal?.collegeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please fill out the ticket title and description.'
      });
      return;
    }
    if (!principal?.collegeId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'College details not loaded yet.'
      });
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'tickets'), {
        collegeId: principal.collegeId,
        collegeName: collegeName || 'Unknown College',
        principalId: principal.id,
        principalName: principal.name || 'Principal',
        principalEmail: principal.email || '',
        title: title.trim(),
        description: description.trim(),
        status: 'open',
        createdAt: new Date().toISOString()
      });

      setTitle('');
      setDescription('');
      toast({
        title: 'Ticket Raised Successfully',
        description: 'Our support team will review your ticket shortly.'
      });
    } catch (err) {
      console.error('Error raising ticket:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to raise support ticket.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'resolved':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1 w-fit">
            <CheckCircle className="h-3.5 w-3.5" /> Resolved
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1 w-fit">
            <Clock className="h-3.5 w-3.5" /> In Progress
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1 w-fit">
            <AlertCircle className="h-3.5 w-3.5" /> Open
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
          <LifeBuoy className="h-8 w-8 text-primary" />
          Support & Tickets
        </h1>
        <p className="text-muted-foreground mt-1">
          Raise issues, technical queries, or billing questions to the system helpdesk team.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Raising Ticket Form */}
        <Card className="md:col-span-2 h-fit">
          <CardHeader>
            <CardTitle>Raise a Ticket</CardTitle>
            <CardDescription>
              Submit your inquiry and we will get back to you soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Subject / Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Cannot generate billing invoice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Detailed Description</Label>
                <Textarea
                  id="description"
                  placeholder="Please describe the issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  rows={5}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? 'Raising Ticket...' : 'Submit Ticket'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Ticket List */}
        <div className="md:col-span-3 space-y-4">
          <h2 className="text-lg font-bold font-headline">Recent Tickets</h2>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tickets.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <LifeBuoy className="h-12 w-12 opacity-50 mb-4" />
                <p className="font-semibold text-sm">No tickets found</p>
                <p className="text-xs">Any tickets you raise will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-base font-bold">{ticket.title}</CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1.5 mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Raised on: {new Date(ticket.createdAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {ticket.description}
                  </p>
                  
                  {ticket.resolution && (
                    <div className="p-3 bg-muted border rounded-xl space-y-1">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        Admin Resolution Remarks:
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {ticket.resolution}
                      </p>
                      {ticket.resolvedAt && (
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          Resolved on: {new Date(ticket.resolvedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
