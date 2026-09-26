'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileCode, Plus, Search, RotateCcw, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import type { Voucher, Account } from '@/lib/accounting-types';

interface JournalEntriesProps {
  vouchers: Voucher[];
  accounts: Account[];
  onOpenCreateJournal: () => void;
  onReverseVoucher: (voucherId: string, reason: string) => Promise<void>;
}

export function JournalEntries({
  vouchers,
  accounts,
  onOpenCreateJournal,
  onReverseVoucher,
}: JournalEntriesProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const journalVouchers = vouchers.filter(
    (v) =>
      (v.type === 'journal' || v.particulars.toLowerCase().includes('journal')) &&
      (v.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.particulars.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FileCode className="h-6 w-6 text-purple-600" /> Journal Entries & Reversals
          </h2>
          <p className="text-muted-foreground text-sm">
            Manual & automated double-entry journal postings with debit/credit verification and reversal capabilities.
          </p>
        </div>

        <Button onClick={onOpenCreateJournal} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="h-4 w-4" /> New Journal Entry
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search journal voucher #..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300">
              {journalVouchers.length} Journal Entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {journalVouchers.length > 0 ? (
              journalVouchers.map((jv) => (
                <div key={jv.id} className="border rounded-xl p-4 bg-white hover:border-purple-300 transition-all space-y-3">
                  <div className="flex flex-wrap justify-between items-center border-b pb-2 gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-purple-900 text-base">{jv.voucherNo}</span>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">JOURNAL</Badge>
                      <span className="text-xs text-slate-500">{jv.date}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold font-mono text-slate-900">Total: ₹{jv.totalAmount.toLocaleString('en-IN')}</span>
                      <Badge variant="outline" className={jv.status === 'posted' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                        {jv.status.toUpperCase()}
                      </Badge>
                      {jv.status === 'posted' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-rose-600 hover:bg-rose-50 gap-1 h-8"
                          onClick={() => {
                            const reason = prompt(`Reason for reversing Journal Voucher ${jv.voucherNo}?`);
                            if (reason) onReverseVoucher(jv.id, reason);
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reverse Entry
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-medium text-slate-800">{jv.particulars}</div>

                  {/* Line Items Table */}
                  <div className="bg-slate-50 border rounded-lg p-2 overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b text-slate-500 font-semibold">
                          <th className="p-1.5">Account Code & Name</th>
                          <th className="p-1.5 text-right">Debit (₹)</th>
                          <th className="p-1.5 text-right">Credit (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jv.lineItems.map((line, idx) => (
                          <tr key={idx} className="border-b border-slate-200/60 last:border-none">
                            <td className="p-1.5 font-medium text-slate-800">
                              <strong>{line.accountCode}</strong> - {line.accountName}
                            </td>
                            <td className="p-1.5 text-right font-mono font-semibold text-emerald-700">
                              {line.debit > 0 ? `₹${line.debit.toLocaleString('en-IN')}` : '-'}
                            </td>
                            <td className="p-1.5 text-right font-mono font-semibold text-blue-700">
                              {line.credit > 0 ? `₹${line.credit.toLocaleString('en-IN')}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400">
                No journal entries recorded yet. Click &quot;New Journal Entry&quot; to add one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
