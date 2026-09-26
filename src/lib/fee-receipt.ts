import { format } from 'date-fns';
import type { Student } from '@/lib/types';
import { getStudentFeeSummary, type FeePaymentRecord } from '@/lib/student-fees';

export type ReceiptCollegeInfo = {
  name: string;
  code?: string;
  logoUrl?: string;
  logo2Url?: string;
  address?: string;
};

const RECEIPT_STYLES = `
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: white; color: #111; }
  .receipt-container { max-width: 800px; margin: 0 auto; border: 2px solid #000; padding: 24px; background: white; }
  .header { border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 20px; }
  .header-content { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .header-logo { width: 75px; height: 75px; object-fit: contain; flex-shrink: 0; }
  .header-logo-placeholder { width: 75px; height: 75px; flex-shrink: 0; }
  .header-center { flex: 1; text-align: center; }
  .college-name { font-size: 22px; font-weight: 800; margin: 0 0 4px 0; color: #000; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
  .college-address { font-size: 12px; color: #333; margin: 2px 0; line-height: 1.4; max-width: 500px; margin-left: auto; margin-right: auto; }
  .college-code-badge { display: inline-block; font-size: 11px; font-weight: 700; background: #f0f0f0; border: 1px solid #ccc; padding: 2px 8px; border-radius: 4px; margin-top: 4px; letter-spacing: 0.5px; }
  .receipt-title { background: #f5f5f5; border: 1px solid #000; padding: 8px 12px; text-align: center; font-size: 16px; font-weight: 800; margin: 16px 0; letter-spacing: 1px; text-transform: uppercase; }
  .student-details-table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; }
  .student-details-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 13px; }
  .student-info div { margin: 4px 0; font-size: 13px; }
  .fee-breakdown-table, .fees-summary-table, .payments-table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; }
  .fee-breakdown-table th, .fee-breakdown-table td,
  .fees-summary-table th, .fees-summary-table td,
  .payments-table th, .payments-table td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; text-align: left; }
  .fee-breakdown-table th, .fees-summary-table th, .payments-table th { background: #f0f0f0; font-weight: bold; }
  .summary { margin: 20px 0; padding: 15px; border: 1px solid #000; background: #fafafa; }
  .summary-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
  .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature-box { text-align: center; border-top: 1px solid #000; padding-top: 8px; width: 40%; font-size: 12px; }
  h3 { margin: 12px 0 6px 0; font-size: 14px; text-transform: uppercase; }
  @media print {
    body { padding: 0; }
    .receipt-container { border: 1.5px solid #000; padding: 20px; }
  }
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatReceiptDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'dd/MM/yyyy');
  } catch {
    return dateString;
  }
}

function collegeHeaderHtml(college: ReceiptCollegeInfo): string {
  const hasLogo1 = !!college.logoUrl;
  const hasLogo2 = !!college.logo2Url;

  const logo1Html = hasLogo1
    ? `<img src="${escapeHtml(college.logoUrl!)}" alt="College Logo" class="header-logo" />`
    : (hasLogo2 ? `<div class="header-logo-placeholder"></div>` : '');

  const logo2Html = hasLogo2
    ? `<img src="${escapeHtml(college.logo2Url!)}" alt="College Logo 2" class="header-logo" />`
    : (hasLogo1 ? `<div class="header-logo-placeholder"></div>` : '');

  return `
    <div class="header">
      <div class="header-content">
        ${logo1Html}
        <div class="header-center">
          <div class="college-name">${escapeHtml(college.name || 'Institution')}</div>
          ${college.address ? `<div class="college-address">${escapeHtml(college.address)}</div>` : ''}
          ${college.code ? `<div class="college-code-badge">INSTITUTION CODE: ${escapeHtml(college.code)}</div>` : ''}
        </div>
        ${logo2Html}
      </div>
    </div>
  `;
}

export function openPrintWindow(html: string, title: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.title = title;
  win.document.close();
  return true;
}

export function buildSinglePaymentReceiptHtml(params: {
  student: Student;
  className: string;
  academicYear: string;
  college: ReceiptCollegeInfo;
  payment: FeePaymentRecord;
  receiptNumber?: string;
}): string {
  const { student, className, academicYear, college, payment, receiptNumber } = params;
  const receiptNo =
    receiptNumber ?? payment.receiptNumber ?? `RCP-${Date.now().toString().slice(-8)}`;
  const paymentDate = formatReceiptDate(payment.date);

  return `<!DOCTYPE html>
<html>
<head>
  <title>Fee Receipt - ${escapeHtml(student.name)}</title>
  <style>${RECEIPT_STYLES}</style>
