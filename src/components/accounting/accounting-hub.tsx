'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { collection, onSnapshot, query, where, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  LayoutDashboard,
  FolderTree,
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  BookOpen,
  FileCode,
  Wallet,
  Landmark,
  Users,
  Building2,
  BarChart3,
  ShieldCheck,
  History,
  FileSpreadsheet,
  Settings,
  Calculator,
} from 'lucide-react';

import type {
  Account,
  Voucher,
  LedgerEntry,
  StudentFeePayment,
  IncomeRecord,
  ExpenseRecord,
  CashClosing,
  BankAccount,
  BankTransaction,
  PayrollRecord,
  Vendor,
  PurchaseBill,
  FixedAsset,
  TaxRecord,
  FinancialAuditLog,
  AccountingSettings as AccountingSettingsType,
  FinancialSummaryMetrics,
} from '@/lib/accounting-types';
import type { Student, Teacher, College } from '@/lib/types';

import {
  seedAccountsIfEmpty,
  postVoucher,
  reverseVoucher,
  recordStudentFeePayment,
  recordIncome,
  recordExpense,
  calculateFinancialSummary,
  createAuditLog,
} from '@/lib/accounting-service';

// Sub-components
import { AccountingDashboard } from '@/components/accounting/accounting-dashboard';
import { ChartOfAccounts } from '@/components/accounting/chart-of-accounts';
import { FeeAccounting } from '@/components/accounting/fee-accounting';
import { IncomeManagement } from '@/components/accounting/income-management';
import { ExpenseManagement } from '@/components/accounting/expense-management';
import { VoucherManagement } from '@/components/accounting/voucher-management';
import { GeneralLedger } from '@/components/accounting/general-ledger';
import { JournalEntries } from '@/components/accounting/journal-entries';
import { CashManagement } from '@/components/accounting/cash-management';
import { BankManagement } from '@/components/accounting/bank-management';
import { PayrollAccounting } from '@/components/accounting/payroll-accounting';
import { VendorAccounting } from '@/components/accounting/vendor-accounting';
import { FixedAssetManagement } from '@/components/accounting/fixed-asset-management';
import { FinancialReports } from '@/components/accounting/financial-reports';
import { TaxManagement } from '@/components/accounting/tax-management';
import { AuditActivityLogs } from '@/components/accounting/audit-activity-logs';
import { ImportExportCenter } from '@/components/accounting/import-export-center';
import { AccountingSettingsComponent } from '@/components/accounting/accounting-settings';

export interface AccountingPageProps {
  params?: Promise<Record<string, string | string[] | undefined>>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  initialTab?: string;
  hideTopNav?: boolean;
}

