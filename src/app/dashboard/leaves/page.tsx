'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrentTeacher, useCurrentPrincipal } from '@/hooks/use-current-user';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { TeacherLeave, LeaveRequest } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  CalendarOff,
  Calendar,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  CalendarCheck2,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_LEAVE_QUOTAS,
  STANDARD_LEAVE_TYPES,
  calculateLeaveDuration,
  submitTeacherLeaveRequest,
} from '@/lib/leave-service';

export default function TeacherMyLeavesPage() {
  const teacher = useCurrentTeacher();
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [leaves, setLeaves] = useState<TeacherLeave[]>([]);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [leaveType, setLeaveType] = useState('Casual Leave (CL)');
  const [customTypeName, setCustomTypeName] = useState('');
  const [subject, setSubject] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<'First Half (Morning)' | 'Second Half (Afternoon)'>('First Half (Morning)');
  const [reason, setReason] = useState('');

  // 1. Subscribe to teacher's approved leaves subcollection
  useEffect(() => {
    if (!teacher?.id) return;
    const qLeaves = query(collection(db, 'teachers', teacher.id, 'leaves'));
    const unsub = onSnapshot(qLeaves, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as TeacherLeave[];
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLeaves(list);
    });
    return () => unsub();
  }, [teacher?.id]);

  // 2. Subscribe to teacher's leave requests
  useEffect(() => {
    if (!teacher?.id || !teacher?.collegeId) return;
    const qRequests = query(
      collection(db, 'leaveRequests'),
      where('collegeId', '==', teacher.collegeId),
      where('senderId', '==', teacher.id)
    );
    const unsub = onSnapshot(qRequests, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as LeaveRequest[];
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setMyLeaveRequests(list);
    });
    return () => unsub();
  }, [teacher?.id, teacher?.collegeId]);

  const categoryQuotas: Record<string, number> = useMemo(() => {
    return { ...DEFAULT_LEAVE_QUOTAS, ...(teacher?.leaveQuotas ?? {}) };
  }, [teacher?.leaveQuotas]);

  // Compute Category-wise Breakdown
  const categoryBreakdown = useMemo(() => {
    const categories = Array.from(
      new Set([...Object.keys(categoryQuotas), ...leaves.map((l) => l.type)])
    );

    const map: Record<string, { allotted: number; taken: number; balance: number }> = {};

    categories.forEach((cat) => {
      const allotted = categoryQuotas[cat] ?? 0;
      const taken = leaves
        .filter((l) => l.type === cat)
        .reduce((sum, l) => sum + (l.duration ?? 1.0), 0);
      const balance = Math.max(0, allotted - taken);
      map[cat] = { allotted, taken, balance };
    });

    return map;
  }, [categoryQuotas, leaves]);

  // Overall totals across all categories
  const overallTotals = useMemo(() => {
    let totalAllotted = 0;
    let totalTaken = 0;
    Object.values(categoryBreakdown).forEach((item) => {
      totalAllotted += item.allotted;
      totalTaken += item.taken;
    });
    const totalBalance = Math.max(0, totalAllotted - totalTaken);
    return { totalAllotted, totalTaken, totalBalance };
  }, [categoryBreakdown]);

  // Available leave categories for the dropdown
  const availableCategories = useMemo(() => {
    const catSet = new Set<string>([
      ...Object.keys(categoryQuotas),
      ...STANDARD_LEAVE_TYPES,
    ]);
    return Array.from(catSet);
  }, [categoryQuotas]);

  // Calculated duration for the active form
  const requestedDuration = useMemo(() => {
    return calculateLeaveDuration(startDate, isHalfDay ? startDate : endDate, isHalfDay);
  }, [startDate, endDate, isHalfDay]);

  // Current balance of the selected type
  const selectedTypeBalance = useMemo(() => {
    const finalKey = leaveType === 'Other (Custom)' ? customTypeName.trim() : leaveType;
    if (!finalKey) return 0;
    return categoryBreakdown[finalKey]?.balance ?? 0;
  }, [leaveType, customTypeName, categoryBreakdown]);

  // Projected balance after approval
  const projectedBalance = useMemo(() => {
    return selectedTypeBalance - requestedDuration;
  }, [selectedTypeBalance, requestedDuration]);

  const handleOpenApply = (prefillType?: string) => {
    setLeaveType(prefillType || Object.keys(categoryQuotas)[0] || 'Casual Leave (CL)');
    setCustomTypeName('');
    setSubject('');
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setIsHalfDay(false);
    setHalfDaySession('First Half (Morning)');
    setReason('');
    setIsApplyOpen(true);
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;

    if (leaveType === 'Other (Custom)' && !customTypeName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing leave type',
        description: 'Please specify the name of the custom leave type.',
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing subject',
        description: 'Please enter a brief subject or title for your leave request.',
      });
      return;
    }

    if (!startDate || (!isHalfDay && !endDate)) {
      toast({
        variant: 'destructive',
        title: 'Missing dates',
        description: 'Please select valid start and end dates.',
      });
      return;
    }

    if (!isHalfDay && startDate > endDate) {
      toast({
        variant: 'destructive',
        title: 'Invalid date range',
        description: 'End date must be on or after start date.',
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing reason',
        description: 'Please provide a reason for the leave.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitTeacherLeaveRequest({
        teacher,
        leaveType,
        customTypeName,
        subject,
        startDate,
        endDate: isHalfDay ? startDate : endDate,
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : undefined,
        reason,
        principalId: principal?.id,
      });

      toast({
        title: 'Leave Request Submitted',
        description: `Your request for ${
          leaveType === 'Other (Custom)' ? customTypeName : leaveType
        } (${requestedDuration} day${requestedDuration > 1 ? 's' : ''}) has been sent for approval.`,
      });

      setIsApplyOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit leave request.';
      toast({ variant: 'destructive', title: 'Submission Failed', description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!teacher) return null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-6xl mx-auto pb-12">
      {/* Header with Apply Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl flex items-center gap-2">
            <CalendarOff className="h-7 w-7 text-purple-600 shrink-0" />
            My Leave Bank & Quotas
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Apply for leave, track quotas, and monitor approval status in real time.
          </p>
        </div>

        <Button
          onClick={() => handleOpenApply()}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-sm shrink-0"
          size="lg"
        >
          <PlusCircle className="h-5 w-5" />
          Apply for Leave
        </Button>
      </div>

      <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmitLeave}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <CalendarCheck2 className="h-5 w-5 text-purple-600" />
                  Apply for Leave
                </DialogTitle>
                <DialogDescription>
                  Select your leave type and dates. Once approved by the administrator, the days will be automatically deducted from your leave balance.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Leave Type Selector */}
                <div className="space-y-2">
                  <Label htmlFor="leave-type" className="font-semibold text-sm">
                    Leave Type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger id="leave-type" className="w-full">
                      <SelectValue placeholder="Select leave category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {availableCategories.map((cat) => {
                        const bal = categoryBreakdown[cat]?.balance;
                        return (
                          <SelectItem key={cat} value={cat}>
                            <div className="flex items-center justify-between gap-4 w-full">
                              <span>{cat}</span>
                              {bal !== undefined && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  Bal: {bal.toFixed(1)}d
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Type Name if 'Other (Custom)' */}
                {leaveType === 'Other (Custom)' && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="custom-type-name" className="text-sm font-semibold">
                      Custom Leave Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="custom-type-name"
                      placeholder="e.g. Sabbatical Leave, Study Leave"
                      value={customTypeName}
                      onChange={(e) => setCustomTypeName(e.target.value)}
                    />
                  </div>
                )}

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="leave-subject" className="text-sm font-semibold">
                    Subject / Purpose <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="leave-subject"
                    placeholder="e.g., Doctor appointment, Family emergency"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* Dates & Half Day Option */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date" className="text-sm font-semibold">
                      Start Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (isHalfDay || e.target.value > endDate) {
                          setEndDate(e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-date" className="text-sm font-semibold">
                      End Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={isHalfDay ? startDate : endDate}
                      disabled={isHalfDay}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Half Day Checkbox */}
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="half-day"
                    checked={isHalfDay}
                    onCheckedChange={(checked) => {
                      const val = !!checked;
                      setIsHalfDay(val);
                      if (val) setEndDate(startDate);
                    }}
                  />
                  <Label htmlFor="half-day" className="text-sm font-medium cursor-pointer">
                    Apply as Half Day (0.5 Day)
                  </Label>
                </div>

                {/* Half Day Session Selector */}
                {isHalfDay && (
                  <div className="space-y-2 pl-6 animate-fade-in">
                    <Label htmlFor="half-day-session" className="text-xs font-semibold text-muted-foreground">
                      Session
                    </Label>
                    <Select
                      value={halfDaySession}
                      onValueChange={(val) => setHalfDaySession(val as any)}
                    >
                      <SelectTrigger id="half-day-session" className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="First Half (Morning)">First Half (Morning)</SelectItem>
                        <SelectItem value="Second Half (Afternoon)">Second Half (Afternoon)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="leave-reason" className="text-sm font-semibold">
                    Detailed Reason <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="leave-reason"
                    rows={3}
                    placeholder="Briefly explain the reason for your leave request..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                {/* Real-time Calculation & Quota Preview */}
                <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Requested Duration:</span>
                    <span className="font-bold text-foreground">
                      {requestedDuration.toFixed(1)} Day{requestedDuration > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Current Available Balance:</span>
                    <span className="font-semibold text-foreground">
                      {selectedTypeBalance.toFixed(1)} Day{selectedTypeBalance !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm border-t pt-2">
                    <span className="font-medium text-foreground">Projected Balance After Approval:</span>
                    <span
                      className={`font-bold ${
                        projectedBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {Math.max(0, projectedBalance).toFixed(1)} Day{projectedBalance !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {projectedBalance < 0 && (
                    <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-900/50 mt-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <span>
                        Requested duration exceeds current quota balance by {Math.abs(projectedBalance).toFixed(1)} day(s). The admin may approve this as Loss of Pay (LOP) or adjust your quota.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsApplyOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit Leave Request'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Total Allotted Leaves
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-blue-700 dark:text-blue-400">
              {overallTotals.totalAllotted.toFixed(1)}{' '}
              <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sum of all category leave quotas</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Total Leaves Taken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-400">
              {overallTotals.totalTaken.toFixed(1)}{' '}
              <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Approved days deducted from balance</p>
          </CardContent>
        </Card>

        <Card
          className={`border ${
            overallTotals.totalBalance > 5
              ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20'
              : overallTotals.totalBalance > 0
              ? 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20'
              : 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/20'
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Total Remaining Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-extrabold ${
                overallTotals.totalBalance > 5
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : overallTotals.totalBalance > 0
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {overallTotals.totalBalance.toFixed(1)}{' '}
              <span className="text-sm font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Available leave balance across all categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Card Banner */}
      <Card
        onClick={() => handleOpenApply()}
        className="cursor-pointer border border-purple-200 dark:border-purple-900/60 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md hover:shadow-lg hover:brightness-105 transition-all p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl group"
      >
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <CalendarCheck2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg">Apply for Leave</h3>
              <Badge className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-semibold uppercase tracking-wider border-0">
                Quick Apply
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-purple-100 mt-0.5">
              Select your leave category, choose single/multiple days or half-day sessions. Deductions apply once approved.
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="bg-white text-purple-700 hover:bg-purple-50 font-bold shadow-xs shrink-0 self-start sm:self-auto gap-1.5"
        >
          <PlusCircle className="h-4 w-4" />
          Apply for Leave
        </Button>
      </Card>

      {/* Category-Wise Breakdown Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight uppercase text-muted-foreground text-xs">
            Category-Wise Leave Quota Breakdown
          </h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Click any category card or the action card to apply
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(categoryBreakdown).map(([catName, item]) => (
            <Card
              key={catName}
              onClick={() => handleOpenApply(catName)}
              className="shadow-2xs border cursor-pointer hover:border-purple-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden flex flex-col justify-between"
            >
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold truncate pr-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {catName}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold shrink-0 ${
                    item.balance > 2
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                      : item.balance > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  Bal: {item.balance.toFixed(1)}d
                </Badge>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pt-2 border-t mt-1">
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase">Allotted</span>
                    <span className="font-bold text-foreground text-sm">{item.allotted}d</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase">Taken</span>
                    <span className="font-bold text-amber-600 text-sm">{item.taken.toFixed(1)}d</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground uppercase">Balance</span>
                    <span className="font-bold text-emerald-600 text-sm">{item.balance.toFixed(1)}d</span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-dashed flex items-center justify-between text-[11px] text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  <span className="flex items-center gap-1 font-medium">
                    <CalendarCheck2 className="h-3.5 w-3.5" />
                    Click to apply for this
                  </span>
                  <span className="font-semibold group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Dedicated Apply for Leave Action Card (Fills the 6th slot!) */}
          <Card
            onClick={() => handleOpenApply()}
            className="group cursor-pointer border-2 border-dashed border-purple-300 dark:border-purple-700 hover:border-purple-600 bg-gradient-to-br from-purple-50/80 via-indigo-50/50 to-fuchsia-50/60 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-fuchsia-950/30 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between overflow-hidden relative min-h-[140px]"
          >
            <div className="absolute -right-3 -bottom-3 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <CalendarCheck2 className="h-28 w-28 text-purple-600" />
            </div>
            <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between space-y-0 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-purple-900 dark:text-purple-200 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                    Apply for Leave
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">Request time off</p>
                </div>
              </div>
              <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold uppercase px-2 py-0.5 tracking-wider shadow-xs">
                Apply Here
              </Badge>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-2 relative z-10">
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
                Submit a leave request for CL, ML, OD, or custom leaves with automatic quota tracking.
              </p>
              <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300 pt-2 border-t border-purple-200/80 dark:border-purple-800/60 font-semibold">
                <span>Select dates & category</span>
                <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Apply Now &rarr;
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs: Leave Requests vs Approved Log History */}
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            My Leave Requests ({myLeaveRequests.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Approved Leave History ({leaves.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: My Leave Requests */}
        <TabsContent value="requests">
          <Card className="shadow-sm mt-3">
            <CardHeader className="bg-gradient-to-r from-purple-50/60 to-indigo-50/60 dark:from-purple-950/30 dark:to-indigo-950/30 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    Leave Requests & Real-time Status
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Track requests submitted to the administrator and their approval status.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenApply()}
                  className="hidden sm:inline-flex items-center gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" />
                  New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {myLeaveRequests.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <CalendarOff className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-base">No leave requests submitted yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When you apply for leave, your requests will appear here.
                  </p>
                  <Button
                    onClick={() => handleOpenApply()}
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Apply for Leave
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {myLeaveRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-all"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            {req.subject}
                          </span>
                          <Badge
                            variant="outline"
                            className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 text-xs font-semibold"
                          >
                            {req.leaveType || 'Casual Leave (CL)'}
                          </Badge>
                          {req.isHalfDay && (
                            <Badge variant="secondary" className="text-xs">
                              {req.halfDaySession || 'Half Day'}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Dates:</span>{' '}
                          {req.startDate === req.endDate
                            ? format(new Date(req.startDate), 'dd MMM yyyy (EEE)')
                            : `${format(new Date(req.startDate), 'dd MMM yyyy')} to ${format(
                                new Date(req.endDate),
                                'dd MMM yyyy'
                              )}`}{' '}
                          • <span className="font-semibold">{req.duration ?? (req.isHalfDay ? 0.5 : 1.0)} Day(s)</span>
                        </p>

                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Reason:</span> {req.reason}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 pt-0.5">
                          <span>
                            Submitted: {req.createdAt ? format(new Date(req.createdAt), 'dd MMM yyyy, hh:mm a') : '—'}
                          </span>
                          {req.approvedAt && (
                            <span className="text-emerald-600 font-medium">
                              • Approved on {format(new Date(req.approvedAt), 'dd MMM yyyy')} by {req.approvedBy || 'Admin'}
                            </span>
                          )}
                          {req.rejectedAt && (
                            <span className="text-rose-600 font-medium">
                              • Rejected on {format(new Date(req.rejectedAt), 'dd MMM yyyy')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {req.status === 'approved' && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 py-1 px-3">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Approved & Deducted
                          </Badge>
                        )}
                        {req.status === 'rejected' && (
                          <Badge variant="destructive" className="flex items-center gap-1.5 py-1 px-3">
                            <XCircle className="h-3.5 w-3.5" />
                            Rejected
                          </Badge>
                        )}
                        {req.status === 'pending' && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1.5 py-1 px-3"
                          >
                            <Clock className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                            Pending Approval
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Approved Leave History */}
        <TabsContent value="history">
          <Card className="shadow-sm mt-3">
            <CardHeader className="bg-gradient-to-r from-purple-50/60 to-blue-50/60 dark:from-purple-950/30 dark:to-blue-950/30 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    Approved Leave History ({leaves.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Official leave records deducted from your balance and recorded in the college attendance register.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-300">
                  Deducted Records
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {leaves.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <CalendarOff className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold text-base">No leave records logged yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When your leave requests are approved, they are automatically logged and deducted here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {leaves.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            {format(new Date(item.date), 'dd MMMM yyyy (EEEE)')}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold ${
                              item.duration === 0.5
                                ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {item.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span>Reason: {item.reason}</span>
                          {item.halfDaySession && (
                            <span className="font-medium text-purple-600 dark:text-purple-400">
                              • ({item.halfDaySession})
                            </span>
                          )}
                        </p>
                        {item.appliedBy && (
                          <p className="text-[11px] text-muted-foreground/70">
                            Authorized by: {item.appliedBy}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={`text-xs font-extrabold px-3 py-1.5 rounded-lg border ${
                            item.duration === 0.5
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300'
                              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300'
                          }`}
                        >
                          {item.duration === 0.5 ? '0.5 Day (Half Day)' : '1.0 Day (Full Day)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