</head>
<body>
  <div class="receipt-container">
    ${collegeHeaderHtml(college)}
    <div class="receipt-title">FEE RECEIPT</div>
    <div style="display:flex;justify-content:space-between;margin:10px 0;font-size:14px;">
      <div>
        <div><strong>Receipt No:</strong> ${escapeHtml(receiptNo)}</div>
        <div><strong>Receipt Date:</strong> ${format(new Date(), 'dd/MM/yyyy')}</div>
      </div>
      <div>
        <div><strong>Student Name:</strong> ${escapeHtml(student.name)}</div>
        <div><strong>Student ID:</strong> ${escapeHtml(student.studentId)}</div>
        <div><strong>Class:</strong> ${escapeHtml(className)}</div>
        <div><strong>Academic Year:</strong> ${escapeHtml(academicYear)}</div>
      </div>
    </div>
    <table class="payments-table">
      <thead>
        <tr><th>Date</th><th>Amount (₹)</th><th>Method</th><th>Remarks</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${paymentDate}</td>
          <td>${payment.amount.toLocaleString('en-IN')}</td>
          <td>${escapeHtml(payment.method)}</td>
          <td>${escapeHtml(payment.remarks ?? '-')}</td>
        </tr>
      </tbody>
    </table>
    <div class="signatures">
      <div class="signature-box"><strong>Student / Parent Signature</strong></div>
      <div class="signature-box"><strong>Authorized Signature</strong></div>
    </div>
  </div>
