'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Landmark, Plus, ArrowLeftRight, CheckCircle2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { BankAccount, BankTransaction, Account } from '@/lib/accounting-types';

interface BankManagementProps {
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  accounts: Account[];
  onAddBankAccount: (bank: Omit<BankAccount, 'id' | 'collegeId' | 'createdAt'>) => Promise<void>;
  onBankTransfer: (sourceBankId: string, targetBankId: string, amount: number, desc: string) => Promise<void>;
}

export function BankManagement({
  bankAccounts,
  bankTransactions,
  accounts,
  onAddBankAccount,
  onBankTransfer,
}: BankManagementProps) {
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [isTransferOpen, setIsTransferOpen] = useState<boolean>(false);

  // Add Bank state
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('');
  const [accountType, setAccountType] = useState<BankAccount['accountType']>('Current');
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Transfer State
  const [sourceBankId, setSourceBankId] = useState<string>('');
  const [targetBankId, setTargetBankId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferDesc, setTransferDesc] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountNumber) return;
    setIsSubmitting(true);
    try {
      await onAddBankAccount({
        bankName,
        accountNumber,
        ifscCode,
        branchName,
        accountType,
        openingBalance: Number(openingBalance) || 0,
        currentBalance: Number(openingBalance) || 0,
      });

      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setBranchName('');
      setIsAddOpen(false);
    } catch (err) {
      console.error('Failed to add bank account:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceBankId || !targetBankId || transferAmount <= 0) return;
    setIsSubmitting(true);
    try {
      await onBankTransfer(sourceBankId, targetBankId, Number(transferAmount), transferDesc);
      setTransferAmount(0);
      setTransferDesc('');
      setIsTransferOpen(false);
    } catch (err) {
      console.error('Failed bank transfer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-blue-600" /> Bank Account & Reconciliation Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Institutional bank accounts, deposits, withdrawals, inter-bank transfers, and bank statement reconciliations.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-slate-300">
                <ArrowLeftRight className="h-4 w-4" /> Inter-Bank Transfer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Inter-Bank Fund Transfer</DialogTitle>
                <DialogDescription>Transfer funds between institutional bank accounts via Contra voucher.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleTransferSubmit} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="t-source">Source Bank Account *</Label>
                  <Select value={sourceBankId} onValueChange={setSourceBankId}>
                    <SelectTrigger id="t-source">
                      <SelectValue placeholder="From Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bankName} - {b.accountNumber} (Bal: ₹{b.currentBalance.toLocaleString('en-IN')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="t-target">Target Bank Account *</Label>
                  <Select value={targetBankId} onValueChange={setTargetBankId}>
                    <SelectTrigger id="t-target">
                      <SelectValue placeholder="To Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bankName} - {b.accountNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="t-amount">Transfer Amount (₹) *</Label>
                  <Input id="t-amount" type="number" step="0.01" value={transferAmount || ''} onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)} required />
                </div>

                <div>
                  <Label htmlFor="t-desc">Transfer Description</Label>
                  <Input id="t-desc" placeholder="e.g. Treasury sweep transfer" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsTransferOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSubmitting ? 'Transferring...' : 'Execute Transfer'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4" /> Add Bank Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Register New Bank Account</DialogTitle>
                <DialogDescription>Link institutional savings or current accounts.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="b-name">Bank Name *</Label>
                  <Input id="b-name" placeholder="e.g. State Bank of India / HDFC" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="b-no">Account Number *</Label>
                  <Input id="b-no" placeholder="e.g. 39810293841" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="b-ifsc">IFSC Code</Label>
                    <Input id="b-ifsc" placeholder="SBIN0001234" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="b-type">Account Type</Label>
                    <Select value={accountType} onValueChange={(val: any) => setAccountType(val)}>
                      <SelectTrigger id="b-type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Current">Current Account</SelectItem>
                        <SelectItem value="Savings">Savings Account</SelectItem>
                        <SelectItem value="Fixed Deposit">Fixed Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="b-branch">Branch Name</Label>
                  <Input id="b-branch" placeholder="Main Campus Branch" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
                </div>

                <div>
                  <Label htmlFor="b-op">Opening Balance (₹)</Label>
                  <Input id="b-op" type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSubmitting ? 'Saving...' : 'Add Account'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bank Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bankAccounts.map((b) => (
          <Card key={b.id} className="border shadow-sm bg-gradient-to-br from-white to-blue-50/50">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base font-bold font-headline text-blue-950">{b.bankName}</CardTitle>
                  <CardDescription className="font-mono text-xs text-slate-500">{b.accountNumber}</CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 text-[10px]">{b.accountType}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-xs text-slate-500">IFSC: {b.ifscCode || 'N/A'} | Branch: {b.branchName || 'Main'}</div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600">Ledger Balance:</span>
                <span className="text-xl font-black font-mono text-blue-900">₹{b.currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
