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

export default function AssetRequestsPage() {
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

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: AssetRequest[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AssetRequest));

      // Auto-seed if empty
      if (list.length === 0 && !snapshot.metadata.fromCache) {
        setLoading(true);
        const mockRequests = [
          {
            collegeId: principal.collegeId,
            assetName: 'Lab Projector #12',
            department: 'Physics Department',
            requestedBy: 'Dr. Sarah Jenkins',
            quantity: 1,
            status: 'pending' as const,
            requestedAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            collegeId: principal.collegeId,
            assetName: 'Dell Latitude 5420 Laptops',
            department: 'Computer Science',
            requestedBy: 'Prof. Severus Snape',
            quantity: 3,
            status: 'pending' as const,
            requestedAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            collegeId: principal.collegeId,
            assetName: 'Chemistry Lab Glassware Kit',
            department: 'Chemistry Department',
            requestedBy: 'Prof. Albus Dumbledore',
            quantity: 2,
            status: 'pending' as const,
            requestedAt: new Date(Date.now() - 86400000).toISOString(),
          }
        ];

        try {
          for (const req of mockRequests) {
            await addDoc(collection(db, 'asset_requests'), req);
          }
        } catch (e) {
          console.error("Failed to seed requests:", e);
        }
      } else {
        // Sort newest first
        list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        setRequests(list);
        setLoading(false);
      }
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
        remarks: remarks || 'Processed by Asset Manager'
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
        <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
          Departmental Asset Requests
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Review, approve, or reject equipment requests made by institutional departments.
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
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-bold text-lg">No Requests Found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              There are no pending or history asset requests for your campus.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {requests.map((request) => (
            <Card key={request.id} className="overflow-hidden border border-border/80 shadow-sm transition-all hover:shadow-md">
              <div className="grid md:grid-cols-4 items-stretch">
                {/* Details Column */}
                <div className="md:col-span-3 p-6 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-foreground">{request.assetName}</span>
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        Qty: {request.quantity}
                      </Badge>
                      <Badge className={
                        request.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        request.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }>
                        {request.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-primary" />
                        <span>Requested by: <strong className="text-foreground">{request.requestedBy}</strong> ({request.department})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-primary" />
                        <span>Date: {new Date(request.requestedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {request.status !== 'pending' && (
                      <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2 mt-2">
                        {request.status === 'accepted' && (
                          <div className="text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Approved Tenure: {request.tenureFrom} to {request.tenureTo}</span>
                          </div>
                        )}
                        {request.status === 'rejected' && (
                          <div className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
                            <XCircle className="h-4 w-4 shrink-0" />
                            <span>Request Rejected</span>
                          </div>
                        )}
                        <div className="text-sm flex items-start gap-2 text-muted-foreground">
                          <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>Remarks: {request.remarks || 'No remarks provided.'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Column */}
                <div className="bg-muted/15 border-t md:border-t-0 md:border-l border-border/80 p-6 flex flex-col justify-center gap-3">
                  {request.status === 'pending' ? (
                    <>
                      <Button 
                        onClick={() => handleOpenDialog(request, 'accept')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Accept Request
                      </Button>
                      <Button 
                        onClick={() => handleOpenDialog(request, 'reject')}
                        variant="destructive"
                        className="w-full shadow-sm"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject Request
                      </Button>
                    </>
                  ) : (
                    <div className="text-center text-xs text-muted-foreground py-4 flex flex-col items-center gap-1.5 justify-center">
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      <span>This request has been processed.</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Decision Dialog */}
      <Dialog open={!!actionRequest} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'accept' ? 'Accept Asset Request' : 'Reject Asset Request'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'accept' 
                ? 'Specify the tenure period and any remarks for allocating this asset.' 
                : 'Provide comments or remarks stating the reason for rejection.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <span className="text-sm font-semibold text-muted-foreground">Asset Name</span>
              <p className="font-bold text-foreground">{actionRequest?.assetName} (Qty: {actionRequest?.quantity})</p>
            </div>

            {actionType === 'accept' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tenure From</label>
                  <Input 
                    type="date" 
                    value={tenureFrom} 
                    onChange={(e) => setTenureFrom(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tenure To</label>
                  <Input 
                    type="date" 
                    value={tenureTo} 
                    onChange={(e) => setTenureTo(e.target.value)} 
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Remarks / Comments</label>
              <Textarea 
                placeholder="Enter comments, allocation details, serial numbers, or reason for rejection..." 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitDecision} 
              disabled={submitting}
              className={actionType === 'accept' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
            >
              {submitting ? 'Processing...' : actionType === 'accept' ? 'Confirm Accept' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
