'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Complaint, College, Teacher } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ArrowLeft, AlertCircle, Clock, CheckCircle, XCircle, AlertOctagon, Calendar, User, FileText } from 'lucide-react';

type ComplaintStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

const statusIcons: Record<ComplaintStatus, React.ComponentType<{ className?: string }>> = {
  'open': AlertCircle,
  'in-progress': Clock,
  'resolved': CheckCircle,
  'closed': XCircle,
};

const statusColors: Record<ComplaintStatus, string> = {
  'open': 'text-red-500 bg-red-100',
  'in-progress': 'text-yellow-600 bg-yellow-100',
  'resolved': 'text-green-600 bg-green-100',
  'closed': 'text-gray-500 bg-gray-100',
};

const categoryColors: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-800 border-blue-200',
  bullying: 'bg-red-100 text-red-800 border-red-200',
  faculty: 'bg-purple-100 text-purple-800 border-purple-200',
  facilities: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function SuperAdminCollegeComplaintsPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [assignedCoordinator, setAssignedCoordinator] = useState<string>('');

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

    // Query complaints
    const complaintsQuery = query(
      collection(db, 'complaints'),
      where('collegeId', '==', collegeId)
    );
    const unsubComplaints = onSnapshot(complaintsQuery, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Complaint)
      );
      // Sort by creation date descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setComplaints(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching complaints:', err);
      setLoading(false);
    });

    // Query teachers for coordinator selection
    const teachersQuery = query(
      collection(db, 'teachers'),
      where('collegeId', '==', collegeId)
    );
    const unsubTeachers = onSnapshot(teachersQuery, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Teacher)
      );
      setTeachers(list);
    }, (err) => {
      console.error('Error fetching teachers:', err);
    });

    return () => {
      unsubComplaints();
      unsubTeachers();
    };
  }, [collegeId]);

  const handleOpenComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setResolution(complaint.resolution || '');
    setAssignedCoordinator(complaint.coordinatorId || '');
    setIsDetailDialogOpen(true);
  };

  const handleAssignCoordinator = async (coordinatorId: string) => {
    if (!selectedComplaint) return;
    try {
      setAssignedCoordinator(coordinatorId);
      await updateDoc(doc(db, 'complaints', selectedComplaint.id), {
        coordinatorId: coordinatorId,
      });
      toast({
        title: 'Coordinator Assigned',
        description: 'Designated faculty member has been assigned to coordinate this complaint.',
      });
    } catch (error) {
      console.error('Error assigning coordinator:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to assign coordinator.',
      });
    }
  };

  const handleUpdateComplaintStatus = async (newStatus: ComplaintStatus) => {
    if (!selectedComplaint) return;
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'resolved' || newStatus === 'closed') {
        updateData.resolvedAt = new Date().toISOString();
        updateData.resolution = resolution;
      }
      if (newStatus === 'in-progress' && assignedCoordinator) {
        updateData.coordinatorId = assignedCoordinator;
      }

      await updateDoc(doc(db, 'complaints', selectedComplaint.id), updateData);
      toast({
        title: 'Status Updated',
        description: `Grievance status changed to ${newStatus}.`,
      });
      setIsDetailDialogOpen(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update complaint status.',
      });
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    return filterStatus === 'all' ? true : c.status === filterStatus;
  });

  const teacherMap = React.useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach(t => map.set(t.id, t.name));
    return map;
  }, [teachers]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-sm text-muted-foreground">{college?.name || 'College'} / Grievance Operations</div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <AlertOctagon className="h-6 w-6 text-red-500" />
              Student Complaints
            </h1>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="text-xs font-semibold text-muted-foreground uppercase shrink-0">
            Status:
          </Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger id="status-filter" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main List */}
      <div className="grid gap-4">
        {filteredComplaints.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertOctagon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No complaints found</p>
              <p className="text-sm text-muted-foreground/75 mt-1">There are no complaints matches with active filters.</p>
            </CardContent>
          </Card>
        ) : (
          filteredComplaints.map((complaint) => {
            const StatusIcon = statusIcons[complaint.status as ComplaintStatus] || AlertCircle;
            const statusColor = statusColors[complaint.status as ComplaintStatus] || 'text-gray-500 bg-gray-100';

            return (
              <Card
                key={complaint.id}
                className="cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-300"
                onClick={() => handleOpenComplaint(complaint)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-bold text-foreground leading-tight hover:text-primary transition-colors">
                        {complaint.title}
                      </CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        From {complaint.studentName} ({complaint.studentEmail})
                      </CardDescription>
                    </div>
                    <div className={`p-2 rounded-xl flex items-center gap-1.5 ${statusColor}`}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">{complaint.status}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {complaint.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className={categoryColors[complaint.category] || 'bg-gray-100 text-gray-800'}>
                      {complaint.category}
                    </Badge>
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <Calendar className="h-3.5 w-3.5" />
                      Filed: {new Date(complaint.createdAt).toLocaleDateString()}
                    </span>
                    {complaint.coordinatorId && (
                      <span className="text-muted-foreground flex items-center gap-1 text-[11px] border-l pl-2">
                        <User className="h-3.5 w-3.5" />
                        Assigned: {teacherMap.get(complaint.coordinatorId) || 'Faculty'}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedComplaint && (
            <>
              <DialogHeader className="border-b pb-4">
                <div className="flex items-center justify-between pr-4 mt-2">
                  <Badge variant="outline" className={categoryColors[selectedComplaint.category]}>
                    {selectedComplaint.category.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(selectedComplaint.createdAt).toLocaleString()}
                  </span>
                </div>
                <DialogTitle className="text-xl font-bold font-headline mt-3">{selectedComplaint.title}</DialogTitle>
                <DialogDescription className="text-xs flex items-center gap-1.5 mt-1">
                  <User className="h-4 w-4" />
                  Filed by: {selectedComplaint.studentName} ({selectedComplaint.studentEmail})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                {/* Description */}
                <div>
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Complaint Details</Label>
                  <div className="mt-1.5 p-4 bg-muted/50 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border">
                    {selectedComplaint.description}
                  </div>
                </div>

                {/* Attachment */}
                {selectedComplaint.attachmentUrl && (
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Attached Document / Image</Label>
                    <div className="mt-1.5">
                      <a
                        href={selectedComplaint.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 p-2 px-3 border rounded-xl bg-card text-xs text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        <span>{selectedComplaint.attachmentName || 'View Attachment'}</span>
                      </a>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                  {/* Status Control */}
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Grievance Status</Label>
                    <Select
                      value={selectedComplaint.status}
                      onValueChange={(val) => handleUpdateComplaintStatus(val as ComplaintStatus)}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Coordinator Assignment */}
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assign Coordinator (Faculty)</Label>
                    <Select
                      value={assignedCoordinator}
                      onValueChange={handleAssignCoordinator}
                      disabled={selectedComplaint.status === 'resolved' || selectedComplaint.status === 'closed'}
                    >
                      <SelectTrigger className="w-full mt-1.5">
                        <SelectValue placeholder="Assign coordinator..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Resolution Field (for Resolved or Closed status) */}
                {(selectedComplaint.status === 'resolved' || selectedComplaint.status === 'closed') && (
                  <div className="pt-2 border-t">
                    <Label htmlFor="resolution" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Resolution Remarks
                    </Label>
                    <Textarea
                      id="resolution"
                      placeholder="Describe the investigation results, action taken, and final resolution..."
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="mt-1.5 text-sm"
                      rows={4}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateComplaintStatus(selectedComplaint.status as ComplaintStatus)}
                      >
                        Save Resolution
                      </Button>
                    </div>
                  </div>
                )}

                {selectedComplaint.resolvedAt && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Resolved/Closed at: {new Date(selectedComplaint.resolvedAt).toLocaleString()}
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
