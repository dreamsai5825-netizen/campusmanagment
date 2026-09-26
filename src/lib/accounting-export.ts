import * as XLSX from 'xlsx';
import type { Voucher, StudentFeePayment, PayrollRecord, Account } from './accounting-types';

/** Export any JavaScript array of objects to Excel file (.xlsx) */
export function exportToExcel(data: any[], fileName: string, sheetName: string = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/** Export any JavaScript array of objects to CSV file */
export function exportToCSV(data: any[], fileName: string) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header];
      const escaped = String(val ?? '').replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export type AccountingCollegeInfo = {
  name: string;
  code?: string;
  logoUrl?: string;
  logo2Url?: string;
  address?: string;
};

function formatCollegeHeaderHtml(college?: string | AccountingCollegeInfo, defaultSub = ''): string {
  const colObj: AccountingCollegeInfo = typeof college === 'object' && college !== null
    ? college
    : { name: college || 'Institution' };

  const hasLogo1 = !!colObj.logoUrl;
  const hasLogo2 = !!colObj.logo2Url;

  const logo1Html = hasLogo1
    ? `<img src="${colObj.logoUrl}" alt="Logo" style="width: 65px; height: 65px; object-fit: contain;" />`
    : (hasLogo2 ? `<div style="width: 65px; height: 65px;"></div>` : '');

  const logo2Html = hasLogo2
    ? `<img src="${colObj.logo2Url}" alt="Logo 2" style="width: 65px; height: 65px; object-fit: contain;" />`
    : (hasLogo1 ? `<div style="width: 65px; height: 65px;"></div>` : '');

  return `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px;">
      ${logo1Html}
      <div style="text-align: center; flex: 1;">
        <h1 style="font-size: 22px; font-weight: 800; color: #111; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">${colObj.name}</h1>
        ${colObj.address ? `<div style="font-size: 12px; color: #4b5563; margin-top: 3px;">${colObj.address}</div>` : ''}
        ${colObj.code ? `<div style="font-size: 11px; font-weight: bold; color: #374151; margin-top: 2px;">CODE: ${colObj.code}</div>` : ''}
        ${defaultSub ? `<div style="font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; margin-top: 4px;">${defaultSub}</div>` : ''}
      </div>
      ${logo2Html}
    </div>
  `;
}

