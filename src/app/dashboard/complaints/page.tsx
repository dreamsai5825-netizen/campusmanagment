'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentStudent } from '@/hooks/use-current-user';
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

export default function StudentComplaintsPage() {
  const student = useCurrentStudent();
  const { toast } = useToast();
  const router = useRouter();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'academic',
  });

  useEffect(() => {
    if (!student?.id) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'complaints'), where('studentId', '==', student.id)),
      (snapshot) => {
        const complaintsData = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as Complaint))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComplaints(complaintsData);
      }
    );

    return () => unsubscribe();
  }, [student?.id]);

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Student not loaded.',
      });
      return;
    }

    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        classId: student.classId,
        collegeId: student.collegeId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        status: 'open',
        createdAt: serverTimestamp(),
      });

      toast({
        title: 'Complaint Submitted',
        description: 'Your complaint has been submitted successfully.',
      });

      setFormData({
        title: '',
        description: '',
        category: 'academic',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit complaint.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          Submit a Complaint
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          File a complaint or grievance. Your concerns will be reviewed by the administration.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>New Complaint</CardTitle>
              <CardDescription>
                Describe your issue in detail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitComplaint} className="space-y-4">
                <div>
                  <Label htmlFor="title">Subject *</Label>
                  <Input
                    id="title"
                    placeholder="Brief subject of your complaint"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="bullying">Bullying</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="facilities">Facilities</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Please provide detailed information about your complaint"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    required
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Complaint'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Complaints</CardTitle>
            </CardHeader>
            <CardContent>
              {complaints.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No complaints submitted yet
                </p>
              ) : (
                <div className="space-y-3">
                  {complaints.map((complaint) => {
                    const StatusIcon = statusIcons[complaint.status as ComplaintStatus];
                    return (
                      <div key={complaint.id} className="p-3 rounded-lg border">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{complaint.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(complaint.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <StatusIcon className={`h-4 w-4 shrink-0 mt-0.5`} />
                        </div>
                        <Badge className={`mt-2 text-xs ${statusColors[complaint.status as ComplaintStatus]}`}>
                          {complaint.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
