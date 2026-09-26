'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wallet, Plus, Printer, CheckCircle, Search, FileText } from 'lucide-react';
import type { PayrollRecord, Account } from '@/lib/accounting-types';
import type { Teacher } from '@/lib/types';
import { printPayslip, type AccountingCollegeInfo } from '@/lib/accounting-export';

interface PayrollAccountingProps {
  payrolls: PayrollRecord[];
  teachers: Teacher[];
  accounts: Account[];
  onProcessPayroll: (payrollData: Omit<PayrollRecord, 'id' | 'createdAt'>) => Promise<void>;
  collegeName?: string;
  college?: AccountingCollegeInfo | string;
}

export function PayrollAccounting({
  payrolls,
  teachers,
  accounts,
  onProcessPayroll,
  collegeName,
  college,
}: PayrollAccountingProps) {
  const activeCollege = college || collegeName || 'Institution';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Form state
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [monthYear, setMonthYear] = useState<string>('2025-03');
  const [basicSalary, setBasicSalary] = useState<number>(35000);
  const [allowances, setAllowances] = useState<number>(5000);
  const [tdsDeduction, setTdsDeduction] = useState<number>(1000);
  const [pfDeduction, setPfDeduction] = useState<number>(1800);
  const [professionalTax, setProfessionalTax] = useState<number>(200);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const grossSalary = Number(basicSalary) + Number(allowances);
  const totalDeductions = Number(tdsDeduction) + Number(pfDeduction) + Number(professionalTax) + Number(otherDeductions);
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  const filteredPayrolls = payrolls.filter(
    (p) =>
      p.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.monthYear.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    setIsSubmitting(true);
    try {
      await onProcessPayroll({
        collegeId: '',
        employeeId: selectedTeacher.id,
        employeeName: selectedTeacher.name,
        employeeRole: selectedTeacher.department || 'Faculty',
        monthYear,
        basicSalary: Number(basicSalary),
        allowances: Number(allowances),
        grossSalary,
        tdsDeduction: Number(tdsDeduction),
        pfDeduction: Number(pfDeduction),
        professionalTax: Number(professionalTax),
        otherDeductions: Number(otherDeductions),
        totalDeductions,
        netSalary,
        paymentStatus: 'paid',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMode: 'Bank Transfer',
      });

      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to process payroll:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-purple-600" /> Salary & Payroll Accounting
          </h2>
          <p className="text-muted-foreground text-sm">
            Process monthly employee & teacher salaries, statutory tax deductions (TDS/PF/PT), salary register, and printable payslips.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4" /> Process Salary Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Process Employee Salary</DialogTitle>
              <DialogDescription>Generates payroll ledger vouchers & printable employee payslip.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pay-emp">Select Employee *</Label>
                  <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                    <SelectTrigger id="pay-emp">
                      <SelectValue placeholder="Choose Staff / Faculty" />
                    </SelectTrigger>
                    <SelectContent side="bottom" className="max-h-56">
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.department || 'Faculty'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="pay-month">Pay Month (YYYY-MM) *</Label>
                  <Input id="pay-month" placeholder="2025-03" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pay-basic">Basic Salary (₹) *</Label>
                  <Input id="pay-basic" type="number" step="0.01" value={basicSalary || ''} onChange={(e) => setBasicSalary(parseFloat(e.target.value) || 0)} required />
                </div>

                <div>
                  <Label htmlFor="pay-allow">Allowances / HRA (₹)</Label>
                  <Input id="pay-allow" type="number" step="0.01" value={allowances || ''} onChange={(e) => setAllowances(parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t pt-3">
                <div>
                  <Label htmlFor="pay-tds" className="text-xs">TDS (₹)</Label>
                  <Input id="pay-tds" type="number" step="0.01" value={tdsDeduction || ''} onChange={(e) => setTdsDeduction(parseFloat(e.target.value) || 0)} />
                </div>

                <div>
                  <Label htmlFor="pay-pf" className="text-xs">PF (₹)</Label>
                  <Input id="pay-pf" type="number" step="0.01" value={pfDeduction || ''} onChange={(e) => setPfDeduction(parseFloat(e.target.value) || 0)} />
                </div>

                <div>
                  <Label htmlFor="pay-pt" className="text-xs">Prof Tax (₹)</Label>
                  <Input id="pay-pt" type="number" step="0.01" value={professionalTax || ''} onChange={(e) => setProfessionalTax(parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Gross Salary:</span> <strong>₹{grossSalary.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Total Deductions:</span> <strong>- ₹{totalDeductions.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between font-bold text-sm text-purple-900 border-t pt-1">
                  <span>Net Payable Salary:</span> <span>₹{netSalary.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {isSubmitting ? 'Processing...' : 'Disburse & Generate Payslip'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Salary Register */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employee or month..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300">
              {filteredPayrolls.length} Salary Disbursements
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Role / Department</th>
                  <th className="p-3">Month</th>
                  <th className="p-3 text-right">Gross (₹)</th>
                  <th className="p-3 text-right">Deductions (₹)</th>
                  <th className="p-3 text-right">Net Salary (₹)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPayrolls.length > 0 ? (
                  filteredPayrolls.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{p.employeeName}</td>
                      <td className="p-3 text-slate-600">{p.employeeRole}</td>
                      <td className="p-3 font-mono text-slate-700">{p.monthYear}</td>
                      <td className="p-3 text-right font-mono text-slate-800">₹{p.grossSalary.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono text-rose-700">₹{p.totalDeductions.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-mono font-bold text-purple-900">
                        ₹{p.netSalary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => printPayslip(p, activeCollege)}>
                          <Printer className="h-3.5 w-3.5 text-slate-600" /> Payslip
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No payroll disbursements recorded yet.
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
