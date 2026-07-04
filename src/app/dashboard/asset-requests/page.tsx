'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc 
} from 'firebase/firestore';
import { ClipboardList, Calendar, Plus, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AssetRequest {
  id: string;
  collegeId: string;
  assetName: string;
  department: string;
  requestedBy: string;
  requestedById: string;
  quantity: number;
  status: 'pending' | 'accepted' | 'rejected';
  remarks?: string;
  tenureFrom?: string;
  tenureTo?: string;
  requestedAt: string;
}

export default function TeacherAssetRequestsPage() {
  const teacher = useCurrentTeacher();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [department, setDepartment] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!teacher?.id || !teacher?.collegeId) return;

    const q = query(
      collection(db, 'asset_requests'),
      where('collegeId', '==', teacher.collegeId),
      where('requestedById', '==', teacher.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AssetRequest[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AssetRequest));

      // Sort newest first
      list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      setRequests(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teacher?.id, teacher?.collegeId]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher?.collegeId || !teacher?.id) return;
    if (!assetName.trim() || !department.trim() || quantity < 1) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'asset_requests'), {
        collegeId: teacher.collegeId,
        assetName: assetName.trim(),
        department: department.trim(),
        requestedBy: teacher.name || 'Teacher',
        requestedById: teacher.id,
        requestedByRole: 'teacher',
        quantity,
        status: 'pending',
        remarks: remarks.trim() || undefined,
        requestedAt: new Date().toISOString(),
      });

      toast({
        title: 'Request Submitted',
        description: `Successfully submitted request for "${assetName}".`,
      });

      // Clear fields and close
      setAssetName('');
      setDepartment('');
      setQuantity(1);
      setRemarks('');
      setCreateOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit request.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold font-headline tracking-tight flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-sky-500" />
            Asset Requests
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Submit equipment or classroom requests to the College Administrator.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
              <Plus className="h-4.5 w-4.5" />
              New Asset Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreateRequest}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-sky-500" />
                  Submit Asset Request
                </DialogTitle>
                <DialogDescription>
                  Enter details of the equipment or asset needed.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-sm">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Asset Name *</label>
                  <Input 
                    placeholder="e.g. Projector, Whiteboard, Lab Kit" 
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Department *</label>
                    <Input 
                      placeholder="e.g. Computer Science, Science, English" 
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Quantity *</label>
                    <Input 
                      type="number" 
                      min={1} 
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Justification / Reason (Optional)</label>
                  <Textarea 
                    placeholder="Explain why this equipment is needed..." 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-sm mt-4">Loading your requests...</p>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg">No Sent Requests</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              You haven't submitted any asset requests to the administrator yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {requests.map((req) => (
            <Card key={req.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground">{req.assetName}</h3>
                      <Badge variant="outline" className="bg-primary/5 text-primary text-xs border-primary/20">
                        Qty: {req.quantity}
                      </Badge>
                      <Badge 
                        variant={
                          req.status === 'accepted' 
                            ? 'secondary' 
                            : req.status === 'rejected' 
                            ? 'destructive' 
                            : 'default'
                        }
                        className="capitalize"
                      >
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Submitted to Administrator · Dept: {req.department}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 sm:self-start">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(req.requestedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {req.remarks && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    <strong>Justification:</strong> {req.remarks}
                  </p>
                )}

                {req.status === 'accepted' && req.tenureFrom && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-sm">
                    Approved Allocation: <strong>{new Date(req.tenureFrom).toLocaleDateString()}</strong> to <strong>{new Date(req.tenureTo || '').toLocaleDateString()}</strong>
                  </div>
                )}

                {req.status === 'rejected' && req.remarks && (
                  <div className="p-3 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20 text-sm">
                    Rejection remarks from administrator: <em>"{req.remarks}"</em>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
