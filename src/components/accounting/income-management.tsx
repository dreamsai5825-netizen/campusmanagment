'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, Plus, Search, Landmark, Calendar, FileText } from 'lucide-react';
import type { IncomeRecord, Account } from '@/lib/accounting-types';

interface IncomeManagementProps {
  incomes: IncomeRecord[];
  accounts: Account[];
  onRecordIncome: (incomeData: Omit<IncomeRecord, 'id' | 'createdAt'>) => Promise<void>;
}

export function IncomeManagement({ incomes, accounts, onRecordIncome }: IncomeManagementProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Form states
  const [category, setCategory] = useState<IncomeRecord['category']>('Miscellaneous Income');
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [accountId, setAccountId] = useState<string>('');
  const [receivedFrom, setReceivedFrom] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<IncomeRecord['paymentMode']>('Bank Transfer');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const incomeAccounts = accounts.filter((a) => a.type === 'income');

  const filteredIncomes = incomes.filter((inc) => {
    const matchesCategory = categoryFilter === 'all' || inc.category === categoryFilter;
    const matchesSearch =
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.receivedFrom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalIncomeAmount = filteredIncomes.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || amount <= 0 || !accountId) return;
    setIsSubmitting(true);
    try {
      const selectedAcc = accounts.find((a) => a.id === accountId);
      await onRecordIncome({
        collegeId: '',
        category,
        title,
        amount: Number(amount),
        accountId,
        accountName: selectedAcc?.name || 'Income Account',
        date: new Date().toISOString().split('T')[0],
        receivedFrom: receivedFrom || 'Anonymous / Payer',
        paymentMode,
        referenceNo,
        notes,
      });

      setTitle('');
      setAmount(0);
      setReceivedFrom('');
      setReferenceNo('');
      setNotes('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to record income:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-600" /> Income & Grant Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Categorized revenue entries (Admission, Tuition, Hostel, Transport, Grants & Donations).
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> Record Miscellaneous Income / Grant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Record Income Entry</DialogTitle>
              <DialogDescription>Posts double-entry ledger update under chosen income account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="inc-title">Income Title / Purpose *</Label>
                <Input id="inc-title" placeholder="e.g. Alumni Research Grant / Canteen Rent" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inc-cat">Category *</Label>
                  <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                    <SelectTrigger id="inc-cat">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admission Fees">Admission Fees</SelectItem>
                      <SelectItem value="Tuition Fees">Tuition Fees</SelectItem>
                      <SelectItem value="Hostel Fees">Hostel Fees</SelectItem>
                      <SelectItem value="Transport Fees">Transport Fees</SelectItem>
                      <SelectItem value="Library Fees">Library Fees</SelectItem>
                      <SelectItem value="Miscellaneous Income">Miscellaneous Income</SelectItem>
                      <SelectItem value="Donation & Grants">Donation & Grants</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="inc-acc">Target Income Ledger *</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="inc-acc">
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="max-h-48">
                      {incomeAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inc-amount">Amount (₹) *</Label>
                  <Input id="inc-amount" type="number" step="0.01" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} required />
                </div>

                <div>
                  <Label htmlFor="inc-mode">Payment Mode *</Label>
                  <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                    <SelectTrigger id="inc-mode">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Online">Online / UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="inc-from">Received From (Entity / Donor)</Label>
                <Input id="inc-from" placeholder="e.g. Higher Education Trust / Govt Grant" value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="inc-ref">Reference / UTR No</Label>
                <Input id="inc-ref" placeholder="NEFT / UTR / Cheque No" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSubmitting ? 'Recording...' : 'Record Income'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-emerald-800 tracking-wider">Filtered Revenue Total</div>
            <div className="text-2xl font-black text-emerald-950 mt-1">₹{totalIncomeAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
          <Badge className="bg-emerald-600 text-white text-xs px-3 py-1">{filteredIncomes.length} Records</Badge>
        </CardContent>
      </Card>

      {/* Filter and Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search title, donor, category..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filter Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Admission Fees">Admission Fees</SelectItem>
                <SelectItem value="Tuition Fees">Tuition Fees</SelectItem>
                <SelectItem value="Hostel Fees">Hostel Fees</SelectItem>
                <SelectItem value="Transport Fees">Transport Fees</SelectItem>
                <SelectItem value="Library Fees">Library Fees</SelectItem>
                <SelectItem value="Miscellaneous Income">Miscellaneous Income</SelectItem>
                <SelectItem value="Donation & Grants">Donation & Grants</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Title / Purpose</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Received From</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredIncomes.length > 0 ? (
                  filteredIncomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{inc.title}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">
                          {inc.category}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-700">{inc.receivedFrom}</td>
                      <td className="p-3 text-slate-600">{inc.date}</td>
                      <td className="p-3 text-slate-700 font-medium">{inc.paymentMode}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700">
                        ₹{inc.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No income records match the filters.
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
