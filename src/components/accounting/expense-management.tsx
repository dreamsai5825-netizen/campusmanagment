'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingDown, Plus, Search, Upload, FileText, ExternalLink } from 'lucide-react';
import type { ExpenseRecord, Account, Vendor } from '@/lib/accounting-types';

interface ExpenseManagementProps {
  expenses: ExpenseRecord[];
  accounts: Account[];
  vendors: Vendor[];
  onRecordExpense: (expenseData: Omit<ExpenseRecord, 'id' | 'createdAt'>) => Promise<void>;
}

export function ExpenseManagement({ expenses, accounts, vendors, onRecordExpense }: ExpenseManagementProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Form state
  const [category, setCategory] = useState<ExpenseRecord['category']>('Office Expenses');
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [accountId, setAccountId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [paidTo, setPaidTo] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<ExpenseRecord['paymentMode']>('Cash');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const expenseAccounts = accounts.filter((a) => a.type === 'expense');

  const filteredExpenses = expenses.filter((exp) => {
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    const matchesSearch =
      exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.paidTo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalExpenseAmount = filteredExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || amount <= 0 || !accountId) return;
    setIsSubmitting(true);
    try {
      const selectedAcc = accounts.find((a) => a.id === accountId);
      const selectedVendor = vendors.find((v) => v.id === vendorId);

      await onRecordExpense({
        collegeId: '',
        category,
        title,
        amount: Number(amount),
        accountId,
        accountName: selectedAcc?.name || 'Expense Account',
        vendorId: vendorId || undefined,
        vendorName: selectedVendor?.name || undefined,
        date: new Date().toISOString().split('T')[0],
        paidTo: paidTo || selectedVendor?.name || 'Payee',
        paymentMode,
        referenceNo,
        invoiceNo,
        notes,
      });

      setTitle('');
      setAmount(0);
      setPaidTo('');
      setVendorId('');
      setInvoiceNo('');
      setReferenceNo('');
      setNotes('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to record expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-rose-600" /> Expense Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Office expenses, utility bills, maintenance outlays, vendor purchases, and invoice records.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
              <Plus className="h-4 w-4" /> Record New Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Record Expense Outlay</DialogTitle>
              <DialogDescription>Posts double-entry payment ledger update under selected expense account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="exp-title">Expense Description *</Label>
                <Input id="exp-title" placeholder="e.g. Monthly Electricity Bill / Campus Maintenance" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exp-cat">Category *</Label>
                  <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                    <SelectTrigger id="exp-cat">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Office Expenses">Office Expenses</SelectItem>
                      <SelectItem value="Utility Bills">Utility Bills</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Purchases">Purchases</SelectItem>
                      <SelectItem value="Vendor Payments">Vendor Payments</SelectItem>
                      <SelectItem value="Miscellaneous Expenses">Miscellaneous Expenses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="exp-acc">Expense Account *</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="exp-acc">
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="max-h-48">
                      {expenseAccounts.map((a) => (
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
                  <Label htmlFor="exp-amount">Amount (₹) *</Label>
                  <Input id="exp-amount" type="number" step="0.01" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} required />
                </div>

                <div>
                  <Label htmlFor="exp-mode">Payment Mode *</Label>
                  <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                    <SelectTrigger id="exp-mode">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Online">Online / UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exp-vendor">Link Vendor (Optional)</Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger id="exp-vendor">
                      <SelectValue placeholder="Select Vendor" />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="max-h-48">
                      <SelectItem value="">None / Direct</SelectItem>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="exp-paid">Paid To (Payee Name)</Label>
                  <Input id="exp-paid" placeholder="Payee / Supplier Name" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exp-inv">Bill / Invoice Number</Label>
                  <Input id="exp-inv" placeholder="Invoice # e.g. INV-904" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                </div>

                <div>
                  <Label htmlFor="exp-ref">Txn / Ref Number</Label>
                  <Input id="exp-ref" placeholder="Txn Ref No" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-700 text-white">
                  {isSubmitting ? 'Recording...' : 'Record Expense'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expense Summary Card */}
      <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-rose-800 tracking-wider">Total Filtered Expenses</div>
            <div className="text-2xl font-black text-rose-950 mt-1">₹{totalExpenseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
          <Badge className="bg-rose-600 text-white text-xs px-3 py-1">{filteredExpenses.length} Records</Badge>
        </CardContent>
      </Card>

      {/* Table & Filters */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search expense description, payee..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filter Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Office Expenses">Office Expenses</SelectItem>
                <SelectItem value="Utility Bills">Utility Bills</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Purchases">Purchases</SelectItem>
                <SelectItem value="Vendor Payments">Vendor Payments</SelectItem>
                <SelectItem value="Miscellaneous Expenses">Miscellaneous Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Paid To</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{exp.title}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300">
                          {exp.category}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-700">{exp.paidTo}</td>
                      <td className="p-3 text-slate-600">{exp.date}</td>
                      <td className="p-3 text-slate-700 font-medium">{exp.paymentMode}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">
                        ₹{exp.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No expense records match the criteria.
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
