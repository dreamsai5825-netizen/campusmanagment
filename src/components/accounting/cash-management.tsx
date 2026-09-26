'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Calculator, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CashClosing } from '@/lib/accounting-types';

interface CashManagementProps {
  cashBalance: number;
  cashClosings: CashClosing[];
  onRecordCashClosing: (closingData: Omit<CashClosing, 'id' | 'createdAt'>) => Promise<void>;
  userName?: string;
}

const CURRENCY_DENOMINATIONS = ['500', '200', '100', '50', '20', '10', '5', '2', '1'];

export function CashManagement({
  cashBalance,
  cashClosings,
  onRecordCashClosing,
  userName = 'Accounts Staff',
}: CashManagementProps) {
  const [isClosingOpen, setIsClosingOpen] = useState<boolean>(false);
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '2': 0,
    '1': 0,
  });
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const physicalTotal = Object.entries(denominations).reduce((sum, [denom, count]) => {
    return sum + Number(denom) * (Number(count) || 0);
  }, 0);

  const cashDifference = physicalTotal - cashBalance;

  const handleDenomChange = (denom: string, countStr: string) => {
    const val = parseInt(countStr, 10) || 0;
    setDenominations({ ...denominations, [denom]: val });
  };

  const handleClosingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onRecordCashClosing({
        collegeId: '',
        date: new Date().toISOString().split('T')[0],
        openingBalance: cashBalance,
        totalCashIn: 0,
        totalCashOut: 0,
        calculatedClosingBalance: cashBalance,
        actualPhysicalCash: physicalTotal,
        difference: cashDifference,
        denominations,
        closedBy: userName,
        notes,
      });

      setIsClosingOpen(false);
    } catch (err) {
      console.error('Failed to save cash closing:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-amber-600" /> Cash & Petty Cash Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Cash book register, physical cash denomination counter, and daily cash closing audit reconciliation.
          </p>
        </div>

        <Dialog open={isClosingOpen} onOpenChange={setIsClosingOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Calculator className="h-4 w-4" /> Daily Cash Closing Audit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Physical Cash Denomination Counter</DialogTitle>
              <DialogDescription>Count physical currency notes in safe box against ledger cash balance.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleClosingSubmit} className="space-y-4 pt-2">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm flex justify-between font-bold text-amber-900">
                <span>Calculated System Balance:</span>
                <span>₹{cashBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>

              {/* Denomination Inputs */}
              <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
                <div className="text-xs font-bold uppercase text-slate-700 mb-2">Currency Denomination Breakdown</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {CURRENCY_DENOMINATIONS.map((d) => (
                    <div key={d} className="flex items-center gap-2 bg-white p-2 border rounded-md">
                      <span className="font-bold text-slate-800 w-16">₹{d} &times;</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Count"
                        className="h-8 text-xs font-mono"
                        value={denominations[d] || ''}
                        onChange={(e) => handleDenomChange(d, e.target.value)}
                      />
                      <span className="font-mono text-slate-500 w-20 text-right">
                        = ₹{(Number(d) * (denominations[d] || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-lg space-y-2">
                <div className="flex justify-between font-bold text-base">
                  <span>Physical Cash Counted:</span>
                  <span className="text-emerald-400 font-mono">₹{physicalTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-700">
                  <span>Audit Variance / Difference:</span>
                  <span className={cashDifference === 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {cashDifference === 0 ? 'Exact Match (₹0.00)' : `₹${cashDifference.toFixed(2)}`}
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="cash-notes">Closing Notes / Discrepancy Reason</Label>
                <Input id="cash-notes" placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsClosingOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {isSubmitting ? 'Saving Closing...' : 'Save Daily Cash Closing'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Cash Balance Banner */}
      <Card className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 text-white shadow-lg">
        <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="text-amber-100 text-xs font-semibold uppercase tracking-wider">Current Counter Cash Balance</div>
            <div className="text-4xl font-black font-mono tracking-tight mt-1">
              ₹{cashBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-amber-100 text-xs mt-1">Verified double-entry cash ledger in hand.</p>
          </div>
          <Badge className="bg-white/20 text-white text-sm px-4 py-2 border-white/30 backdrop-blur-md">Active Cash Box</Badge>
        </CardContent>
      </Card>

      {/* Cash Closings History */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold font-headline">Recent Cash Closings History</CardTitle>
          <CardDescription>Daily physical cash audits and denomination logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Closing Date</th>
                  <th className="p-3">Closed By</th>
                  <th className="p-3 text-right">System Balance (₹)</th>
                  <th className="p-3 text-right">Physical Counted (₹)</th>
                  <th className="p-3 text-right">Variance / Diff (₹)</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cashClosings.length > 0 ? (
                  cashClosings.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{c.date}</td>
                      <td className="p-3 text-slate-700">{c.closedBy}</td>
                      <td className="p-3 text-right font-mono text-slate-700">₹{c.calculatedClosingBalance.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-800">₹{c.actualPhysicalCash.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        {c.difference === 0 ? (
                          <span className="text-emerald-600">₹0.00</span>
                        ) : (
                          <span className="text-rose-600">₹{c.difference.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {c.difference === 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800">VERIFIED MATCH</Badge>
                        ) : (
                          <Badge variant="destructive">DISCREPANCY</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No physical cash closings audited yet.
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
