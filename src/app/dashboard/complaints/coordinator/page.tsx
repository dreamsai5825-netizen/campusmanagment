'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { collection, onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import type { Complaint } from '@/lib/types';

type ComplaintStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

const statusIcons: Record<ComplaintStatus, React.ComponentType<{ className?: string }>> = {
  'open': AlertCircle,
  'in-progress': Clock,
  'resolved': CheckCircle,
  'closed': XCircle,
};

const statusColors: Record<ComplaintStatus, string> = {
  'open': 'bg-red-100 text-red-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  'resolved': 'bg-green-100 text-green-800',
  'closed': 'bg-gray-100 text-gray-800',
};

const categoryColors: Record<string, string> = {
  academic: 'bg-blue-100 text-blue-800',
  bullying: 'bg-red-100 text-red-800',
  faculty: 'bg-purple-100 text-purple-800',
  facilities: 'bg-green-100 text-green-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function CoordinatorComplaintsPage() {
  const teacher = useCurrentTeacher();
  const { toast } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  // Check if teacher has coordinator role
  const isCoordinator = teacher?.roles?.includes('coordinator') ?? false;

  useEffect(() => {
    if (!teacher?.collegeId || !isCoordinator) {
      setComplaints([]);
      return;
    }

    // Load ALL complaints in the college (not just assigned ones)
    const unsubscribe = onSnapshot(
      query(collection(db, 'complaints'), where('collegeId', '==', teacher.collegeId)),
      (snapshot) => {
        const complaintsData = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as Complaint))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComplaints(complaintsData);
      }
    );

    return () => unsubscribe();
  }, [teacher?.collegeId, isCoordinator]);

  const filteredComplaints = complaints.filter((complaint) =>
    filterStatus === 'all' ? true : complaint.status === filterStatus
  );

  const handleOpenComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setResolution(complaint.resolution || '');
    setIsDetailDialogOpen(true);
  };

  const handleUpdateComplaint = async (newStatus: ComplaintStatus) => {
    if (!selectedComplaint) return;

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'resolved' || newStatus === 'closed') {
        updateData.resolvedAt = new Date().toISOString();
        updateData.resolution = resolution || selectedComplaint.resolution;
      }

      await updateDoc(doc(db, 'complaints', selectedComplaint.id), updateData);
      toast({
        title: 'Complaint Updated',
        description: `Status changed to ${newStatus}.`,
      });
      setIsDetailDialogOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update complaint.',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          Student Complaints
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Manage and resolve student complaints in your college.
        </p>
      </div>

      {!isCoordinator ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              You must have the coordinator role to view complaints. Contact your principal to assign this role.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="text-sm">
              Filter by Status:
            </Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger id="status-filter" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Complaints</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredComplaints.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No complaints found.</p>
                </CardContent>
              </Card>
            ) : (
              filteredComplaints.map((complaint) => {
                const StatusIcon = statusIcons[complaint.status as ComplaintStatus];
                return (
                  <Card
                    key={complaint.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleOpenComplaint(complaint)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{complaint.title}</CardTitle>
                          <CardDescription className="mt-1">
                            From {complaint.studentName} ({complaint.studentEmail})
                          </CardDescription>
                        </div>
                        <StatusIcon className={`h-5 w-5 mt-1`} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {complaint.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={categoryColors[complaint.category]}>
                          {complaint.category}
                        </Badge>
                        <Badge variant="outline">{complaint.status}</Badge>
                        <Badge variant="outline">
                          {new Date(complaint.createdAt).toLocaleDateString()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {isCoordinator && (
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedComplaint && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedComplaint.title}</DialogTitle>
                  <DialogDescription>
                    From {selectedComplaint.studentName} • {new Date(selectedComplaint.createdAt).toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Category</Label>
                    <Badge className={`mt-1 ${categoryColors[selectedComplaint.category]}`}>
                      {selectedComplaint.category}
                    </Badge>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Description</Label>
                    <p className="mt-2 p-3 bg-muted rounded-lg">{selectedComplaint.description}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <Select value={selectedComplaint.status} onValueChange={(value) => {
                      handleUpdateComplaint(value as ComplaintStatus);
                    }}>
                      <SelectTrigger className="w-full mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(selectedComplaint.status === 'resolved' || selectedComplaint.status === 'closed') && (
                    <div>
                      <Label htmlFor="resolution" className="text-sm text-muted-foreground">
                        Resolution
                      </Label>
                      <Textarea
                        id="resolution"
                        placeholder="Describe the resolution..."
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="mt-2"
                        rows={4}
                      />
                    </div>
                  )}

                  {selectedComplaint.resolvedAt && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Resolved At</Label>
                      <p className="mt-2">{new Date(selectedComplaint.resolvedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
