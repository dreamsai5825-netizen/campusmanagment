'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ReportIssue, College } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MessageSquare, Calendar, User, FileText, CheckCircle, AlertCircle, Eye } from 'lucide-react';

export default function SuperAdminCollegeReportedIssuesPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [issues, setIssues] = useState<ReportIssue[]>([]);
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

    // Query reported issues
    const issuesQuery = query(
      collection(db, 'reportIssues'),
      where('collegeId', '==', collegeId)
    );
    const unsub = onSnapshot(issuesQuery, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ReportIssue)
      );
      // Sort by creation date descending
      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      setIssues(list);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to reported issues:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [collegeId]);

  const handleUpdateStatus = async (id: string, status: 'open' | 'acknowledged' | 'resolved') => {
    try {
      await updateDoc(doc(db, 'reportIssues', id), { status });
      toast({
        title: 'Status Updated',
        description: `Issue status changed to ${status}.`,
      });
    } catch (err) {
      console.error('Error updating reported issue status:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update issue status.',
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
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Resolved</Badge>;
      case 'acknowledged':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Acknowledged</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Open</Badge>;
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
          <div className="text-sm text-muted-foreground">{college?.name || 'College'} / Operational Queries</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-violet-500" />
            Reported Issues
          </h1>
        </div>
      </div>

      {/* Main List */}
      <div className="grid gap-4">
        {issues.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No reported issues found</p>
              <p className="text-sm text-muted-foreground/75 mt-1">No staff members or students have reported any technical or facility issues yet.</p>
            </CardContent>
          </Card>
        ) : (
          issues.map((issue) => (
            <Card key={issue.id} className="hover:border-primary/30 transition-all duration-300">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-foreground">
                      {issue.title}
                    </CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1.5 mt-1">
                      <User className="h-3.5 w-3.5" />
                      From: {issue.senderName} ({issue.senderType})
                    </CardDescription>
                  </div>
                  {getStatusBadge(issue.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {issue.createdAt && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 p-2 px-3 rounded-lg border">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Reported on: {new Date(issue.createdAt).toLocaleString()}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</span>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{issue.content}</p>
                </div>

                <div className="flex items-center gap-2 pt-2 justify-end">
                  {issue.status === 'open' && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-1.5 border-blue-200"
                      onClick={() => handleUpdateStatus(issue.id, 'acknowledged')}
                    >
                      <Eye className="h-4 w-4" />
                      Acknowledge
                    </Button>
                  )}
                  {issue.status !== 'resolved' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                      onClick={() => handleUpdateStatus(issue.id, 'resolved')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Resolve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
