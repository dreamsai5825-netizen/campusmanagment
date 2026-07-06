'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
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
  doc, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  ClipboardList, 
  ArrowRightLeft, 
  Pencil, 
  Trash2, 
  AlertTriangle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

export default function AllocationsPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State: Edit & Delete Allocation Transfer
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [transferToEdit, setTransferToEdit] = useState<AssetTransfer | null>(null);
  const [transferToDelete, setTransferToDelete] = useState<AssetTransfer | null>(null);

  // Edit Form State
  const [editFromDept, setEditFromDept] = useState('');
  const [editToDept, setEditToDept] = useState('');
  const [editAssetName, setEditAssetName] = useState('');
  const [editAssetNumber, setEditAssetNumber] = useState('');
  const [editCondition, setEditCondition] = useState<'Excellent' | 'Good' | 'Fair' | 'Needs Repair'>('Excellent');
  const [editQuantity, setEditQuantity] = useState('1');

  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Load Transfer History
  useEffect(() => {
    if (!principal?.collegeId) return;

    const q = query(
      collection(db, 'asset_transfers'),
      where('collegeId', '==', principal.collegeId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AssetTransfer[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AssetTransfer));

      list.sort((a, b) => new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime());
      setTransfers(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [principal?.collegeId]);

  // Edit Transfer Handler
  const handleEditTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferToEdit || !principal?.collegeId) return;

    if (!editFromDept.trim() || !editToDept.trim() || !editAssetName.trim() || !editAssetNumber.trim() || !editQuantity) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'All fields are required.',
      });
      return;
    }

    const qtyNum = parseInt(editQuantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Quantity must be a positive integer.',
      });
      return;
    }

    setSubmittingEdit(true);
    try {
      await updateDoc(doc(db, 'asset_transfers', transferToEdit.id), {
        fromDept: editFromDept.trim(),
        toDept: editToDept.trim(),
        assetName: editAssetName.trim(),
        assetNumber: editAssetNumber.trim(),
        condition: editCondition,
        quantity: qtyNum
      });

      toast({
        title: 'Transfer Record Updated',
        description: `Successfully updated allocation for "${editAssetName}".`,
      });

      setIsEditOpen(false);
      setTransferToEdit(null);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update transfer record.',
      });
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Transfer Handler
  const handleDeleteTransfer = async () => {
    if (!transferToDelete || !principal?.collegeId) return;

    setSubmittingDelete(true);
    try {
      await deleteDoc(doc(db, 'asset_transfers', transferToDelete.id));

      toast({
        title: 'Transfer Record Deleted',
        description: `Successfully deleted allocation record for "${transferToDelete.assetName}".`,
      });

      setIsDeleteOpen(false);
      setTransferToDelete(null);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete transfer record.',
      });
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
          Asset Allocations
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Track and manage equipment and hardware transfers issued to departments, teachers, or students.
        </p>
      </div>

      {/* Main Table Card */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/20 border-b border-border/60">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Allocation History log
              </CardTitle>
              <CardDescription className="text-xs">Real-time log of sent and transferred assets with edit and delete capabilities.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              Total Allocations: {transfers.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-muted-foreground text-sm mt-3">Loading allocations...</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/60 mb-3" />
              <h3 className="font-bold text-base text-foreground">No Allocations Recorded</h3>
              <p className="text-muted-foreground text-xs max-w-sm mt-1">
                Allocated devices and hardware transfers will be recorded and displayed here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-muted/40">
                  <tr>
                    <th scope="col" className="px-6 py-3">Asset & No</th>
                    <th scope="col" className="px-6 py-3">From Dept</th>
                    <th scope="col" className="px-6 py-3">To Dept</th>
                    <th scope="col" className="px-6 py-3 text-center">Condition</th>
                    <th scope="col" className="px-6 py-3 text-center">Qty</th>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transfers.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-foreground block">{item.assetName}</span>
                        <span className="text-xs font-mono text-muted-foreground">{item.assetNumber}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{item.fromDept}</td>
                      <td className="px-6 py-4 text-muted-foreground">{item.toDept}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.condition === 'Excellent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                          item.condition === 'Good' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                          item.condition === 'Fair' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                          'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                        }`}>
                          {item.condition}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-foreground">{item.quantity}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(item.transferredAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/80 rounded-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTransferToEdit(item);
                              setEditFromDept(item.fromDept);
                              setEditToDept(item.toDept);
                              setEditAssetName(item.assetName);
                              setEditAssetNumber(item.assetNumber);
                              setEditCondition(item.condition);
                              setEditQuantity(String(item.quantity));
                              setIsEditOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTransferToDelete(item);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Transfer Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleEditTransfer}>
            <DialogHeader>
              <DialogTitle>Edit Allocation Record</DialogTitle>
              <DialogDescription>
                Modify details of the logged asset allocation.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Dept</label>
                  <Input 
                    placeholder="e.g. Physics Lab"
                    value={editFromDept}
                    onChange={(e) => setEditFromDept(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Dept / Recipient</label>
                  <Input 
                    placeholder="e.g. CS Department"
                    value={editToDept}
                    onChange={(e) => setEditToDept(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Name</label>
                <Input 
                  placeholder="e.g. Lab Projector #12"
                  value={editAssetName}
                  onChange={(e) => setEditAssetName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Number</label>
                <Input 
                  placeholder="e.g. LAB-PRJ-012"
                  value={editAssetNumber}
                  onChange={(e) => setEditAssetNumber(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Condition</label>
                  <Select 
                    value={editCondition} 
                    onValueChange={(val: any) => setEditCondition(val)}
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
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditOpen(false);
                setTransferToEdit(null);
              }} disabled={submittingEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingEdit} className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white">
                {submittingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Transfer Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Allocation Record
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the allocation record for <strong>{transferToDelete?.assetName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the transfer log entry from the database.
            </p>
            <p className="text-sm font-semibold text-destructive">
              This action is irreversible.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setIsDeleteOpen(false);
              setTransferToDelete(null);
            }} disabled={submittingDelete}>
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={handleDeleteTransfer}
              disabled={submittingDelete}
            >
              {submittingDelete ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
