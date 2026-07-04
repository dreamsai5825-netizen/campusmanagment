'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { db } from '@/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc 
} from 'firebase/firestore';
import { MessageSquare, Wrench, Boxes, Calendar, DollarSign, Send, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManagementRequest {
  id: string;
  collegeId: string;
  type: 'maintenance' | 'procurement';
  assetName: string;
  description: string;
  estimatedCost: number;
  priority: 'Low' | 'Medium' | 'High';
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  requestedAt: string;
}

export default function RequestManagementPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ManagementRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [type, setType] = useState<'maintenance' | 'procurement'>('maintenance');
  const [assetName, setAssetName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const q = query(
      collection(db, 'management_requests'),
      where('collegeId', '==', principal.collegeId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: ManagementRequest[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ManagementRequest));

      // Auto-seed default requests if empty
      if (list.length === 0 && !snapshot.metadata.fromCache) {
        setLoading(true);
        const defaults = [
          {
            collegeId: principal.collegeId,
            type: 'maintenance' as const,
            assetName: 'Server Room APC UPS Symmetra',
            description: 'Critical battery degradation and voltage warning. Needs immediate battery module replacement.',
            estimatedCost: 1200,
            priority: 'High' as const,
            status: 'pending' as const,
            requestedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          },
          {
            collegeId: principal.collegeId,
            type: 'procurement' as const,
            assetName: '10x Dell Latitude Laptops',
            description: 'Required for expansion of the physics simulation software laboratory and faculty usage.',
            estimatedCost: 8500,
            priority: 'Medium' as const,
            status: 'approved' as const,
            remarks: 'Approved. Procurement department notified to purchase.',
            requestedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
          }
        ];
        try {
          for (const req of defaults) {
            await addDoc(collection(db, 'management_requests'), req);
          }
        } catch (e) {
          console.error("Error seeding management requests:", e);
        }
      } else {
        list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        setRequests(list);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [principal?.collegeId]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.collegeId) return;

    if (!assetName.trim() || !description.trim() || !estimatedCost.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'All fields are required.',
      });
      return;
    }

    const costNum = parseFloat(estimatedCost);
    if (isNaN(costNum) || costNum < 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Estimated cost must be a positive number.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'management_requests'), {
        collegeId: principal.collegeId,
        type,
        assetName: assetName.trim(),
        description: description.trim(),
        estimatedCost: costNum,
        priority,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      toast({
        title: 'Request Sent',
        description: 'Your request has been successfully submitted to college management.',
      });

      // Reset
      setAssetName('');
      setDescription('');
      setEstimatedCost('');
      setPriority('Medium');
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
          Request Management
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Submit requests to College Admin / Management for maintenance service or procuring new equipment.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 items-start">
        {/* Request Form */}
        <Card className="lg:col-span-2 border border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">New Management Request</CardTitle>
            <CardDescription>Fill in the details for procurement or maintenance.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Request Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={type === 'maintenance' ? 'default' : 'outline'}
                    onClick={() => setType('maintenance')}
                    className="w-full"
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    Maintenance
                  </Button>
                  <Button
                    type="button"
                    variant={type === 'procurement' ? 'default' : 'outline'}
                    onClick={() => setType('procurement')}
                    className="w-full"
                  >
                    <Boxes className="mr-2 h-4 w-4" />
                    Procurement
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Name / Title</label>
                <Input 
                  placeholder="e.g. Physics Lab Projector, CS Server"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Detailed Description / Justification</label>
                <Textarea 
                  placeholder="Provide full description, reasons for request, or error/fault specifications..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimated Cost ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="number"
                      placeholder="e.g. 500"
                      className="pl-8"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select 
                    value={priority} 
                    onValueChange={(val: any) => setPriority(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md pt-2">
                <Send className="mr-2 h-4 w-4" />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Request History */}
        <Card className="lg:col-span-3 border border-border/80 shadow-sm overflow-hidden h-full flex flex-col">
          <CardHeader className="pb-4 bg-muted/20 border-b border-border/60">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Request Pipeline & History
            </CardTitle>
            <CardDescription className="text-xs">Real-time status updates from College Management.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-y-auto max-h-[600px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground text-sm mt-3">Loading pipeline history...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/60 mb-3" />
                <h3 className="font-bold text-base text-foreground">No Request Pipeline</h3>
                <p className="text-muted-foreground text-xs max-w-xs mt-1">
                  Submit a request in the form to start tracking management communications.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {requests.map((request) => (
                  <div key={request.id} className="p-5 flex flex-col gap-3 hover:bg-muted/15 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground">{request.assetName}</span>
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 capitalize font-medium">
                            {request.type}
                          </Badge>
                          <Badge className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            request.priority === 'High' ? 'bg-red-500/10 text-red-500' :
                            request.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-slate-500/10 text-slate-500'
                          }`}>
                            {request.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Requested on {new Date(request.requestedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <Badge className={
                        request.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        request.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }>
                        {request.status.toUpperCase()}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{request.description}</p>
                    
                    <div className="flex justify-between items-center text-sm font-semibold text-foreground">
                      <span>Estimated Cost: <span className="text-primary">${request.estimatedCost.toLocaleString()}</span></span>
                    </div>

                    {request.remarks && (
                      <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                        <span className="font-bold text-foreground block mb-0.5">Management Feedback:</span>
                        <span className="text-muted-foreground">{request.remarks}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
