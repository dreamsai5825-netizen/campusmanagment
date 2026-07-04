'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
import type { College } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LifeBuoy, Clock, CheckCircle, AlertCircle, Calendar, User, Mail, School } from 'lucide-react';

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

const statusIcons: Record<TicketStatus, React.ComponentType<{ className?: string }>> = {
  'open': AlertCircle,
  'in-progress': Clock,
  'resolved': CheckCircle,
};

const statusColors: Record<TicketStatus, string> = {
  'open': 'text-red-600 bg-red-100 border-red-200',
  'in-progress': 'text-blue-600 bg-blue-100 border-blue-200',
  'resolved': 'text-green-600 bg-green-100 border-green-200',
};

export default function SuperAdminSupportTicketsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    // Listen to all support tickets
    const q = query(collection(db, 'tickets'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SupportTicket));
      // Sort by creation date descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTickets(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching tickets:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleOpenTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setResolution(ticket.resolution || '');
    setIsDetailDialogOpen(true);
  };

  const handleUpdateStatus = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return;

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'resolved') {
        updateData.resolvedAt = new Date().toISOString();
        updateData.resolution = resolution.trim();
      }

      await updateDoc(doc(db, 'tickets', selectedTicket.id), updateData);
      toast({
        title: 'Ticket Status Updated',
        description: `Status changed to ${newStatus}.`,
      });
      setIsDetailDialogOpen(false);
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update support ticket.',
      });
    }
  };

  const filteredTickets = tickets.filter((t) => {
    return filterStatus === 'all' ? true : t.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/super-admin-dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-sm text-muted-foreground">Super Admin Console</div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <LifeBuoy className="h-7 w-7 text-violet-500" />
              College Support Tickets
            </h1>
          </div>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Label htmlFor="ticket-status-filter" className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
            Filter status:
          </Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger id="ticket-status-filter" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="bottom">
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main List */}
      <div className="grid gap-4">
        {filteredTickets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <LifeBuoy className="h-12 w-12 opacity-50 mb-4" />
              <p className="font-semibold text-sm">No tickets found</p>
              <p className="text-xs">There are no tickets matching the current status filter.</p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => {
            const StatusIcon = statusIcons[ticket.status] || AlertCircle;
            const statusColor = statusColors[ticket.status] || 'text-gray-500 bg-gray-100';

            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:border-violet-500/30 hover:shadow-sm transition-all duration-300"
                onClick={() => handleOpenTicket(ticket)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold text-foreground leading-tight hover:text-primary transition-colors">
                        {ticket.title}
                      </CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1.5 mt-1 font-medium text-muted-foreground">
                        <School className="h-3.5 w-3.5" />
                        From: {ticket.collegeName}
                      </CardDescription>
                    </div>
                    <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${statusColor}`}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">{ticket.status}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {ticket.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1 border-t mt-3">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <User className="h-3.5 w-3.5" />
                      {ticket.principalName} ({ticket.principalEmail})
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px] border-l pl-3">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(ticket.createdAt).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Ticket Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader className="border-b pb-4">
                <div className="flex items-center justify-between pr-4 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[selectedTicket.status]}`}>
                    {selectedTicket.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold font-headline mt-3">{selectedTicket.title}</DialogTitle>
                <DialogDescription className="text-xs space-y-1 mt-1">
                  <div className="flex items-center gap-1.5">
                    <School className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{selectedTicket.collegeName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Principal: {selectedTicket.principalName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Email: {selectedTicket.principalEmail}</span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                {/* Description */}
                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ticket Description</Label>
                  <div className="mt-1.5 p-4 bg-muted/50 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Status Update Control */}
                <div className="pt-2 border-t">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Update Status</Label>
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(val) => handleUpdateStatus(val as TicketStatus)}
                  >
                    <SelectTrigger className="w-full mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom">
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Resolution Remarks */}
                {selectedTicket.status === 'resolved' ? (
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resolution Remarks</Label>
                    <div className="mt-1.5 p-4 bg-green-50/50 border-green-200 text-green-900 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border">
                      {selectedTicket.resolution || 'No resolution remarks provided.'}
                    </div>
                    {selectedTicket.resolvedAt && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Resolved at: {new Date(selectedTicket.resolvedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t">
                    <Label htmlFor="resolution" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Resolution Remarks
                    </Label>
                    <Textarea
                      id="resolution"
                      placeholder="Explain how the ticket was resolved (required for resolving)..."
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="mt-1.5 text-sm"
                      rows={4}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus('resolved')}
                        disabled={!resolution.trim()}
                      >
                        Resolve Ticket
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
