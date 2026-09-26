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
import { Receipt, Search, Printer, Plus, AlertCircle, CheckCircle2, RefreshCw, CreditCard, Wallet, Percent } from 'lucide-react';
import type { StudentFeePayment, FeeRefund } from '@/lib/accounting-types';
import type { Student } from '@/lib/types';
import { printFeeReceipt, type AccountingCollegeInfo } from '@/lib/accounting-export';

interface FeeAccountingProps {
  feePayments: StudentFeePayment[];
  students: Student[];
  onCollectFee: (feeData: Omit<StudentFeePayment, 'id' | 'receiptNo' | 'status' | 'createdAt'>) => Promise<void>;
  collegeName?: string;
  college?: AccountingCollegeInfo | string;
}

export function FeeAccounting({ feePayments, students, onCollectFee, collegeName, college }: FeeAccountingProps) {
  const activeCollege = college || collegeName || 'Institution';
  const [activeTab, setActiveTab] = useState<string>('collections');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCollectOpen, setIsCollectOpen] = useState<boolean>(false);

  // Form states
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [category, setCategory] = useState<StudentFeePayment['category']>('Tuition');
  const [amount, setAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<StudentFeePayment['paymentMode']>('Cash');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const filteredFeePayments = feePayments.filter(
    (fp) =>
      fp.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fp.receiptNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (fp.studentUsn && fp.studentUsn.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pendingFeeStudents = students.filter((s) => {
    const bal = s.fees?.balance || 0;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.usn && s.usn.toLowerCase().includes(searchQuery.toLowerCase()));
    return bal > 0 && matchesSearch;
  });

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || amount <= 0) return;
    setIsSubmitting(true);
    try {
      const netAmount = Math.max(0, amount - (discountAmount || 0));
      await onCollectFee({
        collegeId: '',
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentUsn: selectedStudent.usn || '',
        classId: selectedStudent.classId || '',
        className: 'Class ' + (selectedStudent.classId || ''),
        date: new Date().toISOString().split('T')[0],
        category,
        amount: Number(amount),
        discountAmount: Number(discountAmount) || 0,
        netAmount,
        paymentMode,
        referenceNo,
        remarks,
        collectedBy: 'Accounts Counter',
        academicYear: selectedStudent.academicYear || '2025-2026',
      });

      setSelectedStudentId('');
      setAmount(0);
      setDiscountAmount(0);
      setReferenceNo('');
      setRemarks('');
      setIsCollectOpen(false);
    } catch (err) {
      console.error('Failed to collect fee:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-600" /> Student Fee Accounting
          </h2>
          <p className="text-muted-foreground text-sm">
            Collect tuition & facility fees, issue official receipts, apply scholarship discounts, track pending dues.
          </p>
        </div>

        <Dialog open={isCollectOpen} onOpenChange={setIsCollectOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4" /> Collect Student Fee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Record Student Fee Payment</DialogTitle>
              <DialogDescription>Generates double-entry ledger postings and official printable receipt.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCollectSubmit} className="space-y-4 pt-2">
              <div>
                <Label htmlFor="fee-student">Select Student *</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger id="fee-student">
                    <SelectValue placeholder="Choose student by name / USN" />
                  </SelectTrigger>
                  <SelectContent side="bottom" className="max-h-56">
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.usn || 'No USN'}) - Pending Dues: ₹{(s.fees?.balance || 0).toLocaleString('en-IN')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStudent && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1 text-emerald-900">
                  <div className="font-bold">{selectedStudent.name}</div>
                  <div>USN: {selectedStudent.usn || 'N/A'} | Class ID: {selectedStudent.classId}</div>
                  <div>Total Fees: ₹{(selectedStudent.fees?.totalFees || 0).toLocaleString('en-IN')} | Paid: ₹{(selectedStudent.fees?.paid || 0).toLocaleString('en-IN')} | <span className="font-bold text-rose-700">Outstanding: ₹{(selectedStudent.fees?.balance || 0).toLocaleString('en-IN')}</span></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fee-cat">Fee Category *</Label>
                  <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                    <SelectTrigger id="fee-cat">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tuition">Tuition Fee</SelectItem>
                      <SelectItem value="Admission">Admission Fee</SelectItem>
                      <SelectItem value="Hostel">Hostel & Mess</SelectItem>
                      <SelectItem value="Transport">Transport Fee</SelectItem>
                      <SelectItem value="Library">Library Fee</SelectItem>
                      <SelectItem value="Exam">Exam Fee</SelectItem>
                      <SelectItem value="Misc">Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fee-mode">Payment Mode *</Label>
                  <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                    <SelectTrigger id="fee-mode">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash (Counter)</SelectItem>
                      <SelectItem value="Online">Online / UPI</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fee-amount">Gross Amount (₹) *</Label>
                  <Input
                    id="fee-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="fee-disc">Scholarship / Discount (₹)</Label>
                  <Input
                    id="fee-disc"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border rounded-lg text-sm flex justify-between font-bold">
                <span>Net Payable Amount:</span>
                <span className="text-emerald-700">₹{Math.max(0, amount - discountAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>

              <div>
                <Label htmlFor="fee-ref">Reference / Txn / Cheque No</Label>
                <Input id="fee-ref" placeholder="Transaction Ref / Cheque No" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="fee-rem">Remarks / Notes</Label>
                <Input id="fee-rem" placeholder="e.g. Installment 1 payment" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCollectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSubmitting ? 'Recording...' : 'Collect & Issue Receipt'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:inline-flex">
          <TabsTrigger value="collections">Collected Receipts ({feePayments.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Fee Dues ({pendingFeeStudents.length})</TabsTrigger>
        </TabsList>

        <div className="my-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student, receipt no, USN..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="collections" className="space-y-4">
          <Card className="border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">USN</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3 text-right">Net Amount</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredFeePayments.length > 0 ? (
                      filteredFeePayments.map((fp) => (
                        <tr key={fp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-800">{fp.receiptNo}</td>
                          <td className="p-3 font-medium text-slate-900">{fp.studentName}</td>
                          <td className="p-3 font-mono text-slate-600">{fp.studentUsn || 'N/A'}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">
                              {fp.category}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-600">{fp.date}</td>
                          <td className="p-3 text-slate-700 font-medium">{fp.paymentMode}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            ₹{fp.netAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <Button size="sm" variant="outline" onClick={() => printFeeReceipt(fp, activeCollege)} className="gap-1 text-xs">
                              <Printer className="h-3.5 w-3.5 text-slate-600" /> Receipt
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          No fee payments collected yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card className="border shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                      <th className="p-3">Student Name</th>
                      <th className="p-3">USN</th>
                      <th className="p-3">Class</th>
                      <th className="p-3 text-right">Total Fees (₹)</th>
                      <th className="p-3 text-right">Paid (₹)</th>
                      <th className="p-3 text-right">Outstanding Dues (₹)</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingFeeStudents.length > 0 ? (
                      pendingFeeStudents.map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-medium text-slate-900">{st.name}</td>
                          <td className="p-3 font-mono text-slate-600">{st.usn || 'N/A'}</td>
                          <td className="p-3 text-slate-600">Class {st.classId || 'Unassigned'}</td>
                          <td className="p-3 text-right font-mono text-slate-700">
                            ₹{(st.fees?.totalFees || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-700">
                            ₹{(st.fees?.paid || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-700">
                            ₹{(st.fees?.balance || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              onClick={() => {
                                setSelectedStudentId(st.id);
                                setAmount(st.fees?.balance || 0);
                                setIsCollectOpen(true);
                              }}
                            >
                              Collect Fee
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          All students have paid their fees in full!
                        </td>
                      </tr>
                    )}
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
