'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Plus, Search, Printer, AlertTriangle, CheckCircle, Trash2, ArrowLeftRight } from 'lucide-react';
import type { Voucher, VoucherType, VoucherLineItem, Account } from '@/lib/accounting-types';
import { printVoucher, type AccountingCollegeInfo } from '@/lib/accounting-export';

interface VoucherManagementProps {
  vouchers: Voucher[];
  accounts: Account[];
  onPostVoucher: (voucherData: Omit<Voucher, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  onReverseVoucher: (voucherId: string, reason: string) => Promise<void>;
  collegeName?: string;
  college?: AccountingCollegeInfo | string;
  userEmail?: string;
  userName?: string;
}

export function VoucherManagement({
  vouchers,
  accounts,
  onPostVoucher,
  onReverseVoucher,
  collegeName,
  college,
  userEmail = 'admin@campus.edu',
  userName = 'Admin User',
}: VoucherManagementProps) {
  const activeCollege = college || collegeName || 'Institution';
  const [activeType, setActiveType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Voucher Form State
  const [voucherType, setVoucherType] = useState<VoucherType>('journal');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [particulars, setParticulars] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [financialYear, setFinancialYear] = useState<string>('2025-2026');

  // Multi line items
  const [lineItems, setLineItems] = useState<Omit<VoucherLineItem, 'id'>[]>([
    { accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' },
    { accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const totalDebits = lineItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const totalCredits = lineItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const filteredVouchers = vouchers.filter((v) => {
    const matchesType = activeType === 'all' || v.type === activeType;
    const matchesSearch =
      v.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.particulars.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 2) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleAccountChange = (index: number, accId: string) => {
    const selectedAcc = accounts.find((a) => a.id === accId);
    if (!selectedAcc) return;
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      accountId: selectedAcc.id,
      accountName: selectedAcc.name,
      accountCode: selectedAcc.code,
    };
    setLineItems(updated);
  };

  const handleLineValueChange = (index: number, field: 'debit' | 'credit' | 'description', val: any) => {
    const updated = [...lineItems];
    if (field === 'debit') {
      updated[index].debit = parseFloat(val) || 0;
      if (parseFloat(val) > 0) updated[index].credit = 0; // zero out credit if debit entered
    } else if (field === 'credit') {
      updated[index].credit = parseFloat(val) || 0;
      if (parseFloat(val) > 0) updated[index].debit = 0; // zero out debit if credit entered
    } else {
      updated[index].description = String(val);
    }
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!isBalanced) {
      setErrorMsg(`Total Debits (₹${totalDebits.toFixed(2)}) must equal Total Credits (₹${totalCredits.toFixed(2)}).`);
      return;
    }
    if (!particulars) {
      setErrorMsg('Please specify voucher particulars.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedItems: VoucherLineItem[] = lineItems.map((item, idx) => ({
        ...item,
        id: String(idx + 1),
      }));

      await onPostVoucher({
        collegeId: '',
        voucherNo: `AUTO-${Date.now().toString().slice(-4)}`,
        type: voucherType,
        date,
        particulars,
        narration,
        lineItems: formattedItems,
        totalAmount: totalDebits,
        financialYear,
        preparedBy: { id: userEmail, name: userName, email: userEmail },
      });

      setParticulars('');
      setNarration('');
      setLineItems([
        { accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' },
        { accountId: '', accountName: '', accountCode: '', debit: 0, credit: 0, description: '' },
      ]);
      setIsDialogOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post voucher.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-600" /> Voucher Management & Posting
          </h2>
          <p className="text-muted-foreground text-sm">
            Post double-entry Receipt (RV), Payment (PV), Journal (JV), and Contra (CV) vouchers with real-time balance checks.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="h-4 w-4" /> Create Double-Entry Voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Voucher Entry</DialogTitle>
              <DialogDescription>Auto-generated voucher number with live Debit = Credit validation.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" /> {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="v-type">Voucher Type *</Label>
                  <Select value={voucherType} onValueChange={(val: any) => setVoucherType(val)}>
                    <SelectTrigger id="v-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receipt">Receipt Voucher (RV)</SelectItem>
                      <SelectItem value="payment">Payment Voucher (PV)</SelectItem>
                      <SelectItem value="journal">Journal Voucher (JV)</SelectItem>
                      <SelectItem value="contra">Contra Voucher (CV)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="v-date">Voucher Date *</Label>
                  <Input id="v-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="v-fy">Financial Year</Label>
                  <Select value={financialYear} onValueChange={setFinancialYear}>
                    <SelectTrigger id="v-fy">
                      <SelectValue placeholder="FY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025-2026">2025-2026</SelectItem>
                      <SelectItem value="2024-2025">2024-2025</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="v-part">Voucher Particulars / Summary *</Label>
                <Input id="v-part" placeholder="e.g. Bank cash deposit / Inter-account adjustment" value={particulars} onChange={(e) => setParticulars(e.target.value)} required />
              </div>

              {/* Line Items Table */}
              <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold uppercase text-slate-700">
                  <span>Double-Entry Accounts Breakdown</span>
                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <Badge className="bg-emerald-600 text-white gap-1 text-[10px]">
                        <CheckCircle className="h-3 w-3" /> BALANCED (Debits = Credits)
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        UNBALANCED (Diff: ₹{Math.abs(totalDebits - totalCredits).toFixed(2)})
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 border rounded-md">
                      <div className="col-span-4">
                        <Select value={item.accountId} onValueChange={(accId) => handleAccountChange(idx, accId)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select Account" />
                          </SelectTrigger>
                          <SelectContent side="bottom" className="max-h-48 text-xs">
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} - {a.name} ({a.type.toUpperCase()})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-3">
                        <Input
                          placeholder="Debit (₹)"
                          type="number"
                          step="0.01"
                          className="h-9 text-xs font-mono font-bold text-emerald-800"
                          value={item.debit || ''}
                          onChange={(e) => handleLineValueChange(idx, 'debit', e.target.value)}
                        />
                      </div>

                      <div className="col-span-3">
                        <Input
                          placeholder="Credit (₹)"
                          type="number"
                          step="0.01"
                          className="h-9 text-xs font-mono font-bold text-blue-800"
                          value={item.credit || ''}
                          onChange={(e) => handleLineValueChange(idx, 'credit', e.target.value)}
                        />
                      </div>

                      <div className="col-span-2 flex justify-end">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-rose-500" onClick={() => handleRemoveLineItem(idx)} disabled={lineItems.length <= 2}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem} className="text-xs gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add Entry Line
                  </Button>
                  <div className="text-xs font-bold space-x-4">
                    <span className="text-emerald-700">Total Debit: ₹{totalDebits.toFixed(2)}</span>
                    <span className="text-blue-700">Total Credit: ₹{totalCredits.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="v-narr">Narration / Internal Remarks</Label>
                <Input id="v-narr" placeholder="Detailed voucher description..." value={narration} onChange={(e) => setNarration(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !isBalanced} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isSubmitting ? 'Posting Voucher...' : 'Post Double-Entry Voucher'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={activeType === 'all' ? 'default' : 'outline'} onClick={() => setActiveType('all')}>All Vouchers</Button>
              <Button size="sm" variant={activeType === 'receipt' ? 'default' : 'outline'} onClick={() => setActiveType('receipt')}>Receipt (RV)</Button>
              <Button size="sm" variant={activeType === 'payment' ? 'default' : 'outline'} onClick={() => setActiveType('payment')}>Payment (PV)</Button>
              <Button size="sm" variant={activeType === 'journal' ? 'default' : 'outline'} onClick={() => setActiveType('journal')}>Journal (JV)</Button>
              <Button size="sm" variant={activeType === 'contra' ? 'default' : 'outline'} onClick={() => setActiveType('contra')}>Contra (CV)</Button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search voucher # or particulars..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Voucher No</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Particulars</th>
                  <th className="p-3 text-right">Total Amount (₹)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredVouchers.length > 0 ? (
                  filteredVouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-indigo-900">{v.voucherNo}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            v.type === 'receipt'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : v.type === 'payment'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : v.type === 'journal'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }
                        >
                          {v.type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600">{v.date}</td>
                      <td className="p-3 text-slate-900 font-medium max-w-xs truncate">{v.particulars}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{v.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={v.status === 'posted' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                          {v.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-center flex items-center justify-center gap-2">
                        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => printVoucher(v, activeCollege)}>
                          <Printer className="h-3.5 w-3.5 text-slate-600" /> Print
                        </Button>
                        {v.status === 'posted' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-rose-600 hover:bg-rose-50 gap-1"
                            onClick={() => {
                              const reason = prompt(`Reason for reversing voucher ${v.voucherNo}?`);
                              if (reason) onReverseVoucher(v.id, reason);
                            }}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" /> Reverse
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No vouchers match the selected filter.
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