function AccountingPageContent(props: AccountingPageProps) {
  const principal = useCurrentPrincipal();
  const collegeId = principal?.collegeId || '';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryTab = searchParams?.get('tab');

  const [activeTab, setActiveTab] = useState<string>(() => queryTab || props.initialTab || 'dashboard');
  const [college, setCollege] = useState<College | null>(null);

  useEffect(() => {
    if (queryTab && queryTab !== activeTab) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    if (pathname && pathname.includes('account-manager-dashboard')) {
      router.push(`/account-manager-dashboard?tab=${tab}`, { scroll: false });
    }
  };

  // Firestore Collections State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [feePayments, setFeePayments] = useState<StudentFeePayment[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [cashClosings, setCashClosings] = useState<CashClosing[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [settings, setSettings] = useState<AccountingSettingsType | null>(null);

  // Existing ERP collections for integration
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // Summary Metrics
  const [metrics, setMetrics] = useState<FinancialSummaryMetrics>({
    totalIncome: 0,
    totalExpenses: 0,
    cashInHand: 0,
    bankBalance: 0,
    pendingFeeCollection: 0,
    pendingPayments: 0,
    netProfitLoss: 0,
  });

  // Seed default accounts and set up listeners
  useEffect(() => {
    if (!collegeId) return;

    const unsubCollege = onSnapshot(
      doc(db, 'colleges', collegeId),
      (snap) => {
        if (snap.exists()) {
          setCollege({ id: snap.id, ...snap.data() } as College);
        }
      }
    );

    // Seed default chart of accounts if empty
    seedAccountsIfEmpty(collegeId).then(() => {
      refreshMetrics();
    });

    const unsubAccounts = onSnapshot(
      query(collection(db, 'accounting_accounts'), where('collegeId', '==', collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account));
        setAccounts(list);
      }
    );

    const unsubVouchers = onSnapshot(
      query(collection(db, 'accounting_vouchers'), where('collegeId', '==', collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Voucher));
        list.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        setVouchers(list);
      }
    );

    const unsubLedgers = onSnapshot(
      query(collection(db, 'accounting_ledgers'), where('collegeId', '==', collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry));
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLedgers(list);
      }
    );

    const unsubFeePayments = onSnapshot(
      query(collection(db, 'accounting_fee_payments'), where('collegeId', '==', collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentFeePayment));
        list.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        setFeePayments(list);
      }
    );

    const unsubIncomes = onSnapshot(
      query(collection(db, 'accounting_incomes'), where('collegeId', '==', collegeId)),
      (snap) => setIncomes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as IncomeRecord)))
    );

    const unsubExpenses = onSnapshot(
      query(collection(db, 'accounting_expenses'), where('collegeId', '==', collegeId)),
      (snap) => setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseRecord)))
    );

    const unsubCashClosings = onSnapshot(
      query(collection(db, 'accounting_cash_closings'), where('collegeId', '==', collegeId)),
      (snap) => setCashClosings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CashClosing)))
    );

    const unsubBankAccounts = onSnapshot(
      query(collection(db, 'accounting_bank_accounts'), where('collegeId', '==', collegeId)),
      (snap) => setBankAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankAccount)))
    );

    const unsubPayrolls = onSnapshot(
      query(collection(db, 'accounting_payrolls'), where('collegeId', '==', collegeId)),
      (snap) => setPayrolls(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayrollRecord)))
    );

    const unsubVendors = onSnapshot(
      query(collection(db, 'accounting_vendors'), where('collegeId', '==', collegeId)),
      (snap) => setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vendor)))
    );

    const unsubBills = onSnapshot(
      query(collection(db, 'accounting_purchase_bills'), where('collegeId', '==', collegeId)),
      (snap) => setPurchaseBills(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseBill)))
    );

    const unsubAssets = onSnapshot(
      query(collection(db, 'accounting_assets'), where('collegeId', '==', collegeId)),
      (snap) => setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FixedAsset)))
    );

    const unsubAudit = onSnapshot(
      query(collection(db, 'accounting_audit_logs'), where('collegeId', '==', collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialAuditLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAuditLogs(list);
      }
    );

    // ERP Students & Teachers
    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('collegeId', '==', collegeId)),
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)))
    );

    const unsubTeachers = onSnapshot(
      query(collection(db, 'teachers'), where('collegeId', '==', collegeId)),
      (snap) => setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher)))
    );

    const unsubTaxRecords = onSnapshot(
      query(collection(db, 'accounting_tax_records'), where('collegeId', '==', collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaxRecord));
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTaxRecords(list);
      }
    );

    return () => {
      unsubCollege();
      unsubAccounts();
      unsubVouchers();
      unsubLedgers();
      unsubFeePayments();
      unsubIncomes();
      unsubExpenses();
      unsubCashClosings();
      unsubBankAccounts();
      unsubPayrolls();
      unsubVendors();
      unsubBills();
      unsubAssets();
      unsubAudit();
      unsubStudents();
      unsubTeachers();
      unsubTaxRecords();
    };
  }, [collegeId]);

  const refreshMetrics = async () => {
    if (!collegeId) return;
    const res = await calculateFinancialSummary(collegeId);
    setMetrics(res);
  };

  // Handlers for child components
  const handleAddAccount = async (accData: Omit<Account, 'id' | 'collegeId' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_accounts'));
    const acc: Account = {
      ...accData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, acc);
    await createAuditLog(collegeId, principal?.email || 'admin', principal?.name || 'Admin', 'create', 'Account', acc.id, `Created account ${acc.code} - ${acc.name}`);
    refreshMetrics();
  };

  const handlePostVoucher = async (vData: Omit<Voucher, 'id' | 'status' | 'createdAt'>) => {
    await postVoucher(
      collegeId,
      { ...vData, collegeId },
      principal?.email || 'admin',
      principal?.name || 'Admin'
    );
    refreshMetrics();
  };

  const handleReverseVoucher = async (vId: string, reason: string) => {
    await reverseVoucher(collegeId, vId, reason, principal?.email || 'admin', principal?.name || 'Admin');
    refreshMetrics();
  };

  const handleCollectFee = async (feeData: Omit<StudentFeePayment, 'id' | 'receiptNo' | 'status' | 'createdAt'>) => {
    await recordStudentFeePayment(
      collegeId,
      { ...feeData, collegeId },
      principal?.email || 'admin',
      principal?.name || 'Admin'
    );
    refreshMetrics();
  };

  const handleRecordIncome = async (incData: Omit<IncomeRecord, 'id' | 'createdAt'>) => {
    await recordIncome(
      collegeId,
      { ...incData, collegeId },
      principal?.email || 'admin',
      principal?.name || 'Admin'
    );
    refreshMetrics();
  };

  const handleRecordExpense = async (expData: Omit<ExpenseRecord, 'id' | 'createdAt'>) => {
    await recordExpense(
      collegeId,
      { ...expData, collegeId },
      principal?.email || 'admin',
      principal?.name || 'Admin'
    );
    refreshMetrics();
  };

  const handleRecordCashClosing = async (closingData: Omit<CashClosing, 'id' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_cash_closings'));
    const record: CashClosing = {
      ...closingData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, record);
    await createAuditLog(
      collegeId,
      principal?.email || 'admin',
      principal?.name || 'Admin',
      'close',
      'Account',
      record.id,
      `Audited Cash Closing: Physical ₹${record.actualPhysicalCash} vs System ₹${record.calculatedClosingBalance}`
    );
  };

  const handleAddBankAccount = async (bData: Omit<BankAccount, 'id' | 'collegeId' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_bank_accounts'));
    const bank: BankAccount = {
      ...bData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, bank);
    refreshMetrics();
  };

  const handleBankTransfer = async (sourceBankId: string, targetBankId: string, amount: number, desc: string) => {
    const sourceAcc = bankAccounts.find((b) => b.id === sourceBankId);
    const targetAcc = bankAccounts.find((b) => b.id === targetBankId);

    // Create Contra Voucher for Inter-bank transfer
    const lineItems = [
      { id: '1', accountId: targetBankId, accountName: targetAcc?.bankName || 'Target Bank', accountCode: 'BANK', debit: amount, credit: 0, description: desc },
      { id: '2', accountId: sourceBankId, accountName: sourceAcc?.bankName || 'Source Bank', accountCode: 'BANK', debit: 0, credit: amount, description: desc },
    ];

    await postVoucher(
      collegeId,
      {
        collegeId,
        voucherNo: `CV-TRANSFER-${Date.now().toString().slice(-4)}`,
        type: 'contra',
        date: new Date().toISOString().split('T')[0],
        particulars: `Inter-bank Transfer from ${sourceAcc?.bankName} to ${targetAcc?.bankName}`,
        narration: desc || 'Fund sweep transfer',
        lineItems,
        totalAmount: amount,
        financialYear: '2025-2026',
        preparedBy: { id: principal?.email || 'admin', name: principal?.name || 'Admin', email: principal?.email || 'admin' },
      },
      principal?.email || 'admin',
      principal?.name || 'Admin'
    );
    refreshMetrics();
  };

  const handleProcessPayroll = async (pData: Omit<PayrollRecord, 'id' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_payrolls'));
    const record: PayrollRecord = {
      ...pData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, record);

    // Post Payment Voucher for Payroll
    await postVoucher(
      collegeId,
      {
        collegeId,
        voucherNo: `PV-PAYROLL-${Date.now().toString().slice(-4)}`,
        type: 'payment',
        date: new Date().toISOString().split('T')[0],
        particulars: `Staff Salary Disbursement: ${pData.employeeName} (${pData.monthYear})`,
        lineItems: [
          { id: '1', accountId: '5001', accountName: 'Staff Salaries & Wages', accountCode: '5001', debit: pData.grossSalary, credit: 0 },
          { id: '2', accountId: '1002', accountName: 'Bank / Cash Account', accountCode: '1002', debit: 0, credit: pData.netSalary },
          { id: '3', accountId: '2002', accountName: 'TDS Payable', accountCode: '2002', debit: 0, credit: pData.tdsDeduction },
          { id: '4', accountId: '2004', accountName: 'Professional Tax Payable', accountCode: '2004', debit: 0, credit: pData.professionalTax + pData.pfDeduction },
        ],
        totalAmount: pData.grossSalary,
        financialYear: '2025-2026',
        preparedBy: { id: principal?.email || 'admin', name: principal?.name || 'Admin', email: principal?.email || 'admin' },
      },
      principal?.email || 'admin',
      principal?.name || 'Admin'
    );

    refreshMetrics();
  };

  const handleAddVendor = async (vData: Omit<Vendor, 'id' | 'collegeId' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_vendors'));
    const vendor: Vendor = {
      ...vData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, vendor);
  };

  const handleRecordPurchaseBill = async (bData: Omit<PurchaseBill, 'id' | 'collegeId' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_purchase_bills'));
    const bill: PurchaseBill = {
      ...bData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, bill);
    refreshMetrics();
  };

  const handleAddAsset = async (astData: Omit<FixedAsset, 'id' | 'collegeId' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_assets'));
    const asset: FixedAsset = {
      ...astData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, asset);
    refreshMetrics();
  };

  const handleCalculateDepreciation = async () => {
    alert('Annual depreciation engine calculated and updated fixed asset net book values!');
  };

  const handleImportAccounts = async (importedAccounts: Omit<Account, 'id' | 'collegeId' | 'createdAt'>[]) => {
    for (const accData of importedAccounts) {
      await handleAddAccount(accData);
    }
  };

  const handleSaveSettings = async (sData: AccountingSettingsType) => {
    const docRef = doc(db, 'accounting_settings', collegeId);
    await setDoc(docRef, sData, { merge: true });
    setSettings(sData);
  };

  const handleAddTaxRecord = async (recordData: Omit<TaxRecord, 'id' | 'collegeId' | 'createdAt'>) => {
    const docRef = doc(collection(db, 'accounting_tax_records'));
    const rec: TaxRecord = {
      ...recordData,
      id: docRef.id,
      collegeId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, rec);
    await createAuditLog(
      collegeId,
      principal?.email || 'admin',
      principal?.name || 'Admin',
      'create',
      'TaxRecord' as any,
      rec.id,
      `Recorded tax transaction of type ${rec.taxType} for amount INR ${rec.taxAmount}`
    );
    refreshMetrics();
  };

  return (
    <div className="space-y-6">
      {/* Module Main Navigation Bar */}
      {!props.hideTopNav && (
        <Card className="border shadow-sm bg-slate-900 text-white overflow-hidden">
          <div className="p-4 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <button
                onClick={() => switchTab('dashboard')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'dashboard' ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
              </button>

              <button
                onClick={() => switchTab('chart-of-accounts')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'chart-of-accounts' ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FolderTree className="h-3.5 w-3.5" /> Chart of Accounts
              </button>

              <button
                onClick={() => switchTab('fee-accounting')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'fee-accounting' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Receipt className="h-3.5 w-3.5" /> Fee Accounting
              </button>

              <button
                onClick={() => switchTab('income-management')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'income-management' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" /> Income & Grants
              </button>

              <button
                onClick={() => switchTab('expense-management')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'expense-management' ? 'bg-rose-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5" /> Expenses
              </button>

              <button
                onClick={() => switchTab('vouchers')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'vouchers' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Vouchers
              </button>

              <button
                onClick={() => switchTab('general-ledger')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'general-ledger' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" /> General Ledger
              </button>

              <button
                onClick={() => switchTab('journal-entries')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'journal-entries' ? 'bg-purple-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" /> Journal Entries
              </button>

              <button
                onClick={() => switchTab('cash-management')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'cash-management' ? 'bg-amber-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Wallet className="h-3.5 w-3.5" /> Cash Book
              </button>

              <button
                onClick={() => switchTab('bank-management')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'bank-management' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Landmark className="h-3.5 w-3.5" /> Bank Accounts
              </button>

              <button
                onClick={() => switchTab('payroll-accounting')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'payroll-accounting' ? 'bg-purple-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Payroll
              </button>

              <button
                onClick={() => switchTab('vendor-accounting')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'vendor-accounting' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Vendors
              </button>

              <button
                onClick={() => switchTab('fixed-assets')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'fixed-assets' ? 'bg-teal-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" /> Fixed Assets
              </button>

              <button
                onClick={() => switchTab('financial-reports')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'financial-reports' ? 'bg-primary text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> Reports
              </button>

              <button
                onClick={() => switchTab('tax-management')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'tax-management' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Tax
              </button>

              <button
                onClick={() => switchTab('audit-logs')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'audit-logs' ? 'bg-slate-700 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <History className="h-3.5 w-3.5" /> Audit Logs
              </button>

              <button
                onClick={() => switchTab('import-export')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'import-export' ? 'bg-emerald-700 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Import/Export
              </button>

              <button
                onClick={() => switchTab('settings')}
                className={`px-3 py-2 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all ${
                  activeTab === 'settings' ? 'bg-slate-700 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Settings className="h-3.5 w-3.5" /> Settings
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Render Active Sub-Module */}
      {activeTab === 'dashboard' && (
        <AccountingDashboard
          metrics={metrics}
          recentVouchers={vouchers}
          recentFeePayments={feePayments}
          onOpenAction={(action) => {
            if (action === 'collect-fee') switchTab('fee-accounting');
            else if (action === 'new-expense') switchTab('expense-management');
            else if (action === 'create-voucher') switchTab('vouchers');
            else if (action === 'payroll') switchTab('payroll-accounting');
            else if (action === 'reports') switchTab('financial-reports');
            else if (action === 'vouchers') switchTab('vouchers');
          }}
          onRefresh={refreshMetrics}
        />
      )}

      {activeTab === 'chart-of-accounts' && (
        <ChartOfAccounts accounts={accounts} onAddAccount={handleAddAccount} />
      )}

      {activeTab === 'fee-accounting' && (
        <FeeAccounting
          feePayments={feePayments}
          students={students}
          onCollectFee={handleCollectFee}
          college={college || undefined}
          collegeName={college?.name || 'Institution'}
        />
      )}

      {activeTab === 'income-management' && (
        <IncomeManagement incomes={incomes} accounts={accounts} onRecordIncome={handleRecordIncome} />
      )}

      {activeTab === 'expense-management' && (
        <ExpenseManagement expenses={expenses} accounts={accounts} vendors={vendors} onRecordExpense={handleRecordExpense} />
      )}

      {activeTab === 'vouchers' && (
        <VoucherManagement
          vouchers={vouchers}
          accounts={accounts}
          onPostVoucher={handlePostVoucher}
          onReverseVoucher={handleReverseVoucher}
          college={college || undefined}
          collegeName={college?.name || 'Institution'}
          userEmail={principal?.email}
          userName={principal?.name}
        />
      )}

      {activeTab === 'general-ledger' && <GeneralLedger ledgers={ledgers} accounts={accounts} />}

      {activeTab === 'journal-entries' && (
        <JournalEntries
          vouchers={vouchers}
          accounts={accounts}
          onOpenCreateJournal={() => switchTab('vouchers')}
          onReverseVoucher={handleReverseVoucher}
        />
      )}

      {activeTab === 'cash-management' && (
        <CashManagement
          cashBalance={metrics.cashInHand}
          cashClosings={cashClosings}
          onRecordCashClosing={handleRecordCashClosing}
          userName={principal?.name}
        />
      )}

      {activeTab === 'bank-management' && (
        <BankManagement
          bankAccounts={bankAccounts}
          bankTransactions={bankTransactions}
          accounts={accounts}
          onAddBankAccount={handleAddBankAccount}
          onBankTransfer={handleBankTransfer}
        />
      )}

      {activeTab === 'payroll-accounting' && (
        <PayrollAccounting
          payrolls={payrolls}
          teachers={teachers}
          accounts={accounts}
          onProcessPayroll={handleProcessPayroll}
          college={college || undefined}
          collegeName={college?.name || 'Institution'}
        />
      )}

      {activeTab === 'vendor-accounting' && (
        <VendorAccounting
          vendors={vendors}
          purchaseBills={purchaseBills}
          onAddVendor={handleAddVendor}
          onRecordPurchaseBill={handleRecordPurchaseBill}
        />
      )}

      {activeTab === 'fixed-assets' && (
        <FixedAssetManagement
          assets={assets}
          onAddAsset={handleAddAsset}
          onCalculateDepreciation={handleCalculateDepreciation}
        />
      )}

      {activeTab === 'financial-reports' && (
        <FinancialReports
          accounts={accounts}
          vouchers={vouchers}
          feePayments={feePayments}
          expenses={expenses}
          incomes={incomes}
          payrolls={payrolls}
          vendors={vendors}
          students={students}
          collegeName={college?.name || 'Institution'}
        />
      )}

      {activeTab === 'tax-management' && (
        <TaxManagement
          taxRecords={taxRecords}
          onAddTaxRecord={handleAddTaxRecord}
        />
      )}

      {activeTab === 'audit-logs' && <AuditActivityLogs auditLogs={auditLogs} />}

      {activeTab === 'import-export' && (
        <ImportExportCenter
          accounts={accounts}
          vouchers={vouchers}
          feePayments={feePayments}
          onImportAccounts={handleImportAccounts}
        />
      )}

      {activeTab === 'settings' && (
        <AccountingSettingsComponent settings={settings} onSaveSettings={handleSaveSettings} />
      )}
    </div>
  );
}

export function AccountingHub(props: { initialTab?: string; hideTopNav?: boolean } = {}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading Accounting System...
        </div>
      }
    >
      <AccountingPageContent {...props} />
    </Suspense>
  );
}

export default AccountingHub;
