import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Account,
  AccountType,
  Voucher,
  VoucherLineItem,
  VoucherType,
  LedgerEntry,
  StudentFeePayment,
  FeeRefund,
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
  AccountingSettings,
  FinancialSummaryMetrics,
} from './accounting-types';

export const DEFAULT_ACCOUNTS_SEED: Omit<Account, 'id' | 'collegeId' | 'createdAt'>[] = [
  // Assets
  { code: '1001', name: 'Cash in Hand', type: 'asset', group: 'Cash Accounts', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Main petty cash & counter collection cash' },
  { code: '1002', name: 'Main SBI Bank Account', type: 'asset', group: 'Bank Accounts', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Primary institutional bank account' },
  { code: '1003', name: 'HDFC Operating Bank Account', type: 'asset', group: 'Bank Accounts', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Secondary operating bank account' },
  { code: '1004', name: 'Student Fee Receivables', type: 'asset', group: 'Student Receivables', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Outstanding student fee dues' },
  { code: '1005', name: 'Furniture & Fixtures', type: 'asset', group: 'Fixed Assets', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Classroom & office furniture' },
  { code: '1006', name: 'Computers & IT Equipment', type: 'asset', group: 'Fixed Assets', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Lab computers, servers & routers' },

  // Liabilities
  { code: '2001', name: 'Vendor Payables', type: 'liability', group: 'Vendor Payables', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Unpaid bills to suppliers & contractors' },
  { code: '2002', name: 'TDS Payable', type: 'liability', group: 'Tax Liabilities', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Tax deducted at source payable' },
  { code: '2003', name: 'GST Payable', type: 'liability', group: 'Tax Liabilities', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Output GST liability' },
  { code: '2004', name: 'Professional Tax Payable', type: 'liability', group: 'Tax Liabilities', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Staff professional tax collected' },

  // Equity
  { code: '3001', name: 'Institutional Capital / Endowment', type: 'equity', group: 'Capital & Equity', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Founder capital & institutional reserve fund' },
  { code: '3002', name: 'Retained Earnings', type: 'equity', group: 'Retained Earnings', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Accumulated operational surplus' },

  // Income
  { code: '4001', name: 'Tuition Fee Income', type: 'income', group: 'Fee Revenue', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Academic tuition fees collected' },
  { code: '4002', name: 'Admission & Registration Fees', type: 'income', group: 'Fee Revenue', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'New student enrollment fees' },
  { code: '4003', name: 'Hostel & Mess Fees', type: 'income', group: 'Fee Revenue', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Residential facility income' },
  { code: '4004', name: 'Transport & Bus Fees', type: 'income', group: 'Fee Revenue', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Student & staff bus fees' },
  { code: '4005', name: 'Library & Exam Fees', type: 'income', group: 'Fee Revenue', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Library dues & university exam fees' },
  { code: '4006', name: 'Government Grants & Donations', type: 'income', group: 'Direct Income', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Research grants & philanthropic gifts' },
  { code: '4007', name: 'Miscellaneous Income', type: 'income', group: 'Indirect Income', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Fine fees, canteen rent, transcript charges' },

  // Expenses
  { code: '5001', name: 'Staff Salaries & Wages', type: 'expense', group: 'Payroll Expenses', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Teaching & non-teaching staff payroll' },
  { code: '5002', name: 'Electricity & Water Utility Bills', type: 'expense', group: 'Operating Expenses', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Power grid & water supply costs' },
  { code: '5003', name: 'Building & Infrastructure Maintenance', type: 'expense', group: 'Maintenance Expenses', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Repairs, painting & civil works' },
  { code: '5004', name: 'Office Supplies & Stationery', type: 'expense', group: 'Administrative Expenses', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'Printing, paper, files & office materials' },
  { code: '5005', name: 'Software & Cloud Licenses', type: 'expense', group: 'Administrative Expenses', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'ERP software, Zoom, internet bandwidth' },
  { code: '5006', name: 'Miscellaneous Expenses', type: 'expense', group: 'Operating Expenses', openingBalance: 0, currentBalance: 0, isSystem: true, description: 'General operational outlays' },
];

/** Seed default accounts if college has no accounts initialized. */
export async function seedAccountsIfEmpty(collegeId: string): Promise<Account[]> {
  if (!collegeId) return [];
  const q = query(collection(db, 'accounting_accounts'), where('collegeId', '==', collegeId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account));
  }

  const created: Account[] = [];
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (const accSeed of DEFAULT_ACCOUNTS_SEED) {
    const docRef = doc(collection(db, 'accounting_accounts'));
    const accData: Account = {
      id: docRef.id,
      collegeId,
      ...accSeed,
      createdAt: now,
    };
    batch.set(docRef, accData);
    created.push(accData);
  }

  // Also seed primary cash & bank account entries in bank_accounts collection
  const mainBankRef = doc(collection(db, 'accounting_bank_accounts'));
  batch.set(mainBankRef, {
    id: mainBankRef.id,
    collegeId,
    bankName: 'State Bank of India',
    accountNumber: '39482019482',
    ifscCode: 'SBIN0004812',
    branchName: 'Main Campus Branch',
    accountType: 'Current',
    currentBalance: 0,
    openingBalance: 0,
    isPrimary: true,
    createdAt: now,
  });

  // Seed default settings
  const settingsRef = doc(db, 'accounting_settings', collegeId);
  batch.set(settingsRef, {
    collegeId,
    currentFinancialYear: '2025-2026',
    currencySymbol: '₹',
    voucherPrefixes: {
      receipt: 'RV',
      payment: 'PV',
      journal: 'JV',
      contra: 'CV',
    },
    enableAutoVoucherNo: true,
  });

  await batch.commit();
  return created;
}

/** Log financial audit action. */
export async function createAuditLog(
  collegeId: string,
  userEmail: string,
  userName: string,
  action: FinancialAuditLog['action'],
  entityType: FinancialAuditLog['entityType'],
  entityId: string,
  summary: string,
  details?: any
) {
  try {
    await addDoc(collection(db, 'accounting_audit_logs'), {
      collegeId,
      action,
      entityType,
      entityId,
      summary,
      details: details ? JSON.stringify(details) : '',
      userEmail: userEmail || 'system',
      userName: userName || 'System User',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}

/** Generate next Voucher Number based on type and FY. */
export async function generateVoucherNumber(
  collegeId: string,
  type: VoucherType,
  financialYear: string = '2025-2026'
): Promise<string> {
  const prefixMap: Record<VoucherType, string> = {
    receipt: 'RV',
    payment: 'PV',
    journal: 'JV',
    contra: 'CV',
  };
  const prefix = prefixMap[type];
  const q = query(
    collection(db, 'accounting_vouchers'),
    where('collegeId', '==', collegeId),
    where('type', '==', type)
  );
  const snap = await getDocs(q);
  const count = snap.size + 1;
  const numStr = String(count).padStart(4, '0');
  const shortYear = financialYear.replace('20', '');
  return `${prefix}-${shortYear}-${numStr}`;
}

/** Post a double-entry voucher & automatically update ledger entries and account balances. */
export async function postVoucher(
  collegeId: string,
  voucherData: Omit<Voucher, 'id' | 'status' | 'createdAt'>,
  userEmail: string,
  userName: string
): Promise<Voucher> {
  // Validate double entry rule: Total Debits == Total Credits
  const totalDebit = voucherData.lineItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const totalCredit = voucherData.lineItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Double-entry validation failed: Total Debits (₹${totalDebit.toFixed(2)}) must equal Total Credits (₹${totalCredit.toFixed(2)}).`);
  }

  const now = new Date().toISOString();
  const voucherRef = doc(collection(db, 'accounting_vouchers'));
  const voucher: Voucher = {
    ...voucherData,
    id: voucherRef.id,
    totalAmount: totalDebit,
    status: 'posted',
    createdAt: now,
  };

  const batch = writeBatch(db);
  batch.set(voucherRef, voucher);

  // Update ledgers and accounts
  for (const item of voucher.lineItems) {
    const accRef = doc(db, 'accounting_accounts', item.accountId);
    const accSnap = await getDoc(accRef);
    let currentBal = 0;
    let accType: AccountType = 'asset';

    if (accSnap.exists()) {
      const data = accSnap.data() as Account;
      currentBal = data.currentBalance || 0;
      accType = data.type;
    }

    // Normal balance delta calculation
    // Asset/Expense: Debit increases (+), Credit decreases (-)
    // Liability/Equity/Income: Credit increases (+), Debit decreases (-)
    const debit = Number(item.debit) || 0;
    const credit = Number(item.credit) || 0;
    let newBal = currentBal;

    if (accType === 'asset' || accType === 'expense') {
      newBal += (debit - credit);
    } else {
      newBal += (credit - debit);
    }

    batch.update(accRef, { currentBalance: newBal, updatedAt: now });

    // Create ledger entry
    const ledgerRef = doc(collection(db, 'accounting_ledgers'));
    const ledgerEntry: LedgerEntry = {
      id: ledgerRef.id,
      collegeId,
      accountId: item.accountId,
      accountName: item.accountName,
      voucherId: voucher.id,
      voucherNo: voucher.voucherNo,
      voucherType: voucher.type,
      date: voucher.date,
      description: item.description || voucher.particulars,
      debit,
      credit,
      balance: newBal,
      financialYear: voucher.financialYear,
      createdAt: now,
    };
    batch.set(ledgerRef, ledgerEntry);
  }

  await batch.commit();

  await createAuditLog(
    collegeId,
    userEmail,
    userName,
    'post',
    'Voucher',
    voucher.id,
    `Posted ${voucher.type.toUpperCase()} Voucher ${voucher.voucherNo} of amount ₹${totalDebit}`,
    { voucherNo: voucher.voucherNo, totalAmount: totalDebit }
  );

  return voucher;
}

/** Reverse a posted voucher. */
export async function reverseVoucher(
  collegeId: string,
  voucherId: string,
  reason: string,
  userEmail: string,
  userName: string
): Promise<Voucher> {
  const vRef = doc(db, 'accounting_vouchers', voucherId);
  const vSnap = await getDoc(vRef);
  if (!vSnap.exists()) throw new Error('Voucher not found');

  const origVoucher = { id: vSnap.id, ...vSnap.data() } as Voucher;
  if (origVoucher.status === 'reversed') throw new Error('Voucher is already reversed');

  const revVoucherNo = await generateVoucherNumber(collegeId, 'journal', origVoucher.financialYear);
  const reversedLineItems: VoucherLineItem[] = origVoucher.lineItems.map((item) => ({
    ...item,
    debit: item.credit, // Swap debit & credit for reversal
    credit: item.debit,
    description: `Reversal of ${origVoucher.voucherNo}: ${reason}`,
  }));

  const reversalVoucher = await postVoucher(
    collegeId,
    {
      collegeId,
      voucherNo: revVoucherNo,
      type: 'journal',
      date: new Date().toISOString().split('T')[0],
      particulars: `Reversal of ${origVoucher.voucherNo} - ${reason}`,
      narration: `Reversal of original voucher ${origVoucher.voucherNo}. Reason: ${reason}`,
      lineItems: reversedLineItems,
      totalAmount: origVoucher.totalAmount,
      financialYear: origVoucher.financialYear,
      preparedBy: { id: userEmail, name: userName, email: userEmail },
    },
    userEmail,
    userName
  );

  await updateDoc(vRef, {
    status: 'reversed',
    reversalReason: reason,
    reversedVoucherNo: revVoucherNo,
    updatedAt: new Date().toISOString(),
  });

  await createAuditLog(
    collegeId,
    userEmail,
    userName,
    'reverse',
    'Voucher',
    origVoucher.id,
    `Reversed Voucher ${origVoucher.voucherNo} with Reversal Voucher ${revVoucherNo}`,
    { originalVoucherNo: origVoucher.voucherNo, reversalVoucherNo: revVoucherNo, reason }
  );

  return reversalVoucher;
}

/** Record Student Fee Payment with automatic double-entry posting. */
export async function recordStudentFeePayment(
  collegeId: string,
  feeData: Omit<StudentFeePayment, 'id' | 'receiptNo' | 'status' | 'createdAt'>,
  userEmail: string,
  userName: string
): Promise<StudentFeePayment> {
  const accounts = await seedAccountsIfEmpty(collegeId);
  const now = new Date().toISOString();
  const shortYear = (feeData.academicYear || '2025-2026').slice(-2);
  
  // Generate Receipt No
  const countSnap = await getDocs(
    query(collection(db, 'accounting_fee_payments'), where('collegeId', '==', collegeId))
  );
  const receiptNo = `FEE-REC-${shortYear}-${String(countSnap.size + 1).padStart(4, '0')}`;

  // Identify Accounts
  const cashAcc = accounts.find((a) => a.name.includes('Cash')) || accounts[0];
  const bankAcc = accounts.find((a) => a.name.includes('SBI') || a.group === 'Bank Accounts') || accounts[1];
  const targetAcc = feeData.paymentMode === 'Cash' ? cashAcc : bankAcc;
  
  const feeIncomeAcc = accounts.find((a) => a.code === '4001' || a.name.includes('Tuition')) || accounts.find((a) => a.type === 'income') || accounts[0];

  const voucherNo = await generateVoucherNumber(collegeId, 'receipt', feeData.academicYear);

  // Post Voucher
  const voucher = await postVoucher(
    collegeId,
    {
      collegeId,
      voucherNo,
      type: 'receipt',
      date: feeData.date,
      particulars: `Fee Collection: ${feeData.studentName} (${feeData.category})`,
      narration: `Fee Payment Receipt #${receiptNo} for ${feeData.studentName} (${feeData.studentUsn || 'No USN'}). Mode: ${feeData.paymentMode}`,
      lineItems: [
        {
          id: '1',
          accountId: targetAcc.id,
          accountName: targetAcc.name,
          accountCode: targetAcc.code,
          debit: feeData.netAmount,
          credit: 0,
          description: `Fee Payment received via ${feeData.paymentMode}`,
        },
        {
          id: '2',
          accountId: feeIncomeAcc.id,
          accountName: feeIncomeAcc.name,
          accountCode: feeIncomeAcc.code,
          debit: 0,
          credit: feeData.netAmount,
          description: `${feeData.category} fee revenue credited`,
        },
      ],
      totalAmount: feeData.netAmount,
      financialYear: feeData.academicYear,
      preparedBy: { id: userEmail, name: userName, email: userEmail },
    },
    userEmail,
    userName
  );

  const feeRef = doc(collection(db, 'accounting_fee_payments'));
  const feeRecord: StudentFeePayment = {
    ...feeData,
    id: feeRef.id,
    receiptNo,
    voucherId: voucher.id,
    status: 'completed',
    createdAt: now,
  };

  await setDoc(feeRef, feeRecord);

  // Update existing ERP student record paid fee history if student exists in students collection
  if (feeData.studentId) {
    try {
      const studentDocRef = doc(db, 'students', feeData.studentId);
      const studentSnap = await getDoc(studentDocRef);
      if (studentSnap.exists()) {
        const existingStudentData = studentSnap.data();
        const currentFees = existingStudentData.fees || {};
        const currentPaid = Number(currentFees.paid) || 0;
        const totalFees = Number(currentFees.totalFees) || 0;
        const newPaid = currentPaid + feeData.netAmount;
        const newBalance = Math.max(0, totalFees - newPaid);
        const newHistory = [
          ...(currentFees.paymentHistory || []),
          {
            id: feeRecord.id,
            amount: feeData.netAmount,
            date: feeData.date,
            method: feeData.paymentMode,
            receiptNumber: receiptNo,
            remarks: feeData.remarks || feeData.category,
          },
        ];

        await updateDoc(studentDocRef, {
          fees: {
            ...currentFees,
            paid: newPaid,
            balance: newBalance,
            status: newBalance === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid',
            paymentHistory: newHistory,
          },
        });
      }
    } catch (err) {
      console.error('Failed to sync student fee record:', err);
    }
  }

  await createAuditLog(
    collegeId,
    userEmail,
    userName,
    'create',
    'FeePayment',
    feeRecord.id,
    `Collected ₹${feeData.netAmount} fee for ${feeData.studentName} (Receipt: ${receiptNo})`,
    feeRecord
  );

  return feeRecord;
}

/** Record Income with automatic double entry voucher. */
export async function recordIncome(
  collegeId: string,
  incomeData: Omit<IncomeRecord, 'id' | 'createdAt'>,
  userEmail: string,
  userName: string
): Promise<IncomeRecord> {
  const accounts = await seedAccountsIfEmpty(collegeId);
  const now = new Date().toISOString();

  const cashAcc = accounts.find((a) => a.name.includes('Cash')) || accounts[0];
  const bankAcc = accounts.find((a) => a.name.includes('SBI') || a.group === 'Bank Accounts') || accounts[1];
  const assetAcc = incomeData.paymentMode === 'Cash' ? cashAcc : bankAcc;

  const voucherNo = await generateVoucherNumber(collegeId, 'receipt');

  const voucher = await postVoucher(
    collegeId,
    {
      collegeId,
      voucherNo,
      type: 'receipt',
      date: incomeData.date,
      particulars: `Income: ${incomeData.title} (${incomeData.category})`,
      narration: `Income received from ${incomeData.receivedFrom}. Category: ${incomeData.category}`,
      lineItems: [
        {
          id: '1',
          accountId: assetAcc.id,
          accountName: assetAcc.name,
          accountCode: assetAcc.code,
          debit: incomeData.amount,
          credit: 0,
          description: `Received via ${incomeData.paymentMode}`,
        },
        {
          id: '2',
          accountId: incomeData.accountId,
          accountName: incomeData.accountName,
          accountCode: 'INCOME',
          debit: 0,
          credit: incomeData.amount,
          description: incomeData.title,
        },
      ],
      totalAmount: incomeData.amount,
      financialYear: '2025-2026',
      preparedBy: { id: userEmail, name: userName, email: userEmail },
    },
    userEmail,
    userName
  );

  const incRef = doc(collection(db, 'accounting_incomes'));
  const record: IncomeRecord = {
    ...incomeData,
    id: incRef.id,
    voucherId: voucher.id,
    createdAt: now,
  };

  await setDoc(incRef, record);

  await createAuditLog(
    collegeId,
    userEmail,
    userName,
    'create',
    'Income',
    record.id,
    `Recorded income ₹${incomeData.amount} under ${incomeData.category} from ${incomeData.receivedFrom}`,
    record
  );

  return record;
}

/** Record Expense with automatic double entry voucher. */
export async function recordExpense(
  collegeId: string,
  expenseData: Omit<ExpenseRecord, 'id' | 'createdAt'>,
  userEmail: string,
  userName: string
): Promise<ExpenseRecord> {
  const accounts = await seedAccountsIfEmpty(collegeId);
  const now = new Date().toISOString();

  const cashAcc = accounts.find((a) => a.name.includes('Cash')) || accounts[0];
  const bankAcc = accounts.find((a) => a.name.includes('SBI') || a.group === 'Bank Accounts') || accounts[1];
  const creditAcc = expenseData.paymentMode === 'Cash' ? cashAcc : bankAcc;

  const voucherNo = await generateVoucherNumber(collegeId, 'payment');

  const voucher = await postVoucher(
    collegeId,
    {
      collegeId,
      voucherNo,
      type: 'payment',
      date: expenseData.date,
      particulars: `Expense: ${expenseData.title} (${expenseData.category})`,
      narration: `Expense paid to ${expenseData.paidTo}. Invoice No: ${expenseData.invoiceNo || 'N/A'}`,
      lineItems: [
        {
          id: '1',
          accountId: expenseData.accountId,
          accountName: expenseData.accountName,
          accountCode: 'EXPENSE',
          debit: expenseData.amount,
          credit: 0,
          description: expenseData.title,
        },
        {
          id: '2',
          accountId: creditAcc.id,
          accountName: creditAcc.name,
          accountCode: creditAcc.code,
          debit: 0,
          credit: expenseData.amount,
          description: `Paid via ${expenseData.paymentMode}`,
        },
      ],
      totalAmount: expenseData.amount,
      financialYear: '2025-2026',
      preparedBy: { id: userEmail, name: userName, email: userEmail },
    },
    userEmail,
    userName
  );

  const expRef = doc(collection(db, 'accounting_expenses'));
  const record: ExpenseRecord = {
    ...expenseData,
    id: expRef.id,
    voucherId: voucher.id,
    createdAt: now,
  };

  await setDoc(expRef, record);

  await createAuditLog(
    collegeId,
    userEmail,
    userName,
    'create',
    'Expense',
    record.id,
    `Recorded expense ₹${expenseData.amount} under ${expenseData.category} paid to ${expenseData.paidTo}`,
    record
  );

  return record;
}

/** Calculate summary dashboard metrics. */
export async function calculateFinancialSummary(collegeId: string): Promise<FinancialSummaryMetrics> {
  if (!collegeId) {
    return {
      totalIncome: 0,
      totalExpenses: 0,
      cashInHand: 0,
      bankBalance: 0,
      pendingFeeCollection: 0,
      pendingPayments: 0,
      netProfitLoss: 0,
    };
  }

  const [accountsSnap, studentsSnap, vendorBillsSnap] = await Promise.all([
    getDocs(query(collection(db, 'accounting_accounts'), where('collegeId', '==', collegeId))),
    getDocs(query(collection(db, 'students'), where('collegeId', '==', collegeId))),
    getDocs(query(collection(db, 'accounting_purchase_bills'), where('collegeId', '==', collegeId))),
  ]);

  let totalIncome = 0;
  let totalExpenses = 0;
  let cashInHand = 0;
  let bankBalance = 0;

  accountsSnap.docs.forEach((d) => {
    const acc = d.data() as Account;
    if (acc.type === 'income') {
      totalIncome += Math.abs(acc.currentBalance || 0);
    } else if (acc.type === 'expense') {
      totalExpenses += Math.abs(acc.currentBalance || 0);
    } else if (acc.group === 'Cash Accounts') {
      cashInHand += acc.currentBalance || 0;
    } else if (acc.group === 'Bank Accounts') {
      bankBalance += acc.currentBalance || 0;
    }
  });

  let pendingFeeCollection = 0;
  studentsSnap.docs.forEach((d) => {
    const st = d.data();
    if (st.fees && typeof st.fees.balance === 'number') {
      pendingFeeCollection += Math.max(0, st.fees.balance);
    }
  });

  let pendingPayments = 0;
  vendorBillsSnap.docs.forEach((d) => {
    const bill = d.data() as PurchaseBill;
    if (bill.status !== 'paid') {
      pendingPayments += bill.outstandingAmount || 0;
    }
  });

  return {
    totalIncome,
    totalExpenses,
    cashInHand,
    bankBalance,
    pendingFeeCollection,
    pendingPayments,
    netProfitLoss: totalIncome - totalExpenses,
  };
}