</body>
</html>`;
}

export function buildStudentFeeReportReceiptHtml(params: {
  student: Student;
  className: string;
  academicYear: string;
  college: ReceiptCollegeInfo;
}): string {
  const { student, className, academicYear, college } = params;
  const fee = getStudentFeeSummary(student);
  const breakdown = student.fees?.breakdown;
  const payments = [...(student.fees?.paymentHistory ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const breakdownRows = breakdown
    ? `
      <h3>Fee Breakdown</h3>
      <table class="fee-breakdown-table">
        <thead><tr><th>Fee Type</th><th>Amount (₹)</th></tr></thead>
        <tbody>
          ${breakdown.collegeFees ? `<tr><td>College Fees</td><td>${breakdown.collegeFees.toLocaleString('en-IN')}</td></tr>` : ''}
          ${breakdown.libraryFees ? `<tr><td>Library Fees</td><td>${breakdown.libraryFees.toLocaleString('en-IN')}</td></tr>` : ''}
          ${breakdown.hostelFees ? `<tr><td>Hostel Fees</td><td>${breakdown.hostelFees.toLocaleString('en-IN')}</td></tr>` : ''}
          ${breakdown.examFees ? `<tr><td>Exam Fees</td><td>${breakdown.examFees.toLocaleString('en-IN')}</td></tr>` : ''}
          ${breakdown.transportFees ? `<tr><td>Transport Fees</td><td>${breakdown.transportFees.toLocaleString('en-IN')}</td></tr>` : ''}
          ${breakdown.otherFees ? `<tr><td>Other Fees</td><td>${breakdown.otherFees.toLocaleString('en-IN')}</td></tr>` : ''}
          <tr style="font-weight:bold;background:#f0f0f0"><td>Total</td><td>${fee.totalFees.toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>
    `
    : '';

  const paymentRows =
    payments.length > 0
      ? payments
          .map(
            (p, i) => `
        <tr>
          <td>${formatReceiptDate(p.date)}</td>
          <td>${escapeHtml(p.receiptNumber ?? String(i + 1))}</td>
          <td>${p.amount.toLocaleString('en-IN')}</td>
          <td>${escapeHtml(p.method)}</td>
          <td>${escapeHtml(p.remarks ?? '-')}</td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="5" style="text-align:center">No payments recorded</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <title>Fee Report - ${escapeHtml(student.name)}</title>
  <style>${RECEIPT_STYLES}</style>
</head>
<body>
  <div class="receipt-container">
    ${collegeHeaderHtml(college)}
    <div class="receipt-title">STUDENT FEES REPORT — ${escapeHtml(academicYear)}</div>
    <table class="student-details-table">
      <tr>
        <td style="width:50%">
          <div class="student-info">
            <div><strong>Student ID:</strong> ${escapeHtml(student.studentId)}</div>
            <div><strong>Student Name:</strong> ${escapeHtml(student.name)}</div>
            <div><strong>Class:</strong> ${escapeHtml(className)}</div>
          </div>
        </td>
        <td style="width:50%">
          <div class="student-info">
            <div><strong>Academic Year:</strong> ${escapeHtml(academicYear)}</div>
            <div><strong>Report Date:</strong> ${format(new Date(), 'dd/MM/yyyy')}</div>
            <div><strong>Status:</strong> ${escapeHtml(fee.status)}</div>
          </div>
        </td>
      </tr>
    </table>
    ${breakdownRows}
    <table class="fees-summary-table">
      <thead>
        <tr><th>Total Fees</th><th>Paid</th><th>Outstanding</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>₹${fee.totalFees.toLocaleString('en-IN')}</td>
          <td>₹${fee.paidAmount.toLocaleString('en-IN')}</td>
          <td>₹${fee.outstandingAmount.toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>
    <div class="summary">
      <div class="summary-row"><span>Total Fees:</span><span>₹${fee.totalFees.toLocaleString('en-IN')}</span></div>
      <div class="summary-row"><span>Paid:</span><span>₹${fee.paidAmount.toLocaleString('en-IN')}</span></div>
      <div class="summary-row"><span>Balance:</span><span>₹${fee.outstandingAmount.toLocaleString('en-IN')}</span></div>
    </div>
    <h3>Payment History</h3>
    <table class="payments-table">
      <thead>
        <tr><th>Date</th><th>Receipt No</th><th>Amount</th><th>Method</th><th>Remarks</th></tr>
      </thead>
      <tbody>${paymentRows}</tbody>
    </table>
    <div class="signatures">
      <div class="signature-box"><strong>Student Signature</strong></div>
      <div class="signature-box"><strong>Authorized Signature</strong></div>
    </div>
  </div>
</body>
</html>`;
}

export function printSinglePaymentReceipt(
  params: Parameters<typeof buildSinglePaymentReceiptHtml>[0]
): boolean {
  const html = buildSinglePaymentReceiptHtml(params);
  return openPrintWindow(html, `Receipt - ${params.student.name}`);
}

export function printStudentFeeReport(
  params: Parameters<typeof buildStudentFeeReportReceiptHtml>[0]
): boolean {
  const html = buildStudentFeeReportReceiptHtml(params);
  return openPrintWindow(html, `Fee Report - ${params.student.name}`);
}

export function buildPeriodCollectionVoucherHtml(params: {
  college: ReceiptCollegeInfo;
  className: string;
  academicYear: string;
  periodLabel: string;
  payments: Array<{ student: Student; payment: FeePaymentRecord }>;
}): string {
  const { college, className, academicYear, periodLabel, payments } = params;
  const voucherNo = `VCHR-${Date.now().toString().slice(-8)}`;
  const totalAmount = payments.reduce((sum, item) => sum + item.payment.amount, 0);

  const paymentRows = payments
    .map(
      ({ student, payment }, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(student.name)}</strong><br/><small style="color:#555;">ID: ${escapeHtml(student.studentId)}</small></td>
      <td>${formatReceiptDate(payment.date)}</td>
      <td>${escapeHtml(payment.method || 'Cash')}</td>
      <td>${escapeHtml(payment.receiptNumber || '—')}</td>
      <td style="text-align:right;">₹${payment.amount.toLocaleString('en-IN')}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Fee Collection Voucher - ${escapeHtml(college.name)}</title>
  <style>${RECEIPT_STYLES}</style>
</head>
<body>
  <div class="receipt-container">
    ${collegeHeaderHtml(college)}
    <div class="receipt-title">OFFICIAL FEE COLLECTION VOUCHER</div>
    <div style="display:flex;justify-content:space-between;margin:15px 0;font-size:13px;line-height:1.6;">
      <div>
        <div><strong>Voucher No:</strong> ${escapeHtml(voucherNo)}</div>
        <div><strong>Collection Period:</strong> ${escapeHtml(periodLabel)}</div>
        <div><strong>Generation Date:</strong> ${format(new Date(), 'dd/MM/yyyy hh:mm a')}</div>
      </div>
      <div style="text-align:right;">
        <div><strong>Class & Section:</strong> ${escapeHtml(className)}</div>
        <div><strong>Academic Year:</strong> ${escapeHtml(academicYear)}</div>
        <div><strong>Total Transactions:</strong> ${payments.length} payment(s)</div>
      </div>
    </div>
    <table class="payments-table">
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th>Student Details</th>
          <th>Date</th>
          <th>Mode</th>
          <th>Receipt No.</th>
          <th style="text-align:right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows || '<tr><td colspan="6" style="text-align:center;padding:20px;">No fee payments recorded for this period.</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="font-weight:bold;background:#f0f0f0;">
          <td colspan="5" style="text-align:right;">Grand Total Collection:</td>
          <td style="text-align:right;">₹${totalAmount.toLocaleString('en-IN')}</td>
        </tr>
      </tfoot>
    </table>
    <div class="signatures" style="margin-top:50px;">
      <div class="signature-box"><strong>Accounts Officer / Cashier</strong></div>
      <div class="signature-box"><strong>Principal / Institutional Seal</strong></div>
    </div>
  </div>
</body>
</html>`;
}

export function printPeriodCollectionVoucher(
  params: Parameters<typeof buildPeriodCollectionVoucherHtml>[0]
): boolean {
  const html = buildPeriodCollectionVoucherHtml(params);
  return openPrintWindow(html, `Voucher - ${params.college.name}`);
}
