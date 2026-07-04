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
  DialogTitle 
} from '@/components/ui/dialog';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  addDoc 
} from 'firebase/firestore';
import { ClipboardList, Calendar, User, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AssetRequest {
  id: string;
  collegeId: string;
  assetName: string;
  department: string;
  requestedBy: string;
  quantity: number;
  status: 'pending' | 'accepted' | 'rejected';
  remarks?: string;
  tenureFrom?: string;
  tenureTo?: string;
  requestedAt: string;
}

export default function CollegeAdminAssetRequestsPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [actionRequest, setActionRequest] = useState<AssetRequest | null>(null);
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);
  const [tenureFrom, setTenureFrom] = useState('');
  const [tenureTo, setTenureTo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const q = query(
      collection(db, 'asset_requests'),
      where('collegeId', '==', principal.collegeId)
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
  }, [principal?.collegeId]);

  const handleOpenDialog = (request: AssetRequest, type: 'accept' | 'reject') => {
    setActionRequest(request);
    setActionType(type);
    setTenureFrom(type === 'accept' ? new Date().toISOString().split('T')[0] : '');
    setTenureTo(type === 'accept' ? new Date(Date.now() + 30 * 24 * 3600000).toISOString().split('T')[0] : '');
    setRemarks('');
  };

  const handleCloseDialog = () => {
    setActionRequest(null);
    setActionType(null);
    setTenureFrom('');
    setTenureTo('');
    setRemarks('');
  };

  const handleSubmitDecision = async () => {
    if (!actionRequest || !actionType) return;

    if (actionType === 'accept' && (!tenureFrom || !tenureTo)) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please specify both Tenure From and Tenure To dates.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const docRef = doc(db, 'asset_requests', actionRequest.id);
      await updateDoc(docRef, {
        status: actionType === 'accept' ? 'accepted' : 'rejected',
        tenureFrom: actionType === 'accept' ? tenureFrom : null,
        tenureTo: actionType === 'accept' ? tenureTo : null,
        remarks: remarks || 'Processed by College Admin'
      });

      toast({
        title: `Request ${actionType === 'accept' ? 'Accepted' : 'Rejected'}`,
        description: `Successfully processed request for "${actionRequest.assetName}".`,
      });

      handleCloseDialog();
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update the request status.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold font-headline tracking-tight flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-sky-500" />
          Asset Requests Module
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Review, approve, or reject equipment requests made by principals and staff.
        </p>
      </div>

      {loading ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-sm mt-4">Loading asset requests...</p>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-lg">No Requests Found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              No staff members or principals have submitted asset requests yet.
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
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Requested by <strong className="text-foreground">{req.requestedBy}</strong> ({req.department})
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 sm:self-start">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(req.requestedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {req.status === 'accepted' && req.tenureFrom && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-sm flex flex-col gap-1 sm:flex-row sm:items-center justify-between">
                    <span>
                      Approved Tenure: <strong>{new Date(req.tenureFrom).toLocaleDateString()}</strong> to <strong>{new Date(req.tenureTo || '').toLocaleDateString()}</strong>
                    </span>
                    {req.remarks && <span className="text-xs italic opacity-90">"{req.remarks}"</span>}
                  </div>
                )}

                {req.status === 'rejected' && req.remarks && (
                  <div className="p-3 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20 text-sm flex items-center gap-1">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>Reason: <em>"{req.remarks}"</em></span>
                  </div>
                )}

                {req.status === 'pending' && (
                  <div className="flex gap-2 justify-end pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => handleOpenDialog(req, 'reject')}
                      className="text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button 
                      onClick={() => handleOpenDialog(req, 'accept')}
                      className="inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Accept & Assign
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Accept / Reject Dialog */}
      <Dialog open={!!actionRequest} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-500" />
              {actionType === 'accept' ? 'Approve & Allocate Asset' : 'Reject Asset Request'}
            </DialogTitle>
            <DialogDescription>
              Submit your decision for "{actionRequest?.assetName}" requested by {actionRequest?.requestedBy}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            {actionType === 'accept' ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Tenure From</label>
                    <Input 
                      type="date" 
                      value={tenureFrom} 
                      onChange={(e) => setTenureFrom(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Tenure To</label>
                    <Input 
                      type="date" 
                      value={tenureTo} 
                      onChange={(e) => setTenureTo(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Approval Remarks</label>
                  <Textarea 
                    placeholder="Enter approval details, serial numbers, or notes..." 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Rejection Reason</label>
                <Textarea 
                  placeholder="Explain why this request is being rejected..." 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitDecision} disabled={submitting}>
              {submitting ? 'Processing...' : 'Submit Decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
