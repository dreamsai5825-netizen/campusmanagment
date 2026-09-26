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
import { Calendar, Search, Eye, FileText, Check, X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { LeaveRequest } from '@/lib/types';
import { approveLeaveRequest, rejectLeaveRequest } from '@/lib/leave-service';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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

  const handleApprove = async (lr: LeaveRequest) => {
    setActionLoadingId(lr.id);
    try {
      const res = await approveLeaveRequest(lr, principal?.name || 'College Admin');
      toast({
        title: 'Leave Approved',
        description: res.message,
      });
      if (selectedLeave?.id === lr.id) {
        setSelectedLeave((prev) => (prev ? { ...prev, status: 'approved' } : null));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve leave request.';
      toast({ variant: 'destructive', title: 'Approval Failed', description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (lr: LeaveRequest) => {
    setActionLoadingId(lr.id);
    try {
      const res = await rejectLeaveRequest(lr, principal?.name || 'College Admin');
      toast({
        title: 'Leave Rejected',
        description: res.message,
      });
      if (selectedLeave?.id === lr.id) {
        setSelectedLeave((prev) => (prev ? { ...prev, status: 'rejected' } : null));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject leave request.';
      toast({ variant: 'destructive', title: 'Rejection Failed', description: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredLeaves = React.useMemo(() => {
    return leaveRequests.filter((lr) => {
      const matchesSearch =
        (lr.senderName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lr.leaveType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lr.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lr.reason || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === 'all' || lr.status === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [leaveRequests, searchQuery, activeTab]);

  const pendingCount = React.useMemo(() => {
    return leaveRequests.filter((lr) => lr.status === 'pending').length;
  }, [leaveRequests]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
            <Calendar className="h-7 w-7 text-sky-500 shrink-0" />
            Leave Requests & Automation
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Review, approve, or reject faculty leave requests. Approvals automatically deduct from the teacher&apos;s quota balance.
          </p>
        </div>

        {pendingCount > 0 && (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 self-start sm:self-auto py-1 px-3 text-xs font-semibold">
            {pendingCount} Pending Request{pendingCount > 1 ? 's' : ''}
          </Badge>
        )}
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
                  className="capitalize font-medium text-xs sm:text-sm"
                >
                  {tab}
                  {tab === 'pending' && pendingCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leaves or faculty..."
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
            <Table className="min-w-[850px] w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="p-4">Faculty Member</TableHead>
                  <TableHead className="p-4">Leave Type & Subject</TableHead>
                  <TableHead className="p-4">Dates & Duration</TableHead>
                  <TableHead className="p-4">Status</TableHead>
                  <TableHead className="p-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaves.map((lr) => {
                  const isProcessing = actionLoadingId === lr.id;
                  return (
                    <TableRow key={lr.id} className="hover:bg-muted/30">
                      <TableCell className="p-4">
                        <div className="font-semibold text-foreground">
                          {lr.senderName || 'Anonymous'}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Submitted: {formatDate(lr.createdAt)}
                        </span>
                      </TableCell>

                      <TableCell className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 text-xs font-semibold"
                          >
                            {lr.leaveType || 'Casual Leave (CL)'}
                          </Badge>
                          {lr.isHalfDay && (
                            <Badge variant="secondary" className="text-[10px]">
                              {lr.halfDaySession || 'Half Day'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-medium text-muted-foreground mt-1 truncate max-w-[240px]">
                          {lr.subject}
                        </p>
                      </TableCell>

                      <TableCell className="p-4">
                        <div className="text-xs font-medium text-foreground">
                          {lr.startDate === lr.endDate
                            ? formatDate(lr.startDate)
                            : `${formatDate(lr.startDate)} – ${formatDate(lr.endDate)}`}
                        </div>
                        <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                          {lr.duration ?? (lr.isHalfDay ? 0.5 : 1.0)} Day(s)
                        </span>
                      </TableCell>

                      <TableCell className="p-4">
                        <Badge
                          variant={
                            lr.status === 'approved'
                              ? 'secondary'
                              : lr.status === 'rejected'
                              ? 'destructive'
                              : 'outline'
                          }
                          className={`capitalize text-xs font-semibold ${
                            lr.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                              : lr.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                              : ''
                          }`}
                        >
                          {lr.status === 'approved' ? 'Approved & Deducted' : lr.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lr.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleApprove(lr)}
                                className="h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 gap-1 text-xs"
                                title="Approve and deduct quota"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                )}
                                Approve
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isProcessing}
                                onClick={() => handleReject(lr)}
                                className="h-8 border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 gap-1 text-xs"
                                title="Reject leave request"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5 text-rose-600" />
                                )}
                                Reject
                              </Button>
                            </>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLeave(lr)}
                            className="h-8 inline-flex items-center gap-1.5 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredLeaves.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
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
              Leave Request Details
            </DialogTitle>
            <DialogDescription>
              Submitted by {selectedLeave?.senderName || 'Faculty Member'}
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="grid gap-4 py-4 text-sm">
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Faculty</span>
                <span className="col-span-2 text-foreground font-medium">
                  {selectedLeave.senderName}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Leave Type</span>
                <span className="col-span-2">
                  <Badge
                    variant="outline"
                    className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 text-xs font-semibold"
                  >
                    {selectedLeave.leaveType || 'Casual Leave (CL)'}
                  </Badge>
                  {selectedLeave.isHalfDay && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({selectedLeave.halfDaySession || 'Half Day'})
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Subject</span>
                <span className="col-span-2 text-foreground font-medium">
                  {selectedLeave.subject}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Dates & Total</span>
                <span className="col-span-2 text-foreground font-medium">
                  {formatDate(selectedLeave.startDate)} to {formatDate(selectedLeave.endDate)}{' '}
                  <span className="text-sky-600 font-bold">
                    ({selectedLeave.duration ?? (selectedLeave.isHalfDay ? 0.5 : 1.0)} Day(s))
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b pb-2">
                <span className="font-semibold text-muted-foreground">Reason</span>
                <span className="col-span-2 text-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedLeave.reason}
                </span>
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
                        : 'outline'
                    }
                    className={`capitalize ${
                      selectedLeave.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        : selectedLeave.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : ''
                    }`}
                  >
                    {selectedLeave.status === 'approved' ? 'Approved & Deducted' : selectedLeave.status}
                  </Badge>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pb-1 text-xs text-muted-foreground">
                <span>Submitted At</span>
                <span className="col-span-2">{formatDateTime(selectedLeave.createdAt)}</span>
              </div>
              {selectedLeave.approvedAt && (
                <div className="grid grid-cols-3 gap-2 pb-1 text-xs text-emerald-600">
                  <span>Approved At</span>
                  <span className="col-span-2">
                    {formatDateTime(selectedLeave.approvedAt)} by {selectedLeave.approvedBy || 'Admin'}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {selectedLeave?.status === 'pending' && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => selectedLeave && handleReject(selectedLeave)}
                  disabled={actionLoadingId === selectedLeave?.id}
                  className="flex-1 sm:flex-none border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Reject
                </Button>
                <Button
                  onClick={() => selectedLeave && handleApprove(selectedLeave)}
                  disabled={actionLoadingId === selectedLeave?.id}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Approve & Deduct
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={() => setSelectedLeave(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
