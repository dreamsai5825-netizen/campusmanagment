'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Search, Download, Calendar, Filter } from 'lucide-react';
import type { LedgerEntry, Account } from '@/lib/accounting-types';
import { exportToExcel, exportToCSV } from '@/lib/accounting-export';

interface GeneralLedgerProps {
  ledgers: LedgerEntry[];
  accounts: Account[];
}

export function GeneralLedger({ ledgers, accounts }: GeneralLedgerProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const filteredLedgers = ledgers.filter((item) => {
    const matchesAccount = selectedAccountId === 'all' || item.accountId === selectedAccountId;
    const matchesSearch =
      item.voucherNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.accountName.toLowerCase().includes(searchQuery.toLowerCase());

    const itemDate = new Date(item.date).getTime();
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Infinity;
    const matchesDate = itemDate >= start && itemDate <= end;

    return matchesAccount && matchesSearch && matchesDate;
  });

  const totalDebit = filteredLedgers.reduce((sum, item) => sum + (item.debit || 0), 0);
  const totalCredit = filteredLedgers.reduce((sum, item) => sum + (item.credit || 0), 0);

  const handleExportExcel = () => {
    const exportData = filteredLedgers.map((l) => ({
      Date: l.date,
      'Voucher No': l.voucherNo,
      'Voucher Type': l.voucherType.toUpperCase(),
      Account: l.accountName,
      Description: l.description,
      'Debit (₹)': l.debit,
      'Credit (₹)': l.credit,
      'Running Balance (₹)': l.balance,
    }));
    exportToExcel(exportData, `General_Ledger_${selectedAccount ? selectedAccount.name : 'All_Accounts'}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" /> General Ledger Postings
          </h2>
          <p className="text-muted-foreground text-sm">
            Account-wise complete double-entry transaction history, debit/credit postings, and running balances.
          </p>
        </div>

        <Button onClick={handleExportExcel} variant="outline" className="gap-2 border-slate-300">
          <Download className="h-4 w-4" /> Export Ledger (.xlsx)
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="gl-acc" className="text-xs font-semibold text-slate-700">Filter Account Ledger</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="gl-acc">
                  <SelectValue placeholder="All Ledger Accounts" />
                </SelectTrigger>
                <SelectContent side="bottom" className="max-h-56">
                  <SelectItem value="all">All Accounts (Consolidated)</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name} ({a.type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="gl-start" className="text-xs font-semibold text-slate-700">From Date</Label>
              <Input id="gl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="gl-end" className="text-xs font-semibold text-slate-700">To Date</Label>
              <Input id="gl-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="relative">
              <Label htmlFor="gl-search" className="text-xs font-semibold text-slate-700">Search Keywords</Label>
              <Input id="gl-search" placeholder="Voucher #, description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Account Summary Banner */}
          {selectedAccount && (
            <div className="p-4 bg-slate-100 rounded-lg mb-4 flex flex-wrap justify-between items-center text-sm gap-2">
              <div>
                <span className="font-bold text-slate-900">{selectedAccount.code} - {selectedAccount.name}</span>
                <span className="text-slate-500 ml-2">({selectedAccount.group})</span>
              </div>
              <div className="flex gap-4 font-mono font-bold">
                <span className="text-slate-700">Opening: ₹{(selectedAccount.openingBalance || 0).toLocaleString('en-IN')}</span>
                <span className="text-blue-800">Current Balance: ₹{(selectedAccount.currentBalance || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Date</th>
                  <th className="p-3">Voucher No</th>
                  <th className="p-3">Account Name</th>
                  <th className="p-3">Particulars / Description</th>
                  <th className="p-3 text-right">Debit (₹)</th>
                  <th className="p-3 text-right">Credit (₹)</th>
                  <th className="p-3 text-right">Running Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLedgers.length > 0 ? (
                  filteredLedgers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-600">{item.date}</td>
                      <td className="p-3 font-mono font-bold text-blue-900">{item.voucherNo}</td>
                      <td className="p-3 font-medium text-slate-800">{item.accountName}</td>
                      <td className="p-3 text-slate-700 max-w-xs truncate">{item.description}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                        {item.debit > 0 ? `₹${item.debit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-blue-700">
                        {item.credit > 0 ? `₹${item.credit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{(item.balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No general ledger entries found for selected criteria.
                    </td>
                  </tr>
                )}
                {filteredLedgers.length > 0 && (
                  <tr className="bg-slate-100 font-bold border-t">
                    <td colSpan={4} className="p-3 text-right">Consolidated Totals:</td>
                    <td className="p-3 text-right font-mono text-emerald-800">₹{totalDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono text-blue-800">₹{totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="p-3"></td>
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
