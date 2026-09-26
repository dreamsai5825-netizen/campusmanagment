'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Account, Voucher, StudentFeePayment } from '@/lib/accounting-types';
import { exportToExcel, exportToCSV } from '@/lib/accounting-export';

interface ImportExportCenterProps {
  accounts: Account[];
  vouchers: Voucher[];
  feePayments: StudentFeePayment[];
  onImportAccounts: (importedAccounts: Omit<Account, 'id' | 'collegeId' | 'createdAt'>[]) => Promise<void>;
}

export function ImportExportCenter({
  accounts,
  vouchers,
  feePayments,
  onImportAccounts,
}: ImportExportCenterProps) {
  const [importStatus, setImportStatus] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const parsedAccounts = data.map((row) => ({
          code: String(row.Code || row['Account Code'] || Math.floor(1000 + Math.random() * 9000)),
          name: String(row.Name || row['Account Name'] || 'New Ledger'),
          type: (row.Type || row['Account Type'] || 'expense').toLowerCase(),
          group: String(row.Group || row['Account Group'] || 'Operating Expenses'),
          openingBalance: parseFloat(row.OpeningBalance || row['Opening Balance']) || 0,
          currentBalance: parseFloat(row.OpeningBalance || row['Opening Balance']) || 0,
          description: String(row.Description || 'Imported via Excel'),
        }));

        await onImportAccounts(parsedAccounts as any);
        setImportStatus(`Successfully imported ${parsedAccounts.length} ledger accounts!`);
      } catch (err: any) {
        setImportStatus(`Import Error: ${err.message || 'Invalid Excel format'}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      { Code: '1008', Name: 'Solar Power Plant Equipment', Type: 'asset', Group: 'Fixed Assets', OpeningBalance: 150000, Description: 'Rooftop solar panels' },
      { Code: '4008', Name: 'Auditorium Booking Fee', Type: 'income', Group: 'Indirect Income', OpeningBalance: 0, Description: 'Facility rental revenue' },
      { Code: '5007', Name: 'Security Guard Outsource Services', Type: 'expense', Group: 'Operating Expenses', OpeningBalance: 0, Description: 'Campus security agency bill' },
    ];
    exportToExcel(sampleData, 'Chart_of_Accounts_Import_Template');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" /> Data Import & Export Hub
          </h2>
          <p className="text-muted-foreground text-sm">
            Bulk Excel / CSV spreadsheet import for opening balances and accounts, and mass export for audits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import Card */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold font-headline flex items-center gap-2">
              <Upload className="h-5 w-5 text-emerald-600" /> Bulk Import Ledger Accounts & Balances
            </CardTitle>
            <CardDescription>Upload Excel (.xlsx, .xls) spreadsheet to bulk seed ledgers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={downloadSampleTemplate} variant="outline" className="w-full justify-start gap-2 border-emerald-300 text-emerald-800 bg-emerald-50">
              <Download className="h-4 w-4" /> Download Sample Import Excel Template
            </Button>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors">
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" id="excel-import-file" />
              <label htmlFor="excel-import-file" className="cursor-pointer space-y-2 block">
                <FileSpreadsheet className="h-10 w-10 text-emerald-600 mx-auto" />
                <div className="font-semibold text-slate-800">Click to upload Excel / CSV spreadsheet</div>
                <div className="text-xs text-slate-500">Supports .xlsx, .xls, .csv files</div>
              </label>
            </div>

            {importStatus && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> {importStatus}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Card */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold font-headline flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" /> Mass Export Center
            </CardTitle>
            <CardDescription>Download complete system financial datasets in Excel & CSV.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => exportToExcel(accounts, 'All_Chart_of_Accounts')}
              variant="outline"
              className="w-full justify-start gap-3 h-12"
            >
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <div className="text-left">
                <div className="font-semibold text-sm">Export Chart of Accounts (.xlsx)</div>
                <div className="text-xs text-slate-500">All {accounts.length} ledger account definitions</div>
              </div>
            </Button>

            <Button
              onClick={() => exportToExcel(vouchers, 'All_Posted_Vouchers')}
              variant="outline"
              className="w-full justify-start gap-3 h-12"
            >
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              <div className="text-left">
                <div className="font-semibold text-sm">Export Double-Entry Vouchers (.xlsx)</div>
                <div className="text-xs text-slate-500">All {vouchers.length} posted vouchers</div>
              </div>
            </Button>

            <Button
              onClick={() => exportToExcel(feePayments, 'Student_Fee_Receipts')}
              variant="outline"
              className="w-full justify-start gap-3 h-12"
            >
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              <div className="text-left">
                <div className="font-semibold text-sm">Export Student Fee Collections (.xlsx)</div>
                <div className="text-xs text-slate-500">All {feePayments.length} student fee receipts</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
