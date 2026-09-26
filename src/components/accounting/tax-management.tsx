'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Plus } from 'lucide-react';
import type { TaxRecord } from '@/lib/accounting-types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface TaxManagementProps {
  taxRecords: TaxRecord[];
  onAddTaxRecord?: (recordData: Omit<TaxRecord, 'id' | 'collegeId' | 'createdAt'>) => Promise<void>;
}

export function TaxManagement({ taxRecords, onAddTaxRecord }: TaxManagementProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [taxType, setTaxType] = useState<'GST' | 'TDS' | 'Professional Tax'>('GST');
  const [period, setPeriod] = useState('');
  const [taxableAmount, setTaxableAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [status, setStatus] = useState<'paid' | 'due' | 'filed'>('paid');
  const [challanNo, setChallanNo] = useState('');
  const [notes, setNotes] = useState('');

  // Calculate dynamic totals
  const gstLiability = taxRecords
    .filter((r) => r.taxType?.toUpperCase() === 'GST')
    .reduce((sum, r) => sum + (r.taxAmount || 0), 0);

  const tdsDeducted = taxRecords
    .filter((r) => r.taxType?.toUpperCase() === 'TDS')
    .reduce((sum, r) => sum + (r.taxAmount || 0), 0);

  const ptDeducted = taxRecords
    .filter((r) => r.taxType?.toUpperCase() === 'PT' || r.taxType?.toUpperCase() === 'PROFESSIONAL TAX')
    .reduce((sum, r) => sum + (r.taxAmount || 0), 0);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!period || !taxableAmount || !taxAmount) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    if (!onAddTaxRecord) return;

    setSubmitting(true);
    try {
      const tAmount = parseFloat(taxAmount);
      const tBase = parseFloat(taxableAmount);
      await onAddTaxRecord({
        taxType,
        period,
        taxableAmount: tBase,
        taxAmount: tAmount,
        taxRate: tBase > 0 ? (tAmount / tBase) * 100 : 0,
        status,
        challanNo: challanNo || undefined,
        notes: notes || undefined,
        paymentDate: new Date().toISOString().split('T')[0],
      });

      toast({
        title: 'Tax Record Added',
        description: `Successfully logged ${taxType} transaction of ₹${parseFloat(taxAmount).toLocaleString('en-IN')}`,
      });

      // Reset form
      setPeriod('');
      setTaxableAmount('');
      setTaxAmount('');
      setChallanNo('');
      setNotes('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error Saving Record',
        description: 'An unexpected error occurred while saving the tax record.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" /> Tax & Statutory Compliance Management
          </h2>
          <p className="text-muted-foreground text-sm">
            GST (CGST/SGST/IGST), TDS (Tax Deducted at Source), Professional Tax (PT), and tax filing reports.
          </p>
        </div>
        
        {onAddTaxRecord && (
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2 self-end sm:self-auto">
            <Plus className="h-4 w-4" /> Log Tax Filing / Payment
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 dark:from-slate-900 dark:to-blue-950 dark:border-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">GST Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-900 dark:text-blue-100">₹{gstLiability.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Output GST collected on services</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 dark:from-slate-900 dark:to-purple-950 dark:border-purple-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider">TDS Deducted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-900 dark:text-purple-100">₹{tdsDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">Tax deducted on staff salaries & vendor bills</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 dark:from-slate-900 dark:to-emerald-950 dark:border-emerald-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Professional Tax (PT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100">₹{ptDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Monthly staff PT deductions</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold font-headline">Statutory Tax Filing Register</CardTitle>
          <CardDescription>Quarterly & monthly tax liabilities and challan records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold">
                  <th className="p-3">Tax Type</th>
                  <th className="p-3">Period</th>
                  <th className="p-3 text-right">Taxable Base (₹)</th>
                  <th className="p-3 text-right">Tax Amount (₹)</th>
                  <th className="p-3">Challan / Ref No</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {taxRecords.length > 0 ? (
                  taxRecords.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                        <Badge variant="secondary" className="font-bold">{t.taxType}</Badge>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">{t.period}</td>
                      <td className="p-3 text-right font-mono">₹{t.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300">₹{t.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{t.challanNo || '—'}</td>
                      <td className="p-3 text-center">
                        <Badge className={t.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-none' : 'bg-amber-500/10 text-amber-600 border-none'}>
                          {t.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No statutory tax filings recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Log Tax Filing Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Statutory Tax Filing / Payment</DialogTitle>
            <DialogDescription>
              Record tax payments and liabilities for statutory government filings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax-type">Tax Type</Label>
                <select
                  id="tax-type"
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="GST">GST Liability</option>
                  <option value="TDS">TDS Deducted</option>
                  <option value="Professional Tax">Professional Tax (PT)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Filing Period</Label>
                <Input
                  id="period"
                  placeholder="e.g. Q1 2026, Aug 2026"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxable-amount">Taxable Base Amount (₹)</Label>
                <Input
                  id="taxable-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={taxableAmount}
                  onChange={(e) => setTaxableAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax-amount">Tax Payment / Liability (₹)</Label>
                <Input
                  id="tax-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax-status">Status</Label>
                <select
                  id="tax-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="paid">Paid</option>
                  <option value="due">Due / Accrued</option>
                  <option value="filed">Filed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="challan-no">Challan / Reference No</Label>
                <Input
                  id="challan-no"
                  placeholder="Challan number or UTR"
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Description</Label>
              <textarea
                id="notes"
                placeholder="Details of payment or tax code reference..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Log Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
