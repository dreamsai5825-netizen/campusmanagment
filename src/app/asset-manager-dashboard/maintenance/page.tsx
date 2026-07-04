'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
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
import { Wrench, PlusCircle, Calendar, DollarSign, Send, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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

export default function MaintenancePage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ManagementRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State: Add Maintenance Request
  const [isAddMaintOpen, setIsAddMaintOpen] = useState(false);
  
  // Form State
  const [assetName, setAssetName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const q = query(
      collection(db, 'management_requests'),
      where('collegeId', '==', principal.collegeId),
      where('type', '==', 'maintenance')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ManagementRequest[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ManagementRequest));

      list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      setRequests(list);
      setLoading(false);
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
        type: 'maintenance',
        assetName: assetName.trim(),
        description: description.trim(),
        estimatedCost: costNum,
        priority,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      toast({
        title: 'Maintenance Logged',
        description: `Successfully requested maintenance for "${assetName}".`,
      });

      // Reset
      setAssetName('');
      setDescription('');
      setEstimatedCost('');
      setPriority('Medium');
      setIsAddMaintOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to log maintenance request.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Maintenance & Inspections
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Schedule and update hardware repairs, system updates, and facility servicing.
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Add Item to Maintenance Button */}
          <Dialog open={isAddMaintOpen} onOpenChange={setIsAddMaintOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Item to Maintenance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmitRequest}>
                <DialogHeader>
                  <DialogTitle>Schedule Maintenance</DialogTitle>
                  <DialogDescription>
                    Request a maintenance or repair job for an asset.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asset Name / Title</label>
                    <Input 
                      placeholder="e.g. Server Room UPS, Physics Lab Projector" 
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Issue / Description</label>
                    <Textarea 
                      placeholder="Describe the issue or required servicing in detail..." 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Est. Cost ($)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type="number"
                          placeholder="e.g. 200"
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
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddMaintOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white">
                    {submitting ? 'Scheduling...' : 'Schedule Job'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Allocate Asset Button */}
          <Link href="/asset-manager-dashboard/send-asset">
            <Button variant="outline" className="shadow-sm">
              <ArrowRightLeft className="mr-2 h-4 w-4 text-primary" />
              Allocate Asset
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content area */}
      {loading ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-sm mt-4">Loading maintenance queue...</p>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        /* Empty State */
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-bold text-lg text-foreground">Maintenance Queue Clear</h3>
            <p className="text-muted-foreground text-sm max-w-sm mt-1">
              All cataloged devices are currently reported in optimal operational condition.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Maintenance List View */
        <Card className="border border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 bg-muted/20 border-b border-border/60">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Maintenance Queue Catalog
                </CardTitle>
                <CardDescription className="text-xs mt-1">Inspections and repair queue for equipment issues.</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                Active Requests: {requests.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-muted/40">
                  <tr>
                    <th scope="col" className="px-6 py-3">Asset</th>
                    <th scope="col" className="px-6 py-3">Issue Details</th>
                    <th scope="col" className="px-6 py-3">Est. Cost</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3">Requested Date</th>
                    <th scope="col" className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-foreground">{req.assetName}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              req.priority === 'High' ? 'bg-red-500/10 text-red-500' :
                              req.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-slate-500/10 text-slate-500'
                            }`}>
                              {req.priority}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-sm max-w-xs truncate" title={req.description}>
                        {req.description}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">${req.estimatedCost.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <Badge className={
                          req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                          req.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }>
                          {req.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {new Date(req.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/asset-manager-dashboard/send-asset?assetName=${encodeURIComponent(req.assetName)}`}>
                          <Button size="sm" variant="outline" className="flex items-center gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
                            <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                            Allocate
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
