'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, RefreshCw, Database, Download, Upload, CheckCircle2 } from 'lucide-react';
import type { AccountingSettings as AccountingSettingsType } from '@/lib/accounting-types';

interface AccountingSettingsProps {
  settings: AccountingSettingsType | null;
  onSaveSettings: (settings: AccountingSettingsType) => Promise<void>;
  onBackupRestore?: (data: any) => Promise<void>;
}

export function AccountingSettingsComponent({
  settings,
  onSaveSettings,
}: AccountingSettingsProps) {
  const [financialYear, setFinancialYear] = useState<string>(settings?.currentFinancialYear || '2025-2026');
  const [currencySymbol, setCurrencySymbol] = useState<string>(settings?.currencySymbol || '₹');
  const [receiptPrefix, setReceiptPrefix] = useState<string>(settings?.voucherPrefixes?.receipt || 'RV');
  const [paymentPrefix, setPaymentPrefix] = useState<string>(settings?.voucherPrefixes?.payment || 'PV');
  const [journalPrefix, setJournalPrefix] = useState<string>(settings?.voucherPrefixes?.journal || 'JV');
  const [contraPrefix, setContraPrefix] = useState<string>(settings?.voucherPrefixes?.contra || 'CV');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSaveSettings({
        collegeId: settings?.collegeId || '',
        currentFinancialYear: financialYear,
        currencySymbol,
        voucherPrefixes: {
          receipt: receiptPrefix,
          payment: paymentPrefix,
          journal: journalPrefix,
          contra: contraPrefix,
        },
        enableAutoVoucherNo: true,
      });

      setSuccessMsg('Accounting settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-slate-700" /> Accounting Module Settings
          </h2>
          <p className="text-muted-foreground text-sm">
            Financial Year definitions, voucher auto-numbering prefixes, currency formatting, and JSON backup/restore.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Financial Year Card */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold font-headline">Financial Year & Currency</CardTitle>
              <CardDescription>Configure active accounting period and currency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="s-fy">Active Financial Year *</Label>
                <Select value={financialYear} onValueChange={setFinancialYear}>
                  <SelectTrigger id="s-fy">
                    <SelectValue placeholder="Financial Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025-2026">2025-2026 (Apr 2025 - Mar 2026)</SelectItem>
                    <SelectItem value="2024-2025">2024-2025 (Apr 2024 - Mar 2025)</SelectItem>
                    <SelectItem value="2026-2027">2026-2027 (Apr 2026 - Mar 2027)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="s-curr">Default Currency Symbol</Label>
                <Input id="s-curr" value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Voucher Prefix Rules */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold font-headline">Voucher Numbering Prefixes</CardTitle>
              <CardDescription>Prefixes for auto-numbered double-entry vouchers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="v-r-pre" className="text-xs">Receipt Voucher Prefix</Label>
                  <Input id="v-r-pre" value={receiptPrefix} onChange={(e) => setReceiptPrefix(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="v-p-pre" className="text-xs">Payment Voucher Prefix</Label>
                  <Input id="v-p-pre" value={paymentPrefix} onChange={(e) => setPaymentPrefix(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="v-j-pre" className="text-xs">Journal Voucher Prefix</Label>
                  <Input id="v-j-pre" value={journalPrefix} onChange={(e) => setJournalPrefix(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="v-c-pre" className="text-xs">Contra Voucher Prefix</Label>
                  <Input id="v-c-pre" value={contraPrefix} onChange={(e) => setContraPrefix(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="gap-2 bg-primary hover:bg-primary/90">
            <Save className="h-4 w-4" /> Save Accounting Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