/** Print or Download Voucher as Formatted HTML/PDF */
export function printVoucher(voucher: Voucher, college?: string | AccountingCollegeInfo) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const lineItemsHtml = voucher.lineItems
    .map(
      (item, idx) => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #ddd; padding: 8px;"><strong>${item.accountCode}</strong> - ${item.accountName}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${item.description || '-'}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.debit ? '₹' + item.debit.toFixed(2) : '-'}</td>
      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.credit ? '₹' + item.credit.toFixed(2) : '-'}</td>
    </tr>`
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Voucher - ${voucher.voucherNo}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
        .voucher-box { border: 2px solid #2563eb; border-radius: 8px; padding: 24px; max-width: 800px; margin: 0 auto; background: #fff; }
        .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px; text-align: center; }
        .badge { display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; border-radius: 4px; background: #e0e7ff; color: #3730a3; margin-top: 8px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
        th { background: #f3f4f6; border: 1px solid #ddd; padding: 10px; text-align: left; }
        .total-row { font-weight: bold; background: #eff6ff; }
        .footer-sig { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; font-size: 13px; }
        .sig-box { border-top: 1px solid #9ca3af; width: 200px; padding-top: 8px; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right; max-width: 800px; margin: 0 auto 10px;">
        <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
      </div>
      <div class="voucher-box">
        <div class="header">
          ${formatCollegeHeaderHtml(college, 'ACCOUNTING DEPARTMENT MODULE')}
          <div class="badge">${voucher.type.toUpperCase()} VOUCHER</div>
        </div>

        <div class="meta-grid">
          <div><strong>Voucher No:</strong> ${voucher.voucherNo}</div>
          <div><strong>Date:</strong> ${voucher.date}</div>
          <div><strong>Financial Year:</strong> ${voucher.financialYear}</div>
          <div><strong>Prepared By:</strong> ${voucher.preparedBy?.name || 'Authorized Signatory'}</div>
        </div>

        <div style="margin-bottom: 12px; font-size: 14px;">
          <strong>Particulars:</strong> ${voucher.particulars}
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>Account Details</th>
              <th>Narration / Details</th>
              <th style="text-align: right;">Debit (₹)</th>
              <th style="text-align: right;">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
            <tr class="total-row">
              <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>Total</strong></td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${voucher.totalAmount.toFixed(2)}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${voucher.totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${voucher.narration ? `<div style="margin-top: 16px; font-size: 13px; color: #4b5563; background: #f9fafb; padding: 8px; border-left: 3px solid #2563eb;"><strong>Note:</strong> ${voucher.narration}</div>` : ''}

        <div class="footer-sig">
          <div class="sig-box">Prepared By</div>
          <div class="sig-box">Verified By Accountant</div>
          <div class="sig-box">Principal / Manager Approval</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/** Print Fee Receipt */
export function printFeeReceipt(receipt: StudentFeePayment, college?: string | AccountingCollegeInfo) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fee Receipt - ${receipt.receiptNo}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
        .receipt-box { border: 2px dashed #059669; border-radius: 8px; padding: 24px; max-width: 750px; margin: 0 auto; background: #ffffff; }
        .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; text-align: center; }
        .badge { display: inline-block; padding: 4px 14px; font-size: 13px; font-weight: bold; border-radius: 20px; background: #d1fae5; color: #047857; margin-top: 6px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; background: #f0fdf4; padding: 12px; border-radius: 6px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
        th { background: #e6f4ea; border: 1px solid #a7f3d0; padding: 10px; text-align: left; }
        td { border: 1px solid #d1fae5; padding: 10px; }
        .footer-sig { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; font-size: 13px; }
        .sig-box { border-top: 1px solid #6b7280; width: 180px; padding-top: 6px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right; max-width: 750px; margin: 0 auto 10px;">
        <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Print Receipt</button>
      </div>
      <div class="receipt-box">
        <div class="header">
          ${formatCollegeHeaderHtml(college, 'OFFICIAL STUDENT FEE RECEIPT')}
          <div class="badge">RECEIPT NO: ${receipt.receiptNo}</div>
        </div>

        <div class="grid">
          <div><strong>Student Name:</strong> ${receipt.studentName}</div>
          <div><strong>USN / Roll No:</strong> ${receipt.studentUsn || 'N/A'}</div>
          <div><strong>Date:</strong> ${receipt.date}</div>
          <div><strong>Academic Year:</strong> ${receipt.academicYear}</div>
          <div><strong>Payment Mode:</strong> ${receipt.paymentMode}</div>
          <div><strong>Ref / Txn No:</strong> ${receipt.referenceNo || 'N/A'}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fee Category</th>
              <th style="text-align: right;">Gross Amount</th>
              <th style="text-align: right;">Discount / Scholarship</th>
              <th style="text-align: right;">Net Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${receipt.category} Fee</td>
              <td style="text-align: right;">₹${(receipt.amount || receipt.netAmount).toFixed(2)}</td>
              <td style="text-align: right;">- ₹${(receipt.discountAmount || 0).toFixed(2)}</td>
              <td style="text-align: right; font-weight: bold; color: #047857;">₹${receipt.netAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        ${receipt.remarks ? `<div style="margin-top: 12px; font-size: 13px; color: #374151;"><strong>Remarks:</strong> ${receipt.remarks}</div>` : ''}

        <div class="footer-sig">
          <div class="sig-box">Student / Parent Signature</div>
          <div class="sig-box">Accounts Cashier</div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/** Print Employee Payslip */
export function printPayslip(payroll: PayrollRecord, college?: string | AccountingCollegeInfo) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payslip - ${payroll.employeeName} - ${payroll.monthYear}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 30px; color: #333; }
        .payslip-box { border: 2px solid #4f46e5; border-radius: 8px; padding: 24px; max-width: 750px; margin: 0 auto; background: #fff; }
        .header { border-bottom: 2px solid #e0e7ff; padding-bottom: 12px; margin-bottom: 16px; text-align: center; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; background: #eef2ff; padding: 12px; border-radius: 6px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
        th { background: #e0e7ff; border: 1px solid #c7d2fe; padding: 8px; text-align: left; }
        td { border: 1px solid #e0e7ff; padding: 8px; }
        .net-box { background: #4f46e5; color: white; padding: 12px; text-align: center; border-radius: 6px; margin-top: 20px; font-size: 18px; font-weight: bold; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right; max-width: 750px; margin: 0 auto 10px;">
        <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Print Payslip</button>
      </div>
      <div class="payslip-box">
        <div class="header">
          ${formatCollegeHeaderHtml(college, `PAYSLIP FOR THE MONTH OF ${payroll.monthYear}`)}
        </div>

        <div class="grid">
          <div><strong>Employee Name:</strong> ${payroll.employeeName}</div>
          <div><strong>Designation/Role:</strong> ${payroll.employeeRole}</div>
          <div><strong>Payment Date:</strong> ${payroll.paymentDate || 'N/A'}</div>
          <div><strong>Payment Mode:</strong> ${payroll.paymentMode || 'Bank Transfer'}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Earnings</th>
              <th style="text-align: right;">Amount (₹)</th>
              <th>Deductions</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td style="text-align: right;">₹${payroll.basicSalary.toFixed(2)}</td>
              <td>TDS Deduction</td>
              <td style="text-align: right;">₹${payroll.tdsDeduction.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Allowances & HRA</td>
              <td style="text-align: right;">₹${payroll.allowances.toFixed(2)}</td>
              <td>PF Contribution</td>
              <td style="text-align: right;">₹${payroll.pfDeduction.toFixed(2)}</td>
            </tr>
            <tr>
              <td>-</td>
              <td>-</td>
              <td>Professional Tax (PT)</td>
              <td style="text-align: right;">₹${payroll.professionalTax.toFixed(2)}</td>
            </tr>
            <tr>
              <td>-</td>
              <td>-</td>
              <td>Other Deductions</td>
              <td style="text-align: right;">₹${payroll.otherDeductions.toFixed(2)}</td>
            </tr>
            <tr style="font-weight: bold; background: #f5f3ff;">
              <td>Total Gross Earnings</td>
              <td style="text-align: right;">₹${payroll.grossSalary.toFixed(2)}</td>
              <td>Total Deductions</td>
              <td style="text-align: right;">₹${payroll.totalDeductions.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="net-box">
          NET SALARY PAYABLE: ₹${payroll.netSalary.toFixed(2)}
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
