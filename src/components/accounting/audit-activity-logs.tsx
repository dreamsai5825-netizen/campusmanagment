'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { History, Search, ShieldAlert, User, Clock } from 'lucide-react';
import type { FinancialAuditLog } from '@/lib/accounting-types';

interface AuditActivityLogsProps {
  auditLogs: FinancialAuditLog[];
}

export function AuditActivityLogs({ auditLogs }: AuditActivityLogsProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionBadge = (action: FinancialAuditLog['action']) => {
    switch (action) {
      case 'create':
        return <Badge className="bg-emerald-100 text-emerald-800">CREATE</Badge>;
      case 'post':
        return <Badge className="bg-blue-100 text-blue-800">POST</Badge>;
      case 'reverse':
        return <Badge className="bg-rose-100 text-rose-800">REVERSE</Badge>;
      case 'update':
        return <Badge className="bg-amber-100 text-amber-800">UPDATE</Badge>;
      case 'delete':
        return <Badge variant="destructive">DELETE</Badge>;
      default:
        return <Badge variant="outline">{action.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-slate-700" /> Audit Trail & User Activity Logs
          </h2>
          <p className="text-muted-foreground text-sm">
            Complete tamper-evident audit history of all financial vouchers, ledger edits, reversals, and user activities.
          </p>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search summary, user, entity..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Badge variant="outline">{filteredLogs.length} Recorded Events</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      <Badge variant="outline" className="text-[10px] uppercase">{log.entityType}</Badge>
                      <span className="font-semibold text-slate-900">{log.summary}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {log.userName || log.userEmail}</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400">
                No audit activity recorded yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
