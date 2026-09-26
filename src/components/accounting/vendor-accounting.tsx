'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Search, CreditCard, FileText } from 'lucide-react';
import type { Vendor, PurchaseBill } from '@/lib/accounting-types';

interface VendorAccountingProps {
  vendors: Vendor[];
  purchaseBills: PurchaseBill[];
  onAddVendor: (vendorData: Omit<Vendor, 'id' | 'collegeId' | 'createdAt'>) => Promise<void>;
  onRecordPurchaseBill: (billData: Omit<PurchaseBill, 'id' | 'collegeId' | 'createdAt'>) => Promise<void>;
}

export function VendorAccounting({
  vendors,
  purchaseBills,
  onAddVendor,
  onRecordPurchaseBill,
}: VendorAccountingProps) {
  const [activeTab, setActiveTab] = useState<'vendors' | 'bills'>('vendors');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddVendorOpen, setIsAddVendorOpen] = useState<boolean>(false);
  const [isBillOpen, setIsBillOpen] = useState<boolean>(false);

  // Vendor state
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Stationery Supplier');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');

  // Bill state
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [billNumber, setBillNumber] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsSubmitting(true);
    try {
      await onAddVendor({
        name,
        companyName: name,
        category,
        email,
        phone,
        gstin,
        openingBalance: 0,
        currentBalance: 0,
      });

      setName('');
      setEmail('');
      setPhone('');
      setGstin('');
      setIsAddVendorOpen(false);
    } catch (err) {
      console.error('Failed to add vendor:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId || totalAmount <= 0) return;
    setIsSubmitting(true);
    try {
      const vendor = vendors.find((v) => v.id === selectedVendorId);
      await onRecordPurchaseBill({
        vendorId: selectedVendorId,
        vendorName: vendor?.name || 'Vendor',
        billNumber: billNumber || `BILL-${Date.now().toString().slice(-4)}`,
        billDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        items: [{ description: 'Purchase items', quantity: 1, unitPrice: totalAmount, total: totalAmount }],
        subtotal: totalAmount,
        taxAmount: 0,
        totalAmount: Number(totalAmount),
        paidAmount: 0,
        outstandingAmount: Number(totalAmount),
        status: 'unpaid',
      });

      setBillNumber('');
      setTotalAmount(0);
      setIsBillOpen(false);
    } catch (err) {
      console.error('Failed to record purchase bill:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" /> Vendor & Purchase Accounting
          </h2>
          <p className="text-muted-foreground text-sm">
            Vendor register, purchase bills entry, supplier ledger balances, and outstanding dues aging.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={isBillOpen} onOpenChange={setIsBillOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-slate-300">
                <FileText className="h-4 w-4" /> Enter Purchase Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Enter Supplier Purchase Bill</DialogTitle>
                <DialogDescription>Records outstanding vendor payable dues.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBillSubmit} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="b-ven">Select Vendor *</Label>
                  <select
                    id="b-ven"
                    className="w-full h-10 px-3 border rounded-md text-sm"
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    required
                  >
                    <option value="">Select Vendor Supplier</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="b-num">Bill / Invoice Number *</Label>
                  <Input id="b-num" placeholder="e.g. INV-2025-88" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="b-amt">Bill Amount (₹) *</Label>
                  <Input id="b-amt" type="number" step="0.01" value={totalAmount || ''} onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)} required />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsBillOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {isSubmitting ? 'Saving...' : 'Record Bill'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="h-4 w-4" /> Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Add New Supplier / Vendor</DialogTitle>
                <DialogDescription>Create vendor master record.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleVendorSubmit} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="v-name">Vendor Company Name *</Label>
                  <Input id="v-name" placeholder="e.g. ABC Printers & Stationers" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="v-cat">Category</Label>
                  <Input id="v-cat" placeholder="e.g. IT Equipment / Stationery / Canteen" value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="v-email">Email</Label>
                    <Input id="v-email" type="email" placeholder="vendor@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="v-phone">Phone</Label>
                    <Input id="v-phone" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="v-gst">GSTIN Number</Label>
                  <Input id="v-gst" placeholder="29AAAAA0000A1Z5" value={gstin} onChange={(e) => setGstin(e.target.value)} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddVendorOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {isSubmitting ? 'Saving...' : 'Register Vendor'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Vendor Master Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vendor name, category..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Badge variant="outline">{filteredVendors.length} Registered Vendors</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Vendor Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">GSTIN</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3 text-right">Outstanding Dues (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVendors.length > 0 ? (
                  filteredVendors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{v.name}</td>
                      <td className="p-3 text-slate-600">{v.category}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{v.gstin || 'N/A'}</td>
                      <td className="p-3 text-slate-600">{v.phone || v.email || 'N/A'}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">
                        ₹{(v.currentBalance || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No vendors registered yet.
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
