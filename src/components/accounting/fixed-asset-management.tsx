'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Plus, Calculator, Search, CheckCircle } from 'lucide-react';
import type { FixedAsset } from '@/lib/accounting-types';

interface FixedAssetManagementProps {
  assets: FixedAsset[];
  onAddAsset: (assetData: Omit<FixedAsset, 'id' | 'collegeId' | 'createdAt'>) => Promise<void>;
  onCalculateDepreciation: () => Promise<void>;
}

export function FixedAssetManagement({
  assets,
  onAddAsset,
  onCalculateDepreciation,
}: FixedAssetManagementProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Asset Form State
  const [assetCode, setAssetCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<FixedAsset['category']>('Computers & IT');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [usefulLifeYears, setUsefulLifeYears] = useState<number>(5);
  const [depreciationMethod, setDepreciationMethod] = useState<FixedAsset['depreciationMethod']>('Straight Line');
  const [depreciationRate, setDepreciationRate] = useState<number>(20);
  const [location, setLocation] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredAssets = assets.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.assetCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAssetCost = filteredAssets.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  const totalNetBookValue = filteredAssets.reduce((sum, item) => sum + (item.currentNetBookValue || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || purchasePrice <= 0) return;
    setIsSubmitting(true);
    try {
      await onAddAsset({
        assetCode: assetCode || `AST-${Date.now().toString().slice(-4)}`,
        name,
        category,
        purchaseDate: new Date().toISOString().split('T')[0],
        purchasePrice: Number(purchasePrice),
        usefulLifeYears: Number(usefulLifeYears) || 5,
        salvageValue: 0,
        depreciationMethod,
        depreciationRate: Number(depreciationRate) || 20,
        accumulatedDepreciation: 0,
        currentNetBookValue: Number(purchasePrice),
        location,
        status: 'active',
      });

      setName('');
      setAssetCode('');
      setPurchasePrice(0);
      setLocation('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to add fixed asset:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-teal-600" /> Fixed Asset Register & Depreciation
          </h2>
          <p className="text-muted-foreground text-sm">
            Institutional capital assets, computer labs, furniture, machinery, and automated depreciation schedules (SLM/WDV).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onCalculateDepreciation} variant="outline" className="gap-2 border-slate-300">
            <Calculator className="h-4 w-4" /> Run Annual Depreciation
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="h-4 w-4" /> Register Fixed Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Register New Fixed Asset</DialogTitle>
                <DialogDescription>Posts asset acquisition ledger posting & schedule.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ast-code">Asset Tag Code</Label>
                    <Input id="ast-code" placeholder="e.g. AST-LAB-01" value={assetCode} onChange={(e) => setAssetCode(e.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="ast-cat">Asset Category *</Label>
                    <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                      <SelectTrigger id="ast-cat">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Computers & IT">Computers & IT</SelectItem>
                        <SelectItem value="Furniture">Furniture & Fixtures</SelectItem>
                        <SelectItem value="Lab Equipment">Lab Equipment</SelectItem>
                        <SelectItem value="Vehicles">Vehicles & Buses</SelectItem>
                        <SelectItem value="Buildings">Buildings & Infrastructure</SelectItem>
                        <SelectItem value="Land">Land</SelectItem>
                        <SelectItem value="Other">Other Assets</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="ast-name">Asset Description / Name *</Label>
                  <Input id="ast-name" placeholder="e.g. Dell Core-i7 Computer Lab System x10" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ast-price">Purchase Price (₹) *</Label>
                    <Input id="ast-price" type="number" step="0.01" value={purchasePrice || ''} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)} required />
                  </div>

                  <div>
                    <Label htmlFor="ast-life">Useful Life (Years)</Label>
                    <Input id="ast-life" type="number" value={usefulLifeYears} onChange={(e) => setUsefulLifeYears(parseInt(e.target.value, 10) || 5)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ast-method">Depreciation Method</Label>
                    <Select value={depreciationMethod} onValueChange={(val: any) => setDepreciationMethod(val)}>
                      <SelectTrigger id="ast-method">
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Straight Line">Straight Line (SLM)</SelectItem>
                        <SelectItem value="Written Down Value">Written Down Value (WDV)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="ast-rate">Annual Depr. Rate (%)</Label>
                    <Input id="ast-rate" type="number" step="0.1" value={depreciationRate} onChange={(e) => setDepreciationRate(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="ast-loc">Physical Location</Label>
                  <Input id="ast-loc" placeholder="e.g. Computer Science Lab 2" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700 text-white">
                    {isSubmitting ? 'Registering...' : 'Register Asset'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase text-teal-800 tracking-wider">Total Original Asset Cost</div>
            <div className="text-2xl font-black text-teal-950 mt-1">₹{totalAssetCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase text-blue-800 tracking-wider">Current Net Book Value (NBV)</div>
            <div className="text-2xl font-black text-blue-950 mt-1">₹{totalNetBookValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search asset tag, name, category..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Badge variant="outline">{filteredAssets.length} Active Assets</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Tag Code</th>
                  <th className="p-3">Asset Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Purchase Date</th>
                  <th className="p-3 text-right">Cost (₹)</th>
                  <th className="p-3 text-right">Accumulated Depr (₹)</th>
                  <th className="p-3 text-right">Net Book Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAssets.length > 0 ? (
                  filteredAssets.map((ast) => (
                    <tr key={ast.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-teal-900">{ast.assetCode}</td>
                      <td className="p-3 font-medium text-slate-900">{ast.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-300">
                          {ast.category}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600">{ast.purchaseDate}</td>
                      <td className="p-3 text-right font-mono text-slate-700">₹{ast.purchasePrice.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono text-rose-700">₹{(ast.accumulatedDepreciation || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono font-bold text-teal-800">
                        ₹{(ast.currentNetBookValue || ast.purchasePrice).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No fixed assets registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
