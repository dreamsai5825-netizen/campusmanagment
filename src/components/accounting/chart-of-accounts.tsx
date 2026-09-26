'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Plus, FolderTree, Landmark, Wallet, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Account, AccountType, AccountGroup } from '@/lib/accounting-types';

interface ChartOfAccountsProps {
  accounts: Account[];
  onAddAccount: (acc: Omit<Account, 'id' | 'collegeId' | 'createdAt'>) => Promise<void>;
}

const ACCOUNT_GROUPS_BY_TYPE: Record<AccountType, AccountGroup[]> = {
  asset: ['Current Assets', 'Fixed Assets', 'Bank Accounts', 'Cash Accounts', 'Student Receivables'],
  liability: ['Current Liabilities', 'Vendor Payables', 'Loans & Borrowings', 'Tax Liabilities'],
  equity: ['Capital & Equity', 'Retained Earnings'],
  income: ['Direct Income', 'Indirect Income', 'Fee Revenue'],
  expense: ['Operating Expenses', 'Administrative Expenses', 'Payroll Expenses', 'Maintenance Expenses'],
};

export function ChartOfAccounts({ accounts, onAddAccount }: ChartOfAccountsProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Form State
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<AccountType>('asset');
  const [group, setGroup] = useState<AccountGroup>('Current Assets');
  const [parentId, setParentId] = useState<string>('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredAccounts = accounts.filter((acc) => {
    const matchesTab = activeTab === 'all' || acc.type === activeTab;
    const matchesSearch =
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.group.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    setIsSubmitting(true);
    try {
      await onAddAccount({
        code,
        name,
        type,
        group,
        parentId: parentId || null,
        openingBalance: Number(openingBalance) || 0,
        currentBalance: Number(openingBalance) || 0,
        description,
      });
      setCode('');
      setName('');
      setOpeningBalance(0);
      setDescription('');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Error adding account:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (accType: AccountType) => {
    switch (accType) {
      case 'asset':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">ASSET</Badge>;
      case 'liability':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">LIABILITY</Badge>;
      case 'equity':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300">EQUITY</Badge>;
      case 'income':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">INCOME</Badge>;
      case 'expense':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300">EXPENSE</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary" /> Chart of Accounts
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage Asset, Liability, Equity, Income, and Expense account ledgers with parent-child hierarchy.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Ledger Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Ledger Account</DialogTitle>
              <DialogDescription>Define code, group, opening balance, and parent account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="acc-code">Account Code *</Label>
                  <Input id="acc-code" placeholder="e.g. 1007" value={code} onChange={(e) => setCode(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="acc-type">Account Type *</Label>
                  <Select
                    value={type}
                    onValueChange={(val: AccountType) => {
                      setType(val);
                      setGroup(ACCOUNT_GROUPS_BY_TYPE[val][0]);
                    }}
                  >
                    <SelectTrigger id="acc-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem>
                      <SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="acc-name">Account Name *</Label>
                <Input id="acc-name" placeholder="e.g. Science Lab Maintenance" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="acc-group">Account Group</Label>
                  <Select value={group} onValueChange={(val: AccountGroup) => setGroup(val)}>
                    <SelectTrigger id="acc-group">
                      <SelectValue placeholder="Group" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_GROUPS_BY_TYPE[type].map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="acc-parent">Parent Account (Optional)</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger id="acc-parent">
                      <SelectValue placeholder="None (Root level)" />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="max-h-48">
                      <SelectItem value="">None (Root level)</SelectItem>
                      {accounts
                        .filter((a) => a.type === type)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="acc-op">Opening Balance (₹)</Label>
                <Input id="acc-op" type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)} />
              </div>

              <div>
                <Label htmlFor="acc-desc">Description</Label>
                <Input id="acc-desc" placeholder="Operational notes" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs & Search Filter */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-6 sm:inline-flex h-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="asset">Assets</TabsTrigger>
                <TabsTrigger value="liability">Liabilities</TabsTrigger>
                <TabsTrigger value="equity">Equity</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="expense">Expenses</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, name, group..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Code</th>
                  <th className="p-3">Account Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Group</th>
                  <th className="p-3 text-right">Opening Bal (₹)</th>
                  <th className="p-3 text-right">Current Balance (₹)</th>
                  <th className="p-3 text-center">System Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-800">{acc.code}</td>
                      <td className="p-3 font-medium text-slate-900">
                        {acc.parentId ? <span className="text-slate-400 mr-2">└─</span> : null}
                        {acc.name}
                      </td>
                      <td className="p-3">{getTypeBadge(acc.type)}</td>
                      <td className="p-3 text-slate-600 font-medium">{acc.group}</td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        ₹{(acc.openingBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{(acc.currentBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        {acc.isSystem ? (
                          <Badge variant="secondary" className="text-[10px]">SYSTEM DEFAULT</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">CUSTOM</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No matching ledger accounts found.
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
