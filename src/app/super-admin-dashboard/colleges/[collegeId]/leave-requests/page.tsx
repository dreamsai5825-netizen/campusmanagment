'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LeaveRequest, College } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileClock, Calendar, User, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function SuperAdminCollegeLeaveRequestsPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collegeId) return;

    // Fetch college
    const fetchCollege = async () => {
      try {
        const collegeSnap = await getDoc(doc(db, 'colleges', collegeId));
        if (collegeSnap.exists()) {
          setCollege({ id: collegeSnap.id, ...collegeSnap.data() } as College);
        }
      } catch (err) {
        console.error('Error fetching college:', err);
      }
    };
    fetchCollege();

    // Query leave requests
    const leaveQuery = query(
      collection(db, 'leaveRequests'),
      where('collegeId', '==', collegeId)
    );
    const unsub = onSnapshot(leaveQuery, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as LeaveRequest)
      );
      // Sort by creation date descending
      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setLeaveRequests(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to leave requests:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [collegeId]);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), { status });
      toast({
        title: 'Status Updated',
        description: `Leave request has been ${status}.`,
      });
    } catch (err) {
      console.error('Error updating leave request status:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update leave request status.',
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground">{college?.name || 'College'} / Faculty Operations</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FileClock className="h-6 w-6 text-rose-500" />
            Teacher Leave Requests
          </h1>
        </div>
      </div>

      {/* Main List */}
      <div className="grid gap-4">
        {leaveRequests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileClock className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No leave requests found</p>
              <p className="text-sm text-muted-foreground/75 mt-1">Teachers in this college have not filed any leave requests yet.</p>
            </CardContent>
          </Card>
        ) : (
          leaveRequests.map((request) => (
            <Card key={request.id} className="hover:border-primary/30 transition-all duration-300">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-foreground">
                      {request.subject}
                    </CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1.5 mt-1">
                      <User className="h-3.5 w-3.5" />
                      From: {request.senderName} ({request.senderType})
                    </CardDescription>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Duration: {request.startDate} to {request.endDate}</span>
                  </div>
                  {request.createdAt && (
                    <div className="flex items-center gap-1.5 border-l pl-4">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Filed on: {new Date(request.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reason for absence</span>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{request.reason}</p>
                </div>

                {request.status === 'pending' && (
                  <div className="flex items-center gap-2 pt-2 justify-end">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5 border-red-200"
                      onClick={() => handleUpdateStatus(request.id, 'rejected')}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      onClick={() => handleUpdateStatus(request.id, 'approved')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
