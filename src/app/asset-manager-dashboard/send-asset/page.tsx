'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Send, Building2, ClipboardList, Calendar, Activity, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'next/navigation';

interface AssetTransfer {
  id: string;
  collegeId: string;
  fromDept: string;
  toDept: string;
  assetName: string;
  assetNumber: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Needs Repair';
  quantity: number;
  transferredAt: string;
}

function SendAssetForm() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [fromDept, setFromDept] = useState('');
  const [toDept, setToDept] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [condition, setCondition] = useState<'Excellent' | 'Good' | 'Fair' | 'Needs Repair'>('Excellent');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prefillName = searchParams.get('assetName');
    if (prefillName) {
      setAssetName(prefillName);
    }
    const prefillNumber = searchParams.get('assetNumber');
    if (prefillNumber) {
      setAssetNumber(prefillNumber);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const q = query(
      collection(db, 'asset_transfers'),
      where('collegeId', '==', principal.collegeId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: AssetTransfer[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AssetTransfer));

      // Auto-seed if empty
      if (list.length === 0 && !snapshot.metadata.fromCache) {
        setLoading(true);
        const defaults = [
          {
            collegeId: principal.collegeId,
            fromDept: 'Physics Department',
            toDept: 'Admissions Office',
            assetName: 'Lab Projector #12',
            assetNumber: 'LAB-PRJ-012',
            condition: 'Good' as const,
            quantity: 1,
            transferredAt: new Date(Date.now() - 3600000 * 24).toISOString(),
          },
          {
            collegeId: principal.collegeId,
            fromDept: 'Computer Science',
            toDept: 'Library',
            assetName: 'Dell Latitude 5420',
            assetNumber: 'CS-LAP-224',
            condition: 'Excellent' as const,
            quantity: 2,
            transferredAt: new Date(Date.now() - 3600000 * 48).toISOString(),
          }
        ];
        try {
          for (const item of defaults) {
            await addDoc(collection(db, 'asset_transfers'), item);
          }
        } catch (e) {
          console.error("Error seeding transfers:", e);
        }
      } else {
        list.sort((a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime());
        setTransfers(list);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [principal?.collegeId]);

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal?.collegeId) return;

    if (!fromDept.trim() || !toDept.trim() || !assetName.trim() || !assetNumber.trim() || !quantity) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'All fields are required.',
      });
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Quantity must be a positive integer.',
      });
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'asset_transfers'), {
        collegeId: principal.collegeId,
        fromDept: fromDept.trim(),
        toDept: toDept.trim(),
        assetName: assetName.trim(),
        assetNumber: assetNumber.trim(),
        condition,
        quantity: qtyNum,
        transferredAt: new Date().toISOString()
      });

      toast({
        title: 'Asset Sent',
        description: `Successfully transferred "${assetName}" from ${fromDept} to ${toDept}.`,
      });

      // Reset
      setFromDept('');
      setToDept('');
      setAssetName('');
      setAssetNumber('');
      setCondition('Excellent');
      setQuantity('1');
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to record asset transfer.',
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
          Send Asset
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Log equipment and hardware transfers between different departments or branches.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 items-start">
        {/* Send Asset Form */}
        <Card className="lg:col-span-2 border border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Transfer Asset Form</CardTitle>
            <CardDescription>Enter details of the asset and its sender/receiver departments.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Dept</label>
                  <Input 
                    placeholder="e.g. Physics Lab"
                    value={fromDept}
                    onChange={(e) => setFromDept(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">To Dept / Recipient</label>
                  <Input 
                    placeholder="e.g. CS Department"
                    value={toDept}
                    onChange={(e) => setToDept(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Name</label>
                <Input 
                  placeholder="e.g. Lab Projector #12"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Number</label>
                <Input 
                  placeholder="e.g. LAB-PRJ-012"
                  value={assetNumber}
                  onChange={(e) => setAssetNumber(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Condition</label>
                  <Select 
                    value={condition} 
                    onValueChange={(val: any) => setCondition(val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Excellent">Excellent</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity (QTY)</label>
                  <Input 
                    type="number"
                    min="1"
                    placeholder="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md pt-2">
                <Send className="mr-2 h-4 w-4" />
                {submitting ? 'Sending Asset...' : 'Send Asset'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Transfer History Table */}
        <Card className="lg:col-span-3 border border-border/80 shadow-sm overflow-hidden h-full flex flex-col">
          <CardHeader className="pb-4 bg-muted/20 border-b border-border/60">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Transfer Log / History
            </CardTitle>
            <CardDescription className="text-xs">Real-time log of sent and transferred assets.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-y-auto max-h-[600px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground text-sm mt-3">Loading transfer logs...</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/60 mb-3" />
                <h3 className="font-bold text-base text-foreground">No Transfers Recorded</h3>
                <p className="text-muted-foreground text-xs max-w-sm mt-1">
                  Fill in the form to execute your first asset transfer log.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-muted/40">
                    <tr>
                      <th scope="col" className="px-4 py-3">Asset & No</th>
                      <th scope="col" className="px-4 py-3">From Dept</th>
                      <th scope="col" className="px-4 py-3">To Dept</th>
                      <th scope="col" className="px-4 py-3 text-center">Condition</th>
                      <th scope="col" className="px-4 py-3 text-center">Qty</th>
                      <th scope="col" className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transfers.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground block">{item.assetName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{item.assetNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{item.fromDept}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{item.toDept}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            item.condition === 'Excellent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                            item.condition === 'Good' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                            item.condition === 'Fair' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                            'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                          }`}>
                            {item.condition}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-foreground text-xs">{item.quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground text-[10px]">
                          {new Date(item.transferredAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SendAssetPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6 sm:gap-8">
        <div>
          <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Send Asset
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Log equipment and hardware transfers between different departments or branches.
          </p>
        </div>
        <Card className="border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-sm mt-4">Loading transfer form...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <SendAssetForm />
    </Suspense>
  );
}
