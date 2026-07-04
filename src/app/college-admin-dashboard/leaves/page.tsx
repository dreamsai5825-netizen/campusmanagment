'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Search, Eye, FileText } from 'lucide-react';
import type { LeaveRequest } from '@/lib/types';

function formatDate(iso: string) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatDateTime(iso: string) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export default function CollegeAdminLeavesPage() {
  const principal = useCurrentPrincipal();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const q = query(
      collection(db, 'leaveRequests'),
      where('collegeId', '==', principal.collegeId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setLeaveRequests(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching leaves:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [principal?.collegeId]);

  const filteredLeaves = React.useMemo(() => {
    return leaveRequests.filter((lr) => {
      const matchesSearch =
        (lr.senderName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lr.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lr.reason || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === 'all' || lr.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [leaveRequests, searchQuery, activeTab]);

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
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
          <Calendar className="h-7 w-7 text-sky-500" />
          Leave Requests
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          View and monitor leave requests submitted by faculty and staff.
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Tab buttons */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className="capitalize font-medium"
                >
                  {tab}
                </Button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leaves..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-x-auto">
            <Table className="min-w-[700px] w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="p-4">Faculty Member</TableHead>
                  <TableHead className="p-4">Subject</TableHead>
                  <TableHead className="p-4">Start Date</TableHead>
                  <TableHead className="p-4">End Date</TableHead>
                  <TableHead className="p-4">Status</TableHead>
                  <TableHead className="p-4 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaves.map((lr) => (
                  <TableRow key={lr.id} className="hover:bg-muted/30">
                    <TableCell className="p-4 font-semibold text-foreground">
                      {lr.senderName || 'Anonymous'}
                    </TableCell>
                    <TableCell className="p-4 text-muted-foreground truncate max-w-[200px]">
                      {lr.subject}
                    </TableCell>
                    <TableCell className="p-4 text-muted-foreground">
                      {formatDate(lr.startDate)}
                    </TableCell>
                    <TableCell className="p-4 text-muted-foreground">
                      {formatDate(lr.endDate)}
                    </TableCell>
                    <TableCell className="p-4">
                      <Badge
                        variant={
                          lr.status === 'approved'
                            ? 'secondary'
                            : lr.status === 'rejected'
                            ? 'destructive'
                            : 'default'
                        }
                        className="capitalize"
                      >
                        {lr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLeave(lr)}
                        className="h-8 inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLeaves.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No leave requests found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedLeave} onOpenChange={() => setSelectedLeave(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-500" />
              Leave Details
            </DialogTitle>
            <DialogDescription>
              Submitted by {selectedLeave?.senderName || 'Faculty Member'}
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="grid gap-4 py-4 text-sm">
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Subject</span>
                <span className="col-span-2 text-foreground font-medium">{selectedLeave.subject}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Duration</span>
                <span className="col-span-2 text-foreground font-medium">
                  {formatDate(selectedLeave.startDate)} to {formatDate(selectedLeave.endDate)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Reason</span>
                <span className="col-span-2 text-foreground leading-relaxed whitespace-pre-wrap">{selectedLeave.reason}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Status</span>
                <span className="col-span-2">
                  <Badge
                    variant={
                      selectedLeave.status === 'approved'
                        ? 'secondary'
                        : selectedLeave.status === 'rejected'
                        ? 'destructive'
                        : 'default'
                    }
                    className="capitalize"
                  >
                    {selectedLeave.status}
                  </Badge>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pb-1 text-xs text-muted-foreground">
                <span>Submitted At</span>
                <span className="col-span-2">{formatDateTime(selectedLeave.createdAt)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedLeave(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
