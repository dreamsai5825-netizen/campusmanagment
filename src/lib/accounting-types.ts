export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export type AccountGroup =
  | 'Current Assets'
  | 'Fixed Assets'
  | 'Bank Accounts'
  | 'Cash Accounts'
  | 'Student Receivables'
  | 'Current Liabilities'
  | 'Vendor Payables'
  | 'Loans & Borrowings'
  | 'Capital & Equity'
  | 'Retained Earnings'
  | 'Direct Income'
  | 'Indirect Income'
  | 'Fee Revenue'
  | 'Operating Expenses'
  | 'Administrative Expenses'
  | 'Payroll Expenses'
  | 'Maintenance Expenses'
  | 'Tax Liabilities';

export interface Account {
  id: string;
  collegeId: string;
  code: string;
  name: string;
  type: AccountType;
  group: AccountGroup;
  parentId?: string | null;
  openingBalance: number;
  currentBalance: number;
  isSystem?: boolean;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export type VoucherType = 'receipt' | 'payment' | 'journal' | 'contra';

export interface VoucherLineItem {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface Voucher {
  id: string;
  collegeId: string;
  voucherNo: string;
  type: VoucherType;
  date: string;
  particulars: string;
  narration?: string;
  lineItems: VoucherLineItem[];
  totalAmount: number;
  status: 'draft' | 'posted' | 'reversed';
  financialYear: string;
  preparedBy: {
    id: string;
    name: string;
    email: string;
  };
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
  updatedAt?: string;
  reversalReason?: string;
  reversedVoucherNo?: string;
}

export interface LedgerEntry {
  id: string;
  collegeId: string;
  accountId: string;
  accountName: string;
  voucherId: string;
  voucherNo: string;
  voucherType: VoucherType;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  financialYear: string;
  createdAt: string;
}

export interface StudentFeePayment {
  id: string;
  collegeId: string;
  studentId: string;
  studentName: string;
  studentUsn?: string;
  classId: string;
  className?: string;
  receiptNo: string;
  date: string;
  category: 'Tuition' | 'Admission' | 'Hostel' | 'Transport' | 'Library' | 'Exam' | 'Misc';
  amount: number;
  discountAmount?: number;
  netAmount: number;
  paymentMode: 'Cash' | 'Online' | 'Cheque' | 'Bank Transfer';
  referenceNo?: string;
  bankAccountId?: string;
  remarks?: string;
  collectedBy: string;
  academicYear: string;
  voucherId?: string;
  status: 'completed' | 'refunded' | 'adjusted';
  createdAt: string;
}

export interface FeeRefund {
  id: string;
  collegeId: string;
  studentId: string;
  studentName: string;
  feePaymentId: string;
  receiptNo: string;
  refundAmount: number;
  reason: string;
  paymentMode: 'Cash' | 'Online' | 'Cheque' | 'Bank Transfer';
  date: string;
  processedBy: string;
  voucherId?: string;
  createdAt: string;
}

export interface IncomeRecord {
  id: string;
  collegeId: string;
  category: 'Admission Fees' | 'Tuition Fees' | 'Hostel Fees' | 'Transport Fees' | 'Library Fees' | 'Miscellaneous Income' | 'Donation & Grants';
  title: string;
  amount: number;
  accountId: string;
  accountName: string;
  date: string;
  receivedFrom: string;
  paymentMode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online';
  referenceNo?: string;
  bankAccountId?: string;
  notes?: string;
  voucherId?: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  collegeId: string;
  category: 'Office Expenses' | 'Utility Bills' | 'Maintenance' | 'Purchases' | 'Vendor Payments' | 'Miscellaneous Expenses';
  title: string;
  amount: number;
  accountId: string;
  accountName: string;
  vendorId?: string;
  vendorName?: string;
  date: string;
  paidTo: string;
  paymentMode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online';
  referenceNo?: string;
  bankAccountId?: string;
  invoiceNo?: string;
  invoiceUrl?: string;
  invoiceName?: string;
  notes?: string;
  voucherId?: string;
  createdAt: string;
}

export interface CashClosing {
  id: string;
  collegeId: string;
  date: string;
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  calculatedClosingBalance: number;
  actualPhysicalCash: number;
  difference: number;
  denominations: Record<string, number>; // e.g. { '500': 10, '200': 5, '100': 20, ... }
  closedBy: string;
  notes?: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  collegeId: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: 'Savings' | 'Current' | 'Fixed Deposit';
  currentBalance: number;
  openingBalance: number;
  isPrimary?: boolean;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  collegeId: string;
  bankAccountId: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  date: string;
  referenceNo?: string;
  description: string;
  targetBankAccountId?: string;
  reconciled: boolean;
  reconciledDate?: string;
  voucherId?: string;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  collegeId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  monthYear: string; // e.g., '2025-03'
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  tdsDeduction: number;
  pfDeduction: number;
  professionalTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  paymentStatus: 'pending' | 'paid';
  paymentDate?: string;
  paymentMode?: 'Bank Transfer' | 'Cheque' | 'Cash';
  bankAccountId?: string;
  voucherId?: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  collegeId: string;
  name: string;
  companyName?: string;
  category: string;
  email: string;
  phone: string;
  gstin?: string;
  pan?: string;
  address?: string;
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
}

export interface PurchaseBill {
  id: string;
  collegeId: string;
  vendorId: string;
  vendorName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'unpaid' | 'partially_paid' | 'paid';
  invoiceUrl?: string;
  invoiceName?: string;
  voucherId?: string;
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  collegeId: string;
  assetCode: string;
  name: string;
  category: 'Furniture' | 'Computers & IT' | 'Lab Equipment' | 'Vehicles' | 'Buildings' | 'Land' | 'Other';
  purchaseDate: string;
  purchasePrice: number;
  usefulLifeYears: number;
  salvageValue: number;
  depreciationMethod: 'Straight Line' | 'Written Down Value';
  depreciationRate: number; // percentage
  accumulatedDepreciation: number;
  currentNetBookValue: number;
  location?: string;
  status: 'active' | 'disposed' | 'written_off';
  disposalDate?: string;
  disposalPrice?: number;
  voucherId?: string;
  createdAt: string;
}

export interface TaxRecord {
  id: string;
  collegeId: string;
  taxType: 'GST' | 'TDS' | 'Professional Tax';
  period: string; // e.g. '2025-Q1' or '2025-03'
  taxableAmount: number;
  taxRate: number; // percentage
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  status: 'due' | 'filed' | 'paid';
  challanNo?: string;
  paymentDate?: string;
  notes?: string;
  createdAt: string;
}

export interface FinancialAuditLog {
  id: string;
  collegeId: string;
  action: 'create' | 'update' | 'delete' | 'post' | 'reverse' | 'reconcile' | 'close';
  entityType: 'Voucher' | 'Account' | 'FeePayment' | 'Expense' | 'Income' | 'Payroll' | 'Vendor' | 'Asset' | 'Bank';
  entityId: string;
  summary: string;
  details?: any;
  userEmail: string;
  userName: string;
  timestamp: string;
}

export interface AccountingSettings {
  id?: string;
  collegeId: string;
  currentFinancialYear: string; // e.g., '2025-2026'
  currencySymbol: string; // '₹'
  voucherPrefixes: {
    receipt: string;
    payment: string;
    journal: string;
    contra: string;
  };
  enableAutoVoucherNo: boolean;
  defaultCashAccountId?: string;
  defaultBankAccountId?: string;
  defaultFeeIncomeAccountId?: string;
}

export interface FinancialSummaryMetrics {
  totalIncome: number;
  totalExpenses: number;
  cashInHand: number;
  bankBalance: number;
  pendingFeeCollection: number;
  pendingPayments: number;
  netProfitLoss: number;
}
