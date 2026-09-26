'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Receipt,
  FileText,
  CreditCard,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { FinancialSummaryMetrics, Voucher, StudentFeePayment } from '@/lib/accounting-types';

interface AccountingDashboardProps {
  metrics: FinancialSummaryMetrics;
  recentVouchers: Voucher[];
  recentFeePayments: StudentFeePayment[];
  onOpenAction: (action: string) => void;
  onRefresh: () => void;
}

export function AccountingDashboard({
  metrics,
  recentVouchers,
  recentFeePayments,
  onOpenAction,
  onRefresh,
}: AccountingDashboardProps) {
  const chartData = [
    { month: 'Apr', income: metrics.totalIncome * 0.12, expense: metrics.totalExpenses * 0.14 },
    { month: 'May', income: metrics.totalIncome * 0.15, expense: metrics.totalExpenses * 0.11 },
    { month: 'Jun', income: metrics.totalIncome * 0.18, expense: metrics.totalExpenses * 0.16 },
    { month: 'Jul', income: metrics.totalIncome * 0.22, expense: metrics.totalExpenses * 0.19 },
    { month: 'Aug', income: metrics.totalIncome * 0.19, expense: metrics.totalExpenses * 0.22 },
    { month: 'Current', income: metrics.totalIncome * 0.14, expense: metrics.totalExpenses * 0.18 },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight">Accounting & Financial Hub</h2>
          <p className="text-blue-200 text-sm mt-1">
            Real-time double-entry ledger, automated voucher generation & complete financial visibility.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onOpenAction('collect-fee')} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium">
            <Receipt className="h-4 w-4" /> Collect Fee
          </Button>
          <Button onClick={() => onOpenAction('new-expense')} className="bg-rose-600 hover:bg-rose-700 text-white gap-2 font-medium">
            <TrendingDown className="h-4 w-4" /> New Expense
          </Button>
          <Button onClick={() => onOpenAction('create-voucher')} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-medium">
            <FileText className="h-4 w-4" /> Create Voucher
          </Button>
          <Button onClick={onRefresh} variant="outline" size="icon" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Income */}
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50/70 border-emerald-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              Total Income
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-900">
              ₹{metrics.totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
              <ArrowUpRight className="h-3 w-3" /> All fee & direct income
            </p>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50/70 border-rose-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-rose-800 uppercase tracking-wider flex items-center justify-between">
              Total Expenses
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-rose-900">
              ₹{metrics.totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-rose-700 mt-1 flex items-center gap-1 font-medium">
              <ArrowDownRight className="h-3 w-3" /> Operational & payroll expenses
            </p>
          </CardContent>
        </Card>

        {/* Cash in Hand */}
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50/70 border-amber-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center justify-between">
              Cash In Hand
              <Wallet className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-amber-900">
              ₹{metrics.cashInHand.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-amber-700 mt-1 font-medium">
              Counter cash & petty cash box
            </p>
          </CardContent>
        </Card>

        {/* Bank Balance */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50/70 border-blue-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-blue-800 uppercase tracking-wider flex items-center justify-between">
              Bank Balance
              <Landmark className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-blue-900">
              ₹{metrics.bankBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-blue-700 mt-1 font-medium">
              Combined institutional accounts
            </p>
          </CardContent>
        </Card>

        {/* Pending Fee Collection */}
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50/70 border-orange-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-orange-800 uppercase tracking-wider flex items-center justify-between">
              Pending Fees
              <Clock className="h-4 w-4 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-orange-900">
              ₹{metrics.pendingFeeCollection.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-orange-700 mt-1 font-medium">
              Outstanding student fee receivables
            </p>
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50/70 border-purple-200 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-purple-800 uppercase tracking-wider flex items-center justify-between">
              Vendor Dues
              <CreditCard className="h-4 w-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-purple-900">
              ₹{metrics.pendingPayments.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-purple-700 mt-1 font-medium">
              Unpaid vendor purchase bills
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart & Recent Transactions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expense Chart */}
        <Card className="lg:col-span-2 shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-bold font-headline">Monthly Income vs Expense Trend</CardTitle>
              <CardDescription>Financial comparison across recent months</CardDescription>
            </div>
            <Badge variant="outline" className="bg-slate-100 text-slate-700">FY 2025-2026</Badge>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val / 1000}k`} />
                  <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} />
                  <Legend />
                  <Bar dataKey="income" name="Income (₹)" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense (₹)" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="shadow-sm border">
          <CardHeader>
            <CardTitle className="text-lg font-bold font-headline">Frequent Actions</CardTitle>
            <CardDescription>Shortcuts to key accounting tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => onOpenAction('collect-fee')} variant="outline" className="w-full justify-start gap-3 h-12 hover:bg-emerald-50 hover:border-emerald-300">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Student Fee Collection</div>
                <div className="text-xs text-muted-foreground">Record student fee payment & issue receipt</div>
              </div>
            </Button>

            <Button onClick={() => onOpenAction('create-voucher')} variant="outline" className="w-full justify-start gap-3 h-12 hover:bg-indigo-50 hover:border-indigo-300">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Create Double-Entry Voucher</div>
                <div className="text-xs text-muted-foreground">Receipt, Payment, Journal, Contra</div>
              </div>
            </Button>

            <Button onClick={() => onOpenAction('payroll')} variant="outline" className="w-full justify-start gap-3 h-12 hover:bg-purple-50 hover:border-purple-300">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Process Staff Payroll</div>
                <div className="text-xs text-muted-foreground">Process monthly salaries & issue payslips</div>
              </div>
            </Button>

            <Button onClick={() => onOpenAction('reports')} variant="outline" className="w-full justify-start gap-3 h-12 hover:bg-blue-50 hover:border-blue-300">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Landmark className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Generate Financial Reports</div>
                <div className="text-xs text-muted-foreground">Trial balance, P&L, Balance Sheet</div>
              </div>
            </Button>

            <Link href="/account-manager-dashboard/profile" className="block">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 hover:bg-slate-100 hover:border-slate-300">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Account Manager Profile</div>
                  <div className="text-xs text-muted-foreground">Profile photo, credentials & settings</div>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions / Vouchers Feed */}
      <Card className="shadow-sm border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold font-headline">Recent Accounting Vouchers</CardTitle>
            <CardDescription>Latest double-entry posted vouchers and receipts</CardDescription>
          </div>
          <Button onClick={() => onOpenAction('vouchers')} variant="ghost" className="text-xs font-semibold text-primary">
            View All Vouchers &rarr;
          </Button>
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
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentVouchers.length > 0 ? (
                  recentVouchers.slice(0, 5).map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-800">{v.voucherNo}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            v.type === 'receipt'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : v.type === 'payment'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : v.type === 'journal'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }
                        >
                          {v.type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600">{v.date}</td>
                      <td className="p-3 text-slate-800 max-w-xs truncate">{v.particulars}</td>
                      <td className="p-3 text-right font-semibold text-slate-900">
                        ₹{v.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={v.status === 'posted' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>
                          {v.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No accounting vouchers recorded yet. Click &quot;Create Voucher&quot; to get started.
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
