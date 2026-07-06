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
  doc, 
  addDoc, 
  updateDoc,
  getDocs,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { 
  Boxes, 
  PlusCircle, 
  FolderPlus, 
  ChevronLeft, 
  Activity, 
  Info, 
  AlertTriangle,
  Building2,
  Trash2,
  Pencil
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Department {
  id: string;
  collegeId: string;
  name: string;
  createdAt: string;
}

interface Asset {
  id: string;
  collegeId: string;
  departmentId: string;
  assetName: string;
  assetType: string;
  assetNumber: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Needs Repair';
  quantity: number;
  addedAt: string;
}

export default function InventoryPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Dialog State: Add Department
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [submittingDept, setSubmittingDept] = useState(false);

  // Dialog State: Add Asset Item
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [condition, setCondition] = useState<'Excellent' | 'Good' | 'Fair' | 'Needs Repair'>('Excellent');
  const [quantity, setQuantity] = useState('1');
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [submittingAsset, setSubmittingAsset] = useState(false);

  // Dialog State: Edit & Delete Department
  const [isEditDeptOpen, setIsEditDeptOpen] = useState(false);
  const [isDeleteDeptOpen, setIsDeleteDeptOpen] = useState(false);
  const [deptToEdit, setDeptToEdit] = useState<Department | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [submittingEditDept, setSubmittingEditDept] = useState(false);
  const [submittingDeleteDept, setSubmittingDeleteDept] = useState(false);

  // Dialog State: Edit & Delete Asset
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [isDeleteAssetOpen, setIsDeleteAssetOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [editAssetName, setEditAssetName] = useState('');
  const [editAssetType, setEditAssetType] = useState('');
  const [editAssetNumber, setEditAssetNumber] = useState('');
  const [editCondition, setEditCondition] = useState<'Excellent' | 'Good' | 'Fair' | 'Needs Repair'>('Excellent');
  const [editQuantity, setEditQuantity] = useState('1');
  const [submittingEditAsset, setSubmittingEditAsset] = useState(false);
  const [submittingDeleteAsset, setSubmittingDeleteAsset] = useState(false);

  // Load Departments
  useEffect(() => {
    if (!principal?.collegeId) return;

    const q = query(
      collection(db, 'asset_departments'),
      where('collegeId', '==', principal.collegeId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: Department[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Department));

      // Auto-seed default departments if none exist
      if (list.length === 0 && !snapshot.metadata.fromCache) {
        setLoadingDepts(true);
        const defaults = ['Physics Department', 'Computer Science', 'Chemistry Department', 'Campus Library'];
        try {
          for (const name of defaults) {
            await addDoc(collection(db, 'asset_departments'), {
              collegeId: principal.collegeId,
              name,
              createdAt: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error("Error seeding departments:", e);
        }
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(list);
        setLoadingDepts(false);
      }
    });

    return () => unsubscribe();
  }, [principal?.collegeId]);

  // Load Assets for selected Department
  useEffect(() => {
    if (!principal?.collegeId || !selectedDept) {
      setAssets([]);
      return;
    }

    setLoadingAssets(true);
    const q = query(
      collection(db, 'assets'),
      where('collegeId', '==', principal.collegeId),
      where('departmentId', '==', selectedDept.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Asset[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Asset));
      
      list.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      setAssets(list);
      setLoadingAssets(false);
    });

    return () => unsubscribe();
  }, [principal?.collegeId, selectedDept]);

  // Add Department handler
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim() || !principal?.collegeId) return;

    setSubmittingDept(true);
    try {
      await addDoc(collection(db, 'asset_departments'), {
        collegeId: principal.collegeId,
        name: newDeptName.trim(),
        createdAt: new Date().toISOString()
      });

      toast({
        title: 'Department Added',
        description: `Successfully created department "${newDeptName}".`,
      });
      
      setNewDeptName('');
      setIsAddDeptOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create department.',
      });
    } finally {
      setSubmittingDept(false);
    }
  };

  // Edit Department handler
  const handleEditDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptToEdit || !editDeptName.trim() || !principal?.collegeId) return;

    setSubmittingEditDept(true);
    try {
      await updateDoc(doc(db, 'asset_departments', deptToEdit.id), {
        name: editDeptName.trim()
      });

      toast({
        title: 'Department Updated',
        description: `Successfully renamed department to "${editDeptName.trim()}".`,
      });

      setIsEditDeptOpen(false);
      setDeptToEdit(null);
      setEditDeptName('');
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update department name.',
      });
    } finally {
      setSubmittingEditDept(false);
    }
  };

  // Delete Department handler
  const handleDeleteDepartment = async () => {
    if (!deptToDelete || !principal?.collegeId) return;

    setSubmittingDeleteDept(true);
    try {
      // 1. Query all assets belonging to this department
      const q = query(
        collection(db, 'assets'),
        where('collegeId', '==', principal.collegeId),
        where('departmentId', '==', deptToDelete.id)
      );
      const querySnapshot = await getDocs(q);

      // 2. Perform a batched delete for assets and the department document
      const batch = writeBatch(db);
      querySnapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      batch.delete(doc(db, 'asset_departments', deptToDelete.id));

      await batch.commit();

      toast({
        title: 'Department Deleted',
        description: `Successfully deleted department "${deptToDelete.name}" and all of its assets.`,
      });

      setIsDeleteDeptOpen(false);
      setDeptToDelete(null);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete department and its assets.',
      });
    } finally {
      setSubmittingDeleteDept(false);
    }
  };

  // Add Asset handler
  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !principal?.collegeId) return;
    if (!assetName.trim() || !assetType.trim() || !assetNumber.trim() || !quantity) {
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

    setSubmittingAsset(true);
    try {
      await addDoc(collection(db, 'assets'), {
        collegeId: principal.collegeId,
        departmentId: selectedDept.id,
        assetName: assetName.trim(),
        assetType: assetType.trim(),
        assetNumber: assetNumber.trim(),
        condition,
        quantity: qtyNum,
        addedAt: new Date().toISOString()
      });

      toast({
        title: 'Asset Added',
        description: `Successfully added "${assetName}" to ${selectedDept.name} inventory.`,
      });

      // Reset
      setAssetName('');
      setAssetType('');
      setAssetNumber('');
      setCondition('Excellent');
      setQuantity('1');
      setIsAddAssetOpen(false);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add item to inventory.',
      });
    } finally {
      setSubmittingAsset(false);
    }
  };

  // Edit Asset handler
  const handleEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetToEdit || !principal?.collegeId) return;
    if (!editAssetName.trim() || !editAssetType.trim() || !editAssetNumber.trim() || !editQuantity) {
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

    setSubmittingEditAsset(true);
    try {
      await updateDoc(doc(db, 'assets', assetToEdit.id), {
        assetName: editAssetName.trim(),
        assetType: editAssetType.trim(),
        assetNumber: editAssetNumber.trim(),
        condition: editCondition,
        quantity: qtyNum
      });

      toast({
        title: 'Asset Updated',
        description: `Successfully updated asset details for "${editAssetName}".`,
      });

      setIsEditAssetOpen(false);
      setAssetToEdit(null);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update asset.',
      });
    } finally {
      setSubmittingEditAsset(false);
    }
  };

  // Delete Asset handler
  const handleDeleteAsset = async () => {
    if (!assetToDelete || !principal?.collegeId) return;

    setSubmittingDeleteAsset(true);
    try {
      await deleteDoc(doc(db, 'assets', assetToDelete.id));

      toast({
        title: 'Asset Deleted',
        description: `Successfully deleted "${assetToDelete.assetName}".`,
      });

      setIsDeleteAssetOpen(false);
      setAssetToDelete(null);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete asset.',
      });
    } finally {
      setSubmittingDeleteAsset(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Asset Inventory
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            {selectedDept 
              ? `Viewing cataloged items in the ${selectedDept.name}` 
              : 'Browse items or register new hardware/facilities categorized by department.'
            }
          </p>
        </div>
        
        {!selectedDept && (
          <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md">
                <FolderPlus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleAddDepartment}>
                <DialogHeader>
                  <DialogTitle>Add New Department</DialogTitle>
                  <DialogDescription>
                    Create a new organizational department category for tracking assets.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department Name</label>
                    <Input 
                      placeholder="e.g. Physics Department, Computer Lab" 
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDeptOpen(false)} disabled={submittingDept}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingDept} className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white">
                    {submittingDept ? 'Creating...' : 'Create Department'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Main content area */}
      {loadingDepts ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground text-sm mt-4">Loading departments...</p>
          </CardContent>
        </Card>
      ) : !selectedDept ? (
        /* Department Selection Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {departments.map((dept) => (
            <Card 
              key={dept.id} 
              onClick={() => setSelectedDept(dept)}
              className="cursor-pointer overflow-hidden border border-border/80 shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md hover:border-primary/40 bg-card hover:bg-muted/10 group relative flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-gradient-to-br from-primary/10 to-violet-500/10 rounded-full blur-lg group-hover:scale-150 transition-transform duration-500" />
              
              {/* Card Action Buttons */}
              <div className="absolute top-3 right-3 flex gap-1.5 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/80 rounded-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeptToEdit(dept);
                    setEditDeptName(dept.name);
                    setIsEditDeptOpen(true);
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
                    setDeptToDelete(dept);
                    setIsDeleteDeptOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <CardHeader className="pb-2">
                <Building2 className="h-8 w-8 text-primary mb-2 group-hover:scale-110 transition-transform duration-300" />
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors line-clamp-1">{dept.name}</CardTitle>
                <CardDescription className="text-xs">Click to view asset catalog</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <span className="text-xs text-muted-foreground">Registered under college scope</span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Department Asset Detail View */
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setSelectedDept(null)} className="shadow-sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Departments
            </Button>

            <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Item to Inventory
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <form onSubmit={handleAddAsset}>
                  <DialogHeader>
                    <DialogTitle>Add Asset to {selectedDept.name}</DialogTitle>
                    <DialogDescription>
                      Register a new asset and store its catalog specifications.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Asset Name</label>
                      <Input 
                        placeholder="e.g. Smartboard, Projector, Dell Laptop" 
                        value={assetName}
                        onChange={(e) => setAssetName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Asset Type (Text Box)</label>
                      <Input 
                        placeholder="e.g. Electronics, Furniture, Laboratory" 
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Asset Number / Barcode ID</label>
                      <Input 
                        placeholder="e.g. LAB-PRJ-012, CS-LAP-224" 
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
                        <label className="text-sm font-medium">Quantity</label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddAssetOpen(false)} disabled={submittingAsset}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submittingAsset} className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white">
                      {submittingAsset ? 'Adding...' : 'Add Item'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border border-border/80 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-muted/20 border-b border-border/60">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-primary" />
                    {selectedDept.name} Inventory Catalog
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">Institutional records and tracking specifications.</CardDescription>
                </div>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  Total Items: {assets.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAssets ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-muted-foreground text-sm mt-3">Loading inventory catalog...</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Boxes className="h-12 w-12 text-muted-foreground/60 mb-3" />
                  <h3 className="font-bold text-base text-foreground">No Items in Department</h3>
                  <p className="text-muted-foreground text-xs max-w-xs mt-1">
                    Click "Add Item to Inventory" to catalog equipment for this department.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-muted/40">
                      <tr>
                        <th scope="col" className="px-6 py-3">Asset Name</th>
                        <th scope="col" className="px-6 py-3">Asset Type</th>
                        <th scope="col" className="px-6 py-3">Asset Number</th>
                        <th scope="col" className="px-6 py-3">Condition</th>
                        <th scope="col" className="px-6 py-3 text-center">Quantity</th>
                        <th scope="col" className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {assets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 font-semibold text-foreground">{asset.assetName}</td>
                          <td className="px-6 py-4 text-muted-foreground">{asset.assetType}</td>
                          <td className="px-6 py-4 font-mono text-xs">{asset.assetNumber}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              asset.condition === 'Excellent' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                              asset.condition === 'Good' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300' :
                              asset.condition === 'Fair' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                              'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                            }`}>
                              {asset.condition}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-foreground">{asset.quantity}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/80 rounded-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssetToEdit(asset);
                                  setEditAssetName(asset.assetName);
                                  setEditAssetType(asset.assetType);
                                  setEditAssetNumber(asset.assetNumber);
                                  setEditCondition(asset.condition);
                                  setEditQuantity(String(asset.quantity));
                                  setIsEditAssetOpen(true);
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
                                  setAssetToDelete(asset);
                                  setIsDeleteAssetOpen(true);
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
        </div>
      )}

      {/* Edit Department Dialog */}
      <Dialog open={isEditDeptOpen} onOpenChange={setIsEditDeptOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleEditDepartment}>
            <DialogHeader>
              <DialogTitle>Edit Department Name</DialogTitle>
              <DialogDescription>
                Change the name of this department category.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Department Name</label>
                <Input 
                  placeholder="e.g. Physics Department" 
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditDeptOpen(false);
                setDeptToEdit(null);
              }} disabled={submittingEditDept}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingEditDept} className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white">
                {submittingEditDept ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Department Dialog */}
      <Dialog open={isDeleteDeptOpen} onOpenChange={setIsDeleteDeptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Department
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the department <strong>{deptToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete this department category and <strong className="text-foreground">all asset items registered under it</strong>.
            </p>
            <p className="text-sm font-semibold text-destructive">
              This action is irreversible.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setIsDeleteDeptOpen(false);
              setDeptToDelete(null);
            }} disabled={submittingDeleteDept}>
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={handleDeleteDepartment}
              disabled={submittingDeleteDept}
            >
              {submittingDeleteDept ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditAssetOpen} onOpenChange={setIsEditAssetOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleEditAsset}>
            <DialogHeader>
              <DialogTitle>Edit Asset Item</DialogTitle>
              <DialogDescription>
                Modify the catalog specifications of the asset.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Name</label>
                <Input 
                  placeholder="e.g. Smartboard, Projector, Dell Laptop" 
                  value={editAssetName}
                  onChange={(e) => setEditAssetName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Type (Text Box)</label>
                <Input 
                  placeholder="e.g. Electronics, Furniture, Laboratory" 
                  value={editAssetType}
                  onChange={(e) => setEditAssetType(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Number / Barcode ID</label>
                <Input 
                  placeholder="e.g. LAB-PRJ-012, CS-LAP-224" 
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
                  <label className="text-sm font-medium">Quantity</label>
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
                setIsEditAssetOpen(false);
                setAssetToEdit(null);
              }} disabled={submittingEditAsset}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingEditAsset} className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white">
                {submittingEditAsset ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Asset Dialog */}
      <Dialog open={isDeleteAssetOpen} onOpenChange={setIsDeleteAssetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Asset Item
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the asset item <strong>{assetToDelete?.assetName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete this asset record from the department's catalog.
            </p>
            <p className="text-sm font-semibold text-destructive">
              This action is irreversible.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setIsDeleteAssetOpen(false);
              setAssetToDelete(null);
            }} disabled={submittingDeleteAsset}>
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={handleDeleteAsset}
              disabled={submittingDeleteAsset}
            >
              {submittingDeleteAsset ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
