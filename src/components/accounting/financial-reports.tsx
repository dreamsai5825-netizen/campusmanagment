'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart3, Download, FileSpreadsheet, Printer, Scale, PieChart, Landmark, Wallet, CheckCircle2 } from 'lucide-react';
import type { Account, Voucher, StudentFeePayment, ExpenseRecord, IncomeRecord, PayrollRecord, Vendor } from '@/lib/accounting-types';
import type { Student } from '@/lib/types';
import { exportToExcel, exportToCSV } from '@/lib/accounting-export';

interface FinancialReportsProps {
  accounts: Account[];
  vouchers: Voucher[];
  feePayments: StudentFeePayment[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  payrolls: PayrollRecord[];
  vendors: Vendor[];
  students: Student[];
  collegeName?: string;
}

export function FinancialReports({
  accounts,
  vouchers,
  feePayments,
  expenses,
  incomes,
  payrolls,
  vendors,
  students,
  collegeName = 'Campus ERP',
}: FinancialReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<string>('trial-balance');

  // Compute Trial Balance
  const trialBalanceAccounts = accounts.map((acc) => {
    let debitBal = 0;
    let creditBal = 0;
    const bal = acc.currentBalance || 0;

    if (acc.type === 'asset' || acc.type === 'expense') {
      if (bal >= 0) debitBal = bal;
      else creditBal = Math.abs(bal);
    } else {
      if (bal >= 0) creditBal = bal;
      else debitBal = Math.abs(bal);
    }
    return { ...acc, debitBal, creditBal };
  });

  const totalTrialDebit = trialBalanceAccounts.reduce((sum, a) => sum + a.debitBal, 0);
  const totalTrialCredit = trialBalanceAccounts.reduce((sum, a) => sum + a.creditBal, 0);
  const isTrialBalanced = Math.abs(totalTrialDebit - totalTrialCredit) < 0.01;

  // Compute P&L
  const totalRevenue = accounts.filter((a) => a.type === 'income').reduce((sum, a) => sum + Math.abs(a.currentBalance || 0), 0);
  const totalOperationalExpenses = accounts.filter((a) => a.type === 'expense').reduce((sum, a) => sum + Math.abs(a.currentBalance || 0), 0);
  const netProfitLoss = totalRevenue - totalOperationalExpenses;

  // Compute Balance Sheet
  const totalAssets = accounts.filter((a) => a.type === 'asset').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalLiabilities = accounts.filter((a) => a.type === 'liability').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalEquity = accounts.filter((a) => a.type === 'equity').reduce((sum, a) => sum + (a.currentBalance || 0), 0) + netProfitLoss;

  const handleExportReportExcel = (reportName: string, data: any[]) => {
    exportToExcel(data, `${reportName}_Report`);
  };

  const handlePrintWindow = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Financial Reports & Audited Statements
          </h2>
          <p className="text-muted-foreground text-sm">
            Trial Balance, Profit & Loss, Balance Sheet, Cash/Bank Books, Fee Dues & Payroll Statements with PDF/Excel export.
          </p>
        </div>

        <Button onClick={handlePrintWindow} variant="outline" className="gap-2 border-slate-300">
          <Printer className="h-4 w-4" /> Print Current Statement
        </Button>
      </div>

      <Tabs value={activeReportTab} onValueChange={setActiveReportTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cash-book">Cash Book</TabsTrigger>
          <TabsTrigger value="bank-book">Bank Book</TabsTrigger>
          <TabsTrigger value="fee-report">Fee Collection</TabsTrigger>
          <TabsTrigger value="payroll-report">Salary Register</TabsTrigger>
        </TabsList>

        {/* 1. Trial Balance */}
        <TabsContent value="trial-balance" className="mt-4 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold font-headline">Trial Balance Statement</CardTitle>
                <CardDescription>Consolidated ledger trial balance as of today</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isTrialBalanced ? (
                  <Badge className="bg-emerald-600 text-white gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> BALANCED (Debits = Credits)
                  </Badge>
                ) : (
                  <Badge variant="destructive">UNBALANCED</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() =>
                    handleExportReportExcel(
                      'Trial_Balance',
                      trialBalanceAccounts.map((a) => ({
                        Code: a.code,
                        Account: a.name,
                        Type: a.type.toUpperCase(),
                        Group: a.group,
                        'Debit (₹)': a.debitBal,
                        'Credit (₹)': a.creditBal,
                      }))
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Excel
                </Button>
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
                      <th className="p-3 text-right">Debit Balance (₹)</th>
                      <th className="p-3 text-right">Credit Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trialBalanceAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-slate-800">{acc.code}</td>
                        <td className="p-3 font-medium text-slate-900">{acc.name}</td>
                        <td className="p-3 text-xs text-slate-500 uppercase">{acc.type}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-800">
                          {acc.debitBal > 0 ? `₹${acc.debitBal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-blue-800">
                          {acc.creditBal > 0 ? `₹${acc.creditBal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-black border-t-2 text-slate-900">
                      <td colSpan={3} className="p-3 text-right uppercase">Total Trial Balance:</td>
                      <td className="p-3 text-right font-mono text-emerald-900">₹{totalTrialDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-mono text-blue-900">₹{totalTrialCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Profit & Loss */}
        <TabsContent value="profit-loss" className="mt-4 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold font-headline">Profit & Loss Statement (Income & Expense)</CardTitle>
                <CardDescription>Institutional net operating surplus / deficit summary</CardDescription>
              </div>
              <Badge className={netProfitLoss >= 0 ? 'bg-emerald-600 text-white text-sm' : 'bg-rose-600 text-white text-sm'}>
                {netProfitLoss >= 0 ? `NET SURPLUS: ₹${netProfitLoss.toLocaleString('en-IN')}` : `NET DEFICIT: ₹${Math.abs(netProfitLoss).toLocaleString('en-IN')}`}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Revenue Side */}
                <div className="border rounded-xl p-4 bg-emerald-50/50 space-y-3">
                  <div className="font-bold text-emerald-900 border-b border-emerald-200 pb-2 text-base">OPERATIONAL REVENUE (INCOME)</div>
                  {accounts.filter((a) => a.type === 'income').map((a) => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="text-slate-800">{a.name}</span>
                      <span className="font-mono font-bold text-emerald-800">₹{Math.abs(a.currentBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="border-t border-emerald-300 pt-2 flex justify-between font-extrabold text-base text-emerald-950">
                    <span>Total Income:</span>
                    <span>₹{totalRevenue.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Expense Side */}
                <div className="border rounded-xl p-4 bg-rose-50/50 space-y-3">
                  <div className="font-bold text-rose-900 border-b border-rose-200 pb-2 text-base">OPERATIONAL EXPENSES</div>
                  {accounts.filter((a) => a.type === 'expense').map((a) => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="text-slate-800">{a.name}</span>
                      <span className="font-mono font-bold text-rose-800">₹{Math.abs(a.currentBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="border-t border-rose-300 pt-2 flex justify-between font-extrabold text-base text-rose-950">
                    <span>Total Expenses:</span>
                    <span>₹{totalOperationalExpenses.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Balance Sheet */}
        <TabsContent value="balance-sheet" className="mt-4 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold font-headline">Institutional Balance Sheet</CardTitle>
                <CardDescription>Assets vs Liabilities & Capital Reserves</CardDescription>
              </div>
              <Badge className="bg-slate-900 text-white text-xs">ASSETS = LIABILITIES + EQUITY</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets */}
                <div className="border rounded-xl p-4 bg-blue-50/40 space-y-3">
                  <div className="font-bold text-blue-900 border-b border-blue-200 pb-2 text-base">ASSETS</div>
                  {accounts.filter((a) => a.type === 'asset').map((a) => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="text-slate-800">{a.name} ({a.group})</span>
                      <span className="font-mono font-bold text-blue-900">₹{(a.currentBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="border-t border-blue-300 pt-2 flex justify-between font-black text-base text-blue-950">
                    <span>Total Assets:</span>
                    <span>₹{totalAssets.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="border rounded-xl p-4 bg-purple-50/40 space-y-3">
                  <div className="font-bold text-purple-900 border-b border-purple-200 pb-2 text-base">LIABILITIES & EQUITY</div>
                  {accounts.filter((a) => a.type === 'liability' || a.type === 'equity').map((a) => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="text-slate-800">{a.name}</span>
                      <span className="font-mono font-bold text-purple-900">₹{(a.currentBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm text-emerald-800 font-semibold italic">
                    <span>Current Year Surplus (P&L):</span>
                    <span>₹{netProfitLoss.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-purple-300 pt-2 flex justify-between font-black text-base text-purple-950">
                    <span>Total Liabilities & Equity:</span>
                    <span>₹{(totalLiabilities + totalEquity).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Cash Book */}
        <TabsContent value="cash-book" className="mt-4 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold font-headline">Cash Book Register</CardTitle>
                <CardDescription>Daily cash inflows and outflows</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-3">Date</th>
                      <th className="p-3">Voucher #</th>
                      <th className="p-3">Particulars</th>
                      <th className="p-3 text-right">Cash In (Debit ₹)</th>
                      <th className="p-3 text-right">Cash Out (Credit ₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-slate-600">{v.date}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">{v.voucherNo}</td>
                        <td className="p-3 text-slate-900 font-medium">{v.particulars}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                          {v.type === 'receipt' ? `₹${v.totalAmount.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-rose-700">
                          {v.type === 'payment' ? `₹${v.totalAmount.toLocaleString('en-IN')}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Bank Book */}
        <TabsContent value="bank-book" className="mt-4 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold font-headline">Bank Book Register</CardTitle>
              <CardDescription>Bank deposits, online collections & transfer ledger</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-600 p-4">
                Detailed bank book register tracks all online fee receipts, NEFT vendor disbursements, and inter-bank transfers.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Fee Collection Report */}
        <TabsContent value="fee-report" className="mt-4 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold font-headline">Fee Collection & Dues Report</CardTitle>
                <CardDescription>Student-wise collection history & pending balances</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() =>
                  handleExportReportExcel(
                    'Fee_Collection',
                    feePayments.map((fp) => ({
                      Receipt: fp.receiptNo,
                      Student: fp.studentName,
                      USN: fp.studentUsn || 'N/A',
                      Category: fp.category,
                      Date: fp.date,
                      Mode: fp.paymentMode,
                      Amount: fp.netAmount,
                    }))
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Net Paid (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {feePayments.map((fp) => (
                      <tr key={fp.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-emerald-800">{fp.receiptNo}</td>
                        <td className="p-3 font-medium text-slate-900">{fp.studentName}</td>
                        <td className="p-3 text-slate-600">{fp.category}</td>
                        <td className="p-3 text-slate-600">{fp.date}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">₹{fp.netAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. Salary Register */}
        <TabsContent value="payroll-report" className="mt-4 space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold font-headline">Salary Disbursement Register</CardTitle>
                <CardDescription>Faculty & staff monthly payroll summary</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() =>
                  handleExportReportExcel(
                    'Salary_Register',
                    payrolls.map((p) => ({
                      Employee: p.employeeName,
                      Role: p.employeeRole,
                      Month: p.monthYear,
                      Gross: p.grossSalary,
                      Deductions: p.totalDeductions,
                      NetPay: p.netSalary,
                    }))
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-3">Employee Name</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Month</th>
                      <th className="p-3 text-right">Gross (₹)</th>
                      <th className="p-3 text-right">Deductions (₹)</th>
                      <th className="p-3 text-right">Net Salary (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payrolls.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-medium text-slate-900">{p.employeeName}</td>
                        <td className="p-3 text-slate-600">{p.employeeRole}</td>
                        <td className="p-3 font-mono text-slate-700">{p.monthYear}</td>
                        <td className="p-3 text-right font-mono text-slate-800">₹{p.grossSalary.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono text-rose-700">₹{p.totalDeductions.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono font-bold text-purple-900">₹{p.netSalary.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
