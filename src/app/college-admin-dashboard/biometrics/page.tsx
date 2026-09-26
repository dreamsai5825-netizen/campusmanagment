'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import type { College, Teacher, TeacherLeave } from '@/lib/types';
import { TraditionalAttendanceMatrix } from '@/components/traditional-attendance-matrix';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Fingerprint, Calendar, Search, Users, ShieldAlert, CheckCircle2, XCircle, Clock,
  Link2, Settings2, Edit, Save, RefreshCw, Download, History, Building2, SlidersHorizontal,
  FileSpreadsheet, SortAsc, Sliders, RotateCcw, ArrowLeft, ArrowRight, UserCheck, AlertTriangle, ChevronDown
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export type DeptShiftRule = {
  deptName: string;
  scheduleName: string;
  monFriStart: string;
  monFriEnd: string;
  satStart: string;
  satEnd: string;
  graceMins: number;
};

const DEFAULT_DEPARTMENT_SHIFTS: Record<string, DeptShiftRule> = {
  'ADMINISTRATOR': {
    deptName: 'ADMINISTRATOR',
    scheduleName: 'Shift Schedule1 (Normal Shift5)',
    monFriStart: '10:00',
    monFriEnd: '18:00',
    satStart: '10:00',
    satEnd: '18:00',
    graceMins: 15
  },
  'DEGREE': {
    deptName: 'DEGREE',
    scheduleName: 'Shift Schedule2 (Normal Shift2)',
    monFriStart: '10:00',
    monFriEnd: '17:30',
    satStart: '10:00',
    satEnd: '17:30',
    graceMins: 15
  },
  'PARAMEDICAL': {
    deptName: 'PARAMEDICAL',
    scheduleName: 'Shift Schedule3 (Normal Shift2)',
    monFriStart: '10:00',
    monFriEnd: '17:30',
    satStart: '10:00',
    satEnd: '17:30',
    graceMins: 15
  },
  'NURSING': {
    deptName: 'NURSING',
    scheduleName: 'Schedule4 (Normal Shift1 / Shift 4)',
    monFriStart: '09:00',
    monFriEnd: '17:30',
    satStart: '09:00',
    satEnd: '13:00',
    graceMins: 15
  },
  'General Faculty': {
    deptName: 'General Faculty',
    scheduleName: 'Standard Shift',
    monFriStart: '09:15',
    monFriEnd: '17:00',
    satStart: '09:15',
    satEnd: '13:00',
    graceMins: 15
  }
};

const KNOWN_DEPARTMENTS = ['ADMINISTRATOR', 'DEGREE', 'PARAMEDICAL', 'NURSING', 'General Faculty'];

// Circular Progress Donut Ring Component (Hikvision Style)
function HikvisionDonutRing({
  value,
  total,
  color,
  label
}: {
  value: number;
  total: number;
  color: string;
  label: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-3.5 bg-card border rounded-2xl shadow-sm text-center hover:border-primary/40 transition-all">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</h4>
      <div className="relative flex items-center justify-center w-20 h-20">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            className="text-muted/20 stroke-current"
            strokeWidth="7"
            fill="transparent"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            className={`${color} stroke-current transition-all duration-700 ease-out`}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-bold font-mono">{value}</span>
          <span className="text-[10px] text-muted-foreground">{percentage}%</span>
        </div>
      </div>
    </div>
  );
}

// Attendance Rate Semi-Circle Gauge (Hikvision Style)
function HikvisionAttendanceGauge({
  presentCount,
  totalMembers
}: {
  presentCount: number;
  totalMembers: number;
}) {
  const ratePct = totalMembers > 0 ? Math.round((presentCount / totalMembers) * 100) : 0;
  const absentCount = totalMembers - presentCount;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-card border rounded-2xl shadow-sm gap-4">
      <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance Rate</span>
        <div className="text-3xl font-extrabold font-headline tracking-tight text-primary mt-1">{ratePct}%</div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
          <div>Expected: <strong className="text-foreground">{totalMembers}</strong></div>
          <div>Attended: <strong className="text-emerald-600">{presentCount}</strong></div>
          <div>Absent: <strong className="text-rose-600">{absentCount}</strong></div>
        </div>
      </div>

      <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r={radius} className="text-muted/20 stroke-current" strokeWidth="8" fill="transparent" />
          <circle
            cx="45"
            cy="45"
            r={radius}
            className="text-primary stroke-current transition-all duration-700 ease-out"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratePct / 100)}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute font-bold text-base font-mono">{ratePct}%</div>
      </div>
    </div>
  );
}

export default function CollegeAdminBiometricsPage() {
  const router = useRouter();
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  // Active Tab & Search States
  const [activeTab, setActiveTab] = useState('sheet');
  const [selectedDeptCard, setSelectedDeptCard] = useState<string | null>(null);
  
  const [sheetSearch, setSheetSearch] = useState('');
  const [sheetDeptFilter, setSheetDeptFilter] = useState('ALL');
  const [deptSearch, setDeptSearch] = useState('');
  const [deptSingleSearch, setDeptSingleSearch] = useState('');
  const [rulesSearch, setRulesSearch] = useState('');
  const [logsSearch, setLogsSearch] = useState('');
  const [mappingSearch, setMappingSearch] = useState('');
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>([]);
  const [yearMonth, setYearMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [sheetViewMode, setSheetViewMode] = useState<'matrix' | 'daily'>('matrix');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  // Configure Rules state per department
  const [departmentShifts, setDepartmentShifts] = useState<Record<string, DeptShiftRule>>(DEFAULT_DEPARTMENT_SHIFTS);
  const [overtimeMinHours, setOvertimeMinHours] = useState(8);
  const [halfDayHours, setHalfDayHours] = useState(4);
  const [autoAbsent, setAutoAbsent] = useState(true);
  const [savingRules, setSavingRules] = useState(false);

  // Editing mapping & department shift dialog state
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [newBiometricId, setNewBiometricId] = useState('');
  const [newDepartment, setNewDepartment] = useState('General Faculty');
  const [savingMapping, setSavingMapping] = useState(false);

  // Connection configuration dialog
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [configEnabled, setConfigEnabled] = useState(false);
  const [configIp, setConfigIp] = useState('');
  const [configUsername, setConfigUsername] = useState('');
  const [configPassword, setConfigPassword] = useState('');
  const [configMappedDept, setConfigMappedDept] = useState('');
  const [showConfigPassword, setShowConfigPassword] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [isSyncingDevice, setIsSyncingDevice] = useState(false);
  const [isImportingMembers, setIsImportingMembers] = useState(false);
  const [isBackfillingHistory, setIsBackfillingHistory] = useState(false);

  // Custom Date Range Dialog State
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [rangeEndDate, setRangeEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSyncingRange, setIsSyncingRange] = useState(false);

  useEffect(() => {
    if (!principal?.collegeId) return;
    const collegeId = principal.collegeId;

    // Real-time College listener
    const unsubscribeCollege = onSnapshot(doc(db, 'colleges', collegeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as College;
        setCollege({ ...data, id: snap.id } as College);
        
        if (data.biometricSettings) {
          setConfigEnabled(data.biometricSettings.enabled || false);
          setConfigIp(data.biometricSettings.deviceIp || '');
          setConfigUsername(data.biometricSettings.username || '');
          setConfigPassword(data.biometricSettings.password || '');
          setConfigMappedDept(data.biometricSettings.mappedDepartment || '');
        }

        if ((data as any).biometricRules) {
          const r = (data as any).biometricRules;
          if (r.departmentShifts) {
            setDepartmentShifts({
              ...DEFAULT_DEPARTMENT_SHIFTS,
              ...r.departmentShifts
            });
          }
          if (r.overtimeMinHours !== undefined) setOvertimeMinHours(r.overtimeMinHours);
          if (r.halfDayHours !== undefined) setHalfDayHours(r.halfDayHours);
          if (r.autoAbsent !== undefined) setAutoAbsent(r.autoAbsent);
        }
      }
    });

    // Real-time Teachers listener
    const qTeachers = query(collection(db, 'teachers'), where('collegeId', '==', collegeId));
    const unsubscribeTeachers = onSnapshot(qTeachers, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
      setTeachers(list);
    });

    // Real-time Logs listener
    const qLogs = query(collection(db, 'facultyAttendance'), where('collegeId', '==', collegeId));
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      list.sort((a, b) => (b.firstCheckIn || '').localeCompare(a.firstCheckIn || ''));
      setLogs(list);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to biometric logs:", error);
      setLoading(false);
    });

    // Real-time Leaves listener
    const qLeaves = query(collection(db, 'colleges', collegeId, 'teacherLeaves'));
    const unsubscribeLeaves = onSnapshot(qLeaves, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherLeave));
      setTeacherLeaves(list);
    }, (err) => {
      console.warn("Could not load teacherLeaves collection:", err);
    });

    return () => {
      unsubscribeCollege();
      unsubscribeTeachers();
      unsubscribeLogs();
      unsubscribeLeaves();
    };
  }, [principal?.collegeId]);

  // Numeric extractor for sorting Biometric IDs in ascending numerical order
  const getBioIdNum = (id?: string | number) => {
    if (!id) return 999999;
    const match = String(id).match(/\d+/);
    return match ? parseInt(match[0], 10) : 999999;
  };

  // Group teachers by Department with member list sorted ascending by Biometric ID
  const departmentGroups = useMemo(() => {
    const map: Record<string, Teacher[]> = {};
    KNOWN_DEPARTMENTS.forEach(dept => { map[dept] = []; });

    teachers.forEach((t) => {
      const dept = (t.department || 'General Faculty').trim();
      if (!map[dept]) map[dept] = [];
      map[dept].push(t);
    });

    Object.keys(map).forEach((dept) => {
      map[dept].sort((a, b) => getBioIdNum(a.biometricId) - getBioIdNum(b.biometricId));
    });

    return map;
  }, [teachers]);

  const availableDepartments = useMemo(() => {
    return Object.keys(departmentGroups).sort();
  }, [departmentGroups]);

  // Attendance Sheet list filtered & sorted in ASCENDING order by Biometric ID
  const sortedFacultyForSheet = useMemo(() => {
    let list = [...teachers];
    if (sheetDeptFilter !== 'ALL') {
      list = list.filter((t) => (t.department || 'General Faculty') === sheetDeptFilter);
    }
    if (sheetSearch) {
      const term = sheetSearch.toLowerCase();
      list = list.filter((t) =>
        t.name?.toLowerCase().includes(term) ||
        t.biometricId?.toLowerCase().includes(term) ||
        t.department?.toLowerCase().includes(term) ||
        t.email?.toLowerCase().includes(term)
      );
    }
    list.sort((a, b) => getBioIdNum(a.biometricId) - getBioIdNum(b.biometricId));
    return list;
  }, [teachers, sheetDeptFilter, sheetSearch]);

  const handleFetchDeviceData = async (simulateIfUnreachable = false, targetDate?: string) => {
    if (!principal?.collegeId) return;
    setIsSyncingDevice(true);
    const syncDate = targetDate || dateFilter;
    try {
      const res = await fetch('/api/biometrics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeId: principal.collegeId,
          startDate: syncDate,
          endDate: syncDate,
          simulateIfUnreachable
        })
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Biometric Logs Fetched',
          description: `${data.message} (${data.syncedCount || 0} swipe records updated for ${syncDate})`
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Device Connection Note',
          description: data.error || 'Could not fetch logs from biometric hardware terminal.'
        });
      }
    } finally {
      setIsSyncingDevice(false);
    }
  };

  const handleDateChange = (newDate: string) => {
    setDateFilter(newDate);
    handleFetchDeviceData(false, newDate);
  };

  const handleFullBackfill = async () => {
    if (!principal?.collegeId) return;
    setIsBackfillingHistory(true);
    try {
      const res = await fetch('/api/biometrics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeId: principal.collegeId,
          fullBackfill: true
        })
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Full History Sync Complete',
          description: `${data.message} (${data.syncedCount || 0} attendance records synced from device installation date)`
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Backfill Notice',
          description: data.error || 'Failed to sync historical logs from device.'
        });
      }
    } catch (err: any) {
      console.error('Full backfill error:', err);
      toast({
        variant: 'destructive',
        title: 'Sync Error',
        description: 'Failed to contact backfill endpoint.'
      });
    } finally {
      setIsBackfillingHistory(false);
    }
  };

  const handleFetchDateRange = async () => {
    if (!principal?.collegeId || !rangeStartDate || !rangeEndDate) return;
    setIsSyncingRange(true);
    try {
      const res = await fetch('/api/biometrics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeId: principal.collegeId,
          startDate: rangeStartDate,
          endDate: rangeEndDate
        })
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Date Range Sync Complete',
          description: `${data.message} (${data.syncedCount || 0} swipe records updated between ${rangeStartDate} and ${rangeEndDate})`
        });
        setIsRangeDialogOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Sync Error',
          description: data.error || 'Failed to fetch logs for the selected date range.'
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Network Error',
        description: 'Failed to connect to biometric sync endpoint.'
      });
    } finally {
      setIsSyncingRange(false);
    }
  };

  const handleImportTerminalMembers = async () => {
    if (!principal?.collegeId) return;
    setIsImportingMembers(true);
    try {
      const res = await fetch('/api/biometrics/import-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collegeId: principal.collegeId })
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Registered Terminal Members Imported',
          description: `${data.message} (${data.totalTerminalUsers || 0} registered members on device)`
        });
        handleFetchDeviceData(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Import Notice',
          description: data.error || 'Failed to import terminal members.'
        });
      }
    } catch (err: any) {
      console.error('Import members error:', err);
      toast({
        variant: 'destructive',
        title: 'Import Error',
        description: 'Failed to connect to member import endpoint.'
      });
    } finally {
      setIsImportingMembers(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!principal?.collegeId) return;
    setSavingConfig(true);
    try {
      await updateDoc(doc(db, 'colleges', principal.collegeId), {
        biometricSettings: {
          enabled: configEnabled,
          deviceIp: configIp.trim(),
          username: configUsername.trim() || 'admin',
          password: configPassword,
          mappedDepartment: configMappedDept,
          updatedAt: new Date().toISOString()
        }
      });
      toast({
        title: 'Configuration Saved',
        description: 'Wi-Fi IP & device login credentials updated successfully.'
      });
      setIsConfigDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Could not update biometric configuration.'
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveRules = async () => {
    if (!principal?.collegeId) return;
    setSavingRules(true);
    try {
      await updateDoc(doc(db, 'colleges', principal.collegeId), {
        biometricRules: {
          departmentShifts,
          overtimeMinHours,
          halfDayHours,
          autoAbsent,
          updatedAt: new Date().toISOString()
        }
      });
      toast({
        title: 'Department Shift Rules Saved',
        description: 'Updated shift schedule timings for ADMINISTRATOR, DEGREE, PARAMEDICAL & NURSING.'
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Save Rules Failed',
        description: 'Could not save department shift rules.'
      });
    } finally {
      setSavingRules(false);
    }
  };

  const handleResetHikvisionShifts = () => {
    setDepartmentShifts(DEFAULT_DEPARTMENT_SHIFTS);
    toast({
      title: 'Reset to Hikvision Hardware Schedules',
      description: 'Applied ADMINISTRATOR (10-18), DEGREE (10-17:30), PARAMEDICAL (10-17:30), and NURSING (09-17:30 / Sat 09-13).'
    });
  };

  const handleUpdateDeptShift = (deptKey: string, field: keyof DeptShiftRule, value: any) => {
    setDepartmentShifts((prev) => ({
      ...prev,
      [deptKey]: {
        ...(prev[deptKey] || DEFAULT_DEPARTMENT_SHIFTS[deptKey] || {
          deptName: deptKey,
          scheduleName: 'Custom Shift',
          monFriStart: '09:00',
          monFriEnd: '17:30',
          satStart: '09:00',
          satEnd: '13:00',
          graceMins: 15
        }),
        [field]: value
      }
    }));
  };

  const handleQuickAssignDept = async (teacherId: string, targetDept: string) => {
    try {
      await updateDoc(doc(db, 'teachers', teacherId), {
        department: targetDept
      });
      toast({
        title: 'Member Routed to Shift',
        description: `Successfully moved member to ${targetDept} shift department.`
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Routing Failed',
        description: 'Could not assign member department.'
      });
    }
  };

  const handleUpdateMapping = async () => {
    if (!editingTeacher || !principal?.collegeId) return;
    setSavingMapping(true);
    try {
      await updateDoc(doc(db, 'teachers', editingTeacher.id), {
        biometricId: newBiometricId.trim() || null,
        department: newDepartment
      });
      toast({
        title: 'Faculty Mapping & Department Updated',
        description: `Successfully mapped ${editingTeacher.name} (Bio ID: '${newBiometricId}') to ${newDepartment} shift schedule.`
      });
      setEditingTeacher(null);
      setNewBiometricId('');
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save mapping.'
      });
    } finally {
      setSavingMapping(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateHoursWorked = (firstIn?: string, lastOut?: string) => {
    if (!firstIn || !lastOut || firstIn === lastOut) return '—';
    const start = new Date(firstIn).getTime();
    const end = new Date(lastOut).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return '—';
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m`;
  };

  // Evaluate rule-based status dynamically using department shift schedules
  const evaluateStatus = (log?: any, teacher?: Teacher) => {
    if (!log || !log.firstCheckIn) {
      return { label: 'Absent', code: 'absent', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50' };
    }

    const dept = teacher?.department || 'General Faculty';
    const deptShift = departmentShifts[dept] || DEFAULT_DEPARTMENT_SHIFTS[dept] || DEFAULT_DEPARTMENT_SHIFTS['General Faculty'];

    const checkInTime = new Date(log.firstCheckIn);
    const dayOfWeek = checkInTime.getDay(); // 0: Sun, 6: Sat
    const isSaturday = dayOfWeek === 6;

    const expectedStartStr = isSaturday ? deptShift.satStart : deptShift.monFriStart;
    const expectedEndStr = isSaturday ? deptShift.satEnd : deptShift.monFriEnd;

    const [startH, startM] = expectedStartStr.split(':').map(Number);
    const thresholdTime = new Date(checkInTime);
    thresholdTime.setHours(startH, startM + deptShift.graceMins, 0, 0);

    const isLate = checkInTime > thresholdTime;

    let isEarlyLeave = false;
    let isMissedCheck = false;

    if (!log.lastCheckOut || log.lastCheckOut === log.firstCheckIn) {
      isMissedCheck = true;
    } else {
      const checkOutTime = new Date(log.lastCheckOut);
      const [endH, endM] = expectedEndStr.split(':').map(Number);
      const endThreshold = new Date(checkOutTime);
      endThreshold.setHours(endH, endM, 0, 0);
      if (checkOutTime < endThreshold) {
        isEarlyLeave = true;
      }
    }

    if (isMissedCheck) return { label: 'Missed Check', code: 'missed', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50' };
    if (isLate && isEarlyLeave) return { label: 'Late & Early Leave', code: 'late', color: 'text-amber-700 bg-amber-50 dark:bg-amber-950/50' };
    if (isLate) return { label: 'Late Check-in', code: 'late', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50' };
    if (isEarlyLeave) return { label: 'Early Leave', code: 'early', color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50' };

    return { label: 'Present (On Time)', code: 'present', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' };
  };

  if (!principal?.collegeId) {
    return (
      <div className="text-center py-12">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-bold">Access Restricted</h3>
        <p className="text-sm text-muted-foreground mt-1">This module is only accessible to registered institutional administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Today's logs map
  const todayLogsByTeacher: Record<string, any> = {};
  logs.filter(l => l.date === dateFilter).forEach(l => {
    if (l.teacherId) todayLogsByTeacher[l.teacherId] = l;
  });

  // Calculate Hikvision dashboard stats for Attendance Sheet tab dynamically
  const sheetStats = (() => {
    let presentCount = 0;
    let lateCount = 0;
    let earlyCount = 0;
    let missedCount = 0;
    let absentCount = 0;

    sortedFacultyForSheet.forEach((t) => {
      const log = todayLogsByTeacher[t.id];
      const res = evaluateStatus(log, t);
      if (res.code === 'present') presentCount++;
      else if (res.code === 'late') lateCount++;
      else if (res.code === 'early') earlyCount++;
      else if (res.code === 'missed') missedCount++;
      else absentCount++;
    });

    return {
      presentCount,
      lateCount,
      earlyCount,
      missedCount,
      absentCount,
      total: sortedFacultyForSheet.length
    };
  })();

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">{college?.name || 'College'} / Attendance & Biometrics</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2.5">
            <Fingerprint className="h-7 w-7 text-primary" />
            Biometric Faculty Attendance System
          </h1>
        </div>
        
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Button
            onClick={() => handleFetchDeviceData(false)}
            disabled={isSyncingDevice || !college?.biometricSettings?.enabled}
            className="gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingDevice ? 'animate-spin' : ''}`} />
            {isSyncingDevice ? 'Fetching...' : 'Fetch Device Data Now'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsRangeDialogOpen(true)}
            disabled={!college?.biometricSettings?.enabled}
            className="gap-2 shadow-sm border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 font-medium"
          >
            <Calendar className="h-4 w-4 text-purple-600" />
            Fetch Date Range...
          </Button>

          <Button
            variant="outline"
            onClick={handleFullBackfill}
            disabled={isBackfillingHistory || !college?.biometricSettings?.enabled}
            className="gap-2 shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
          >
            <History className={`h-4 w-4 ${isBackfillingHistory ? 'animate-spin' : ''}`} />
            {isBackfillingHistory ? 'Syncing Full History...' : 'Sync Full History'}
          </Button>

          <Button
            variant="secondary"
            onClick={handleImportTerminalMembers}
            disabled={isImportingMembers || !college?.biometricSettings?.enabled}
            className="gap-2 shadow-sm"
          >
            <Download className={`h-4 w-4 ${isImportingMembers ? 'animate-bounce' : ''}`} />
            {isImportingMembers ? 'Importing Members...' : `Import Terminal Members (${teachers.length})`}
          </Button>

          <Button 
            variant="outline" 
            onClick={() => setIsConfigDialogOpen(true)}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Configure Wi-Fi IP / Login
          </Button>
        </div>
      </div>

      {/* Top Overview Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Device Hardware Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">
                {college?.biometricSettings?.enabled ? 'Active Online' : 'Disabled'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {college?.biometricSettings?.enabled ? `IP: ${college.biometricSettings.deviceIp}` : 'Hardware integration off.'}
              </p>
            </div>
            <div className={`p-3 rounded-full ${college?.biometricSettings?.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {college?.biometricSettings?.enabled ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur cursor-pointer hover:border-primary/40 transition-colors" onClick={() => { setActiveTab('departments'); setSelectedDeptCard(null); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Departments</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{availableDepartments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{teachers.length} faculty registered</p>
            </div>
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-500">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur cursor-pointer hover:border-primary/40 transition-colors" onClick={() => { setActiveTab('rules'); setSelectedDeptCard(null); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department Shifts</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">4 Hikvision Shifts</div>
              <p className="text-xs text-muted-foreground mt-1">ADMIN, DEGREE, PARAMED, NURSING</p>
            </div>
            <div className="p-3 rounded-full bg-amber-500/10 text-amber-500">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur cursor-pointer hover:border-primary/40 transition-colors" onClick={() => { setActiveTab('sheet'); setSelectedDeptCard(null); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">
                {Object.keys(todayLogsByTeacher).length} / {teachers.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Date: {dateFilter}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-500/10 text-purple-500">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Feature Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSelectedDeptCard(null); }} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60">
          <TabsTrigger value="sheet" className="py-2.5 gap-2 font-medium">
            <FileSpreadsheet className="h-4 w-4" />
            Attendance Sheet
          </TabsTrigger>
          <TabsTrigger value="departments" className="py-2.5 gap-2 font-medium">
            <Building2 className="h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="rules" className="py-2.5 gap-2 font-medium">
            <SlidersHorizontal className="h-4 w-4" />
            Configure Rules
          </TabsTrigger>
          <TabsTrigger value="logs" className="py-2.5 gap-2 font-medium">
            <Clock className="h-4 w-4" />
            Swipe Stream
          </TabsTrigger>
          <TabsTrigger value="mapping" className="py-2.5 gap-2 font-medium">
            <Link2 className="h-4 w-4" />
            Biometric Mapping
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: ATTENDANCE SHEET WITH TRADITIONAL MONTHLY REGISTER & DAILY SHIFT VIEW */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="sheet" className="mt-4 space-y-4">
          {/* View Mode Switcher Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 border rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-bold text-sm text-foreground">Faculty Attendance Register</h3>
                <p className="text-xs text-muted-foreground">Select view style: Traditional Monthly Grid or Daily Shift Log</p>
              </div>
            </div>

            <div className="flex items-center bg-muted/60 p-1 rounded-lg border">
              <Button
                variant={sheetViewMode === 'matrix' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 text-xs gap-1.5 font-medium"
                onClick={() => setSheetViewMode('matrix')}
              >
                <Calendar className="h-3.5 w-3.5" />
                Traditional Monthly Register
              </Button>

              <Button
                variant={sheetViewMode === 'daily' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 text-xs gap-1.5 font-medium"
                onClick={() => setSheetViewMode('daily')}
              >
                <Clock className="h-3.5 w-3.5" />
                Daily Shift View
              </Button>
            </div>
          </div>

          {sheetViewMode === 'matrix' ? (
            <TraditionalAttendanceMatrix
              teachers={teachers}
              yearMonth={yearMonth}
              logs={logs}
              leaves={teacherLeaves}
              departmentFilter={sheetDeptFilter}
              searchQuery={sheetSearch}
              onMonthChange={setYearMonth}
              onDeptChange={setSheetDeptFilter}
              onSearchChange={setSheetSearch}
              availableDepartments={availableDepartments}
              collegeName={college?.name || 'College'}
            />
          ) : (
            <>
              {/* HIKVISION DASHBOARD METRICS BAR */}
              <div className="grid gap-4 md:grid-cols-6">
                <div className="md:col-span-2">
                  <HikvisionAttendanceGauge presentCount={sheetStats.presentCount} totalMembers={sheetStats.total} />
                </div>

                <HikvisionDonutRing
                  label="Present"
                  value={sheetStats.presentCount}
                  total={sheetStats.total}
                  color="text-emerald-500"
                />

                <HikvisionDonutRing
                  label="Late"
                  value={sheetStats.lateCount}
                  total={sheetStats.total}
                  color="text-amber-500"
                />

                <HikvisionDonutRing
                  label="Early Leave"
                  value={sheetStats.earlyCount}
                  total={sheetStats.total}
                  color="text-orange-500"
                />

                <HikvisionDonutRing
                  label="Missed Check"
                  value={sheetStats.missedCount}
                  total={sheetStats.total}
                  color="text-purple-500"
                />
              </div>

              <Card>
            <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Department-Wise Faculty Attendance Sheet
                </CardTitle>
                <CardDescription>
                  Members sorted in <strong>ascending numerical order by Biometric ID</strong> evaluated against their specific department shift schedules.
                </CardDescription>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1 font-mono text-xs px-3 py-1">
                  <SortAsc className="h-3.5 w-3.5" />
                  Sorted by Biometric ID (Ascending)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by faculty name, biometric ID, or department..."
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={sheetDeptFilter}
                    onChange={(e) => setSheetDeptFilter(e.target.value)}
                    className="px-3 py-2 text-sm rounded-md border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ALL">All Departments ({teachers.length})</option>
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept} ({departmentGroups[dept]?.length || 0})
                      </option>
                    ))}
                  </select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 px-3 justify-between gap-2 text-sm font-medium border bg-background shadow-sm hover:bg-muted/50 min-w-[170px]"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary shrink-0" />
                          <span>{dateFilter ? format(new Date(dateFilter + 'T00:00:00'), 'dd MMM yyyy') : 'Select Date'}</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 shadow-xl border rounded-xl" align="end">
                      <CalendarPicker
                        mode="single"
                        selected={dateFilter ? new Date(dateFilter + 'T00:00:00') : undefined}
                        onSelect={(d) => {
                          if (d) {
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            handleDateChange(`${yyyy}-${mm}-${dd}`);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[120px]">Biometric ID</TableHead>
                      <TableHead>Faculty Name</TableHead>
                      <TableHead>Department & Shift Route</TableHead>
                      <TableHead>First Check-In</TableHead>
                      <TableHead>Last Check-Out</TableHead>
                      <TableHead>Hours Worked</TableHead>
                      <TableHead>Attendance Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFacultyForSheet.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          No faculty members found matching filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedFacultyForSheet.map((teacher) => {
                        const log = todayLogsByTeacher[teacher.id];
                        const evalRes = evaluateStatus(log, teacher);
                        const hoursStr = calculateHoursWorked(log?.firstCheckIn, log?.lastCheckOut);
                        const dept = teacher.department || 'General Faculty';
                        const shift = departmentShifts[dept] || DEFAULT_DEPARTMENT_SHIFTS[dept] || DEFAULT_DEPARTMENT_SHIFTS['General Faculty'];

                        return (
                          <TableRow key={teacher.id} className="hover:bg-muted/30">
                            <TableCell>
                              <Badge variant="outline" className="font-mono font-bold text-primary border-primary/30">
                                #{teacher.biometricId || '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">{teacher.name}</TableCell>
                            <TableCell>
                              <select
                                value={dept}
                                onChange={(e) => handleQuickAssignDept(teacher.id, e.target.value)}
                                className="text-xs px-2 py-1 rounded border bg-background text-foreground font-medium"
                              >
                                {KNOWN_DEPARTMENTS.map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                {shift.monFriStart}–{shift.monFriEnd}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-emerald-600 font-medium">
                              {formatTime(log?.firstCheckIn)}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-blue-600 font-medium">
                              {formatTime(log?.lastCheckOut)}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">
                              {hoursStr}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${evalRes.color}`}>
                                {evalRes.label}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: DEPARTMENTS PAGE (CLICKABLE CARDS & DEDICATED HIKVISION DASHBOARD PAGE) */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="departments" className="mt-4 space-y-4">
          {!selectedDeptCard ? (
            /* ALL DEPARTMENTS CLICKABLE CARDS VIEW */
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Departmental Roster & Shift Overview
                </CardTitle>
                <CardDescription>
                  Click on any department card to open its <strong>Dedicated Hikvision Shift Dashboard</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search departments or faculty members..."
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {availableDepartments
                    .filter((dept) => {
                      if (!deptSearch) return true;
                      const term = deptSearch.toLowerCase();
                      if (dept.toLowerCase().includes(term)) return true;
                      return (departmentGroups[dept] || []).some(t => t.name?.toLowerCase().includes(term) || t.biometricId?.toLowerCase().includes(term));
                    })
                    .map((dept) => {
                      const deptMembers = departmentGroups[dept] || [];
                      const presentCount = deptMembers.filter(t => !!todayLogsByTeacher[t.id]).length;
                      const attendancePct = deptMembers.length > 0 ? Math.round((presentCount / deptMembers.length) * 100) : 0;
                      const shift = departmentShifts[dept] || DEFAULT_DEPARTMENT_SHIFTS[dept] || DEFAULT_DEPARTMENT_SHIFTS['General Faculty'];

                      return (
                        <Card
                          key={dept}
                          onClick={() => setSelectedDeptCard(dept)}
                          className="border bg-card/70 hover:bg-card hover:border-primary/50 transition-all cursor-pointer shadow-sm group"
                        >
                          <CardHeader className="pb-3 border-b bg-muted/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                  <Building2 className="h-5 w-5" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors flex items-center gap-2">
                                    {dept}
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                  </CardTitle>
                                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{shift.scheduleName}</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="font-mono text-xs px-3 py-1">
                                {deptMembers.length} Members
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                              <span>Shift: <strong className="text-foreground">{shift.monFriStart} – {shift.monFriEnd}</strong></span>
                              <span>Sat: <strong className="text-foreground">{shift.satStart} – {shift.satEnd}</strong></span>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Today Present: <strong className="text-emerald-600">{presentCount}</strong> / {deptMembers.length}</span>
                              <span className="font-semibold text-primary">{attendancePct}% Attendance</span>
                            </div>
                            <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                              <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${attendancePct}%` }}></div>
                            </div>
                            <div className="flex items-center justify-end pt-1">
                              <span className="text-xs text-primary font-semibold flex items-center gap-1 group-hover:underline">
                                View Dedicated Department Dashboard & Roster <ArrowRight className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* DEDICATED DEPARTMENT DASHBOARD PAGE (EXACTLY MATCHING SCREENSHOT 2) */
            (() => {
              const deptName = selectedDeptCard;
              const deptMembers = departmentGroups[deptName] || [];
              const shift = departmentShifts[deptName] || DEFAULT_DEPARTMENT_SHIFTS[deptName] || DEFAULT_DEPARTMENT_SHIFTS['General Faculty'];

              let presentCount = 0;
              let lateCount = 0;
              let earlyCount = 0;
              let missedCount = 0;
              let absentCount = 0;

              const filteredDeptMembers = deptMembers.filter((m) => {
                if (!deptSingleSearch) return true;
                const term = deptSingleSearch.toLowerCase();
                return m.name?.toLowerCase().includes(term) || m.biometricId?.toLowerCase().includes(term);
              });

              deptMembers.forEach((m) => {
                const log = todayLogsByTeacher[m.id];
                const res = evaluateStatus(log, m);
                if (res.code === 'present') presentCount++;
                else if (res.code === 'late') lateCount++;
                else if (res.code === 'early') earlyCount++;
                else if (res.code === 'missed') missedCount++;
                else absentCount++;
              });

              return (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDeptCard(null)}
                        className="gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to All Departments
                      </Button>
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Department Dashboard</div>
                        <h2 className="text-2xl font-bold font-headline tracking-tight flex items-center gap-2">
                          <Building2 className="h-6 w-6 text-primary" />
                          {deptName} Department
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="secondary" className="font-mono text-xs px-3 py-1">
                        Shift: {shift.monFriStart} – {shift.monFriEnd} (Sat {shift.satStart}–{shift.satEnd})
                      </Badge>
                      <div className="relative w-[150px]">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* HIKVISION DASHBOARD METRICS BAR (EXACT MATCH FOR SCREENSHOT 2) */}
                  <div className="grid gap-4 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <HikvisionAttendanceGauge presentCount={presentCount} totalMembers={deptMembers.length} />
                    </div>

                    <HikvisionDonutRing
                      label="Present"
                      value={presentCount}
                      total={deptMembers.length}
                      color="text-emerald-500"
                    />

                    <HikvisionDonutRing
                      label="Late"
                      value={lateCount}
                      total={deptMembers.length}
                      color="text-amber-500"
                    />

                    <HikvisionDonutRing
                      label="Early Leave"
                      value={earlyCount}
                      total={deptMembers.length}
                      color="text-orange-500"
                    />

                    <HikvisionDonutRing
                      label="Missed Check"
                      value={missedCount}
                      total={deptMembers.length}
                      color="text-purple-500"
                    />
                  </div>

                  {/* DEPARTMENT FACULTY ROSTER TABLE */}
                  <Card>
                    <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          {deptName} Faculty Roster ({filteredDeptMembers.length} Members)
                        </CardTitle>
                        <CardDescription>
                          Members sorted in <strong>ascending numerical order by Biometric ID</strong>.
                        </CardDescription>
                      </div>

                      <div className="relative w-full sm:w-[280px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={`Search ${deptName} members...`}
                          value={deptSingleSearch}
                          onChange={(e) => setDeptSingleSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-xl overflow-hidden shadow-sm">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="w-[120px]">Biometric ID</TableHead>
                              <TableHead>Faculty Name</TableHead>
                              <TableHead>Department Shift Route</TableHead>
                              <TableHead>First Check-In</TableHead>
                              <TableHead>Last Check-Out</TableHead>
                              <TableHead>Hours Worked</TableHead>
                              <TableHead>Attendance Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDeptMembers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                  No members found in {deptName} matching search.
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredDeptMembers.map((teacher) => {
                                const log = todayLogsByTeacher[teacher.id];
                                const evalRes = evaluateStatus(log, teacher);
                                const hoursStr = calculateHoursWorked(log?.firstCheckIn, log?.lastCheckOut);

                                return (
                                  <TableRow key={teacher.id} className="hover:bg-muted/30">
                                    <TableCell>
                                      <Badge variant="outline" className="font-mono font-bold text-primary border-primary/30">
                                        #{teacher.biometricId || '—'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-semibold text-foreground">{teacher.name}</TableCell>
                                    <TableCell>
                                      <select
                                        value={teacher.department || 'General Faculty'}
                                        onChange={(e) => handleQuickAssignDept(teacher.id, e.target.value)}
                                        className="text-xs px-2 py-1 rounded border bg-background text-foreground font-medium"
                                      >
                                        {KNOWN_DEPARTMENTS.map((d) => (
                                          <option key={d} value={d}>{d}</option>
                                        ))}
                                      </select>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-emerald-600 font-medium">
                                      {formatTime(log?.firstCheckIn)}
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-blue-600 font-medium">
                                      {formatTime(log?.lastCheckOut)}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs font-semibold">
                                      {hoursStr}
                                    </TableCell>
                                    <TableCell>
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${evalRes.color}`}>
                                        {evalRes.label}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: CONFIGURE RULES */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="rules" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Configure Department Shift Schedule Rules
                </CardTitle>
                <CardDescription>
                  Configure the 4 Hikvision shift schedules (ADMINISTRATOR, DEGREE, PARAMEDICAL, NURSING) and late check-in thresholds.
                </CardDescription>
              </div>

              <Button variant="outline" size="sm" onClick={handleResetHikvisionShifts} className="gap-1.5 shrink-0">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Hikvision Hardware Shifts
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter shift rules or department names..."
                  value={rulesSearch}
                  onChange={(e) => setRulesSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {Object.keys(departmentShifts)
                  .filter(deptKey => !rulesSearch || deptKey.toLowerCase().includes(rulesSearch.toLowerCase()))
                  .map((deptKey) => {
                    const rule = departmentShifts[deptKey];
                    return (
                      <Card key={deptKey} className="border shadow-sm">
                        <CardHeader className="pb-3 bg-muted/20">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              {rule.deptName} Shift Schedule
                            </CardTitle>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {rule.scheduleName}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold">Mon–Fri Shift Start</Label>
                              <Input
                                type="time"
                                value={rule.monFriStart}
                                onChange={(e) => handleUpdateDeptShift(deptKey, 'monFriStart', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold">Mon–Fri Shift End</Label>
                              <Input
                                type="time"
                                value={rule.monFriEnd}
                                onChange={(e) => handleUpdateDeptShift(deptKey, 'monFriEnd', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold">Saturday Shift Start</Label>
                              <Input
                                type="time"
                                value={rule.satStart}
                                onChange={(e) => handleUpdateDeptShift(deptKey, 'satStart', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[11px] font-semibold">Saturday Shift End</Label>
                              <Input
                                type="time"
                                value={rule.satEnd}
                                onChange={(e) => handleUpdateDeptShift(deptKey, 'satEnd', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-semibold">Grace Period Buffer (Minutes)</Label>
                            <Input
                              type="number"
                              value={rule.graceMins}
                              onChange={(e) => handleUpdateDeptShift(deptKey, 'graceMins', Number(e.target.value))}
                            />
                            <p className="text-[10px] text-muted-foreground">Late check-in triggers after {rule.monFriStart} + {rule.graceMins}m buffer.</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>

              <Card className="border bg-muted/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    Global Overtime & Half-Day Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Overtime Minimum Work Hours</Label>
                    <Input
                      type="number"
                      value={overtimeMinHours}
                      onChange={(e) => setOvertimeMinHours(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Half-Day Minimum Hours</Label>
                    <Input
                      type="number"
                      value={halfDayHours}
                      onChange={(e) => setHalfDayHours(Number(e.target.value))}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <Label className="text-xs font-semibold">Auto-Mark Absent</Label>
                      <p className="text-[10px] text-muted-foreground">Auto tag unswiped staff at end of shift</p>
                    </div>
                    <Switch
                      checked={autoAbsent}
                      onCheckedChange={setAutoAbsent}
                    />
                  </div>
                </CardContent>
              </Card>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 flex justify-end">
              <Button onClick={handleSaveRules} disabled={savingRules} className="gap-2">
                <Save className="h-4 w-4" />
                {savingRules ? 'Saving Shift Rules...' : 'Save Department Shift Rules'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: SWIPE STREAM */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Swipe & Scan Hardware Event Log Stream</CardTitle>
              <CardDescription>View raw check-in and check-out events captured directly from the physical hardware terminal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search faculty name..."
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="relative w-full sm:w-[200px]">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faculty Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>First Check-In</TableHead>
                      <TableHead>Last Check-Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Device Swipe Events</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs
                      .filter(l => l.date === dateFilter && (!logsSearch || l.teacherName?.toLowerCase().includes(logsSearch.toLowerCase())))
                      .map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-semibold text-foreground">{log.teacherName}</TableCell>
                          <TableCell className="font-mono text-xs">{log.date}</TableCell>
                          <TableCell className="font-mono text-sm text-emerald-600">{formatTime(log.firstCheckIn)}</TableCell>
                          <TableCell className="font-mono text-sm text-blue-600">{formatTime(log.lastCheckOut)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-none">
                              {log.status || 'Present'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.logs?.map((l: any, idx: number) => (
                              <div key={idx} className="flex gap-1.5 items-center">
                                <span className="font-bold text-[10px]">{l.type}:</span>
                                <span>{formatTime(l.time)}</span>
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: FACULTY BIOMETRIC MAPPING */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="mapping" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Map Faculty to Hardware Biometric ID & Department Shift</CardTitle>
              <CardDescription>
                Assign each faculty member their Biometric ID and route them to their shift department (ADMINISTRATOR, DEGREE, PARAMEDICAL, NURSING).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, department, or biometric ID..."
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faculty Name</TableHead>
                      <TableHead>Department Shift Route</TableHead>
                      <TableHead>Biometric ID / Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers
                      .filter(t => !mappingSearch || t.name?.toLowerCase().includes(mappingSearch.toLowerCase()) || t.biometricId?.toLowerCase().includes(mappingSearch.toLowerCase()) || t.department?.toLowerCase().includes(mappingSearch.toLowerCase()))
                      .sort((a, b) => getBioIdNum(a.biometricId) - getBioIdNum(b.biometricId))
                      .map((teacher) => (
                        <TableRow key={teacher.id}>
                          <TableCell className="font-semibold text-foreground">{teacher.name}</TableCell>
                          <TableCell>
                            <select
                              value={teacher.department || 'General Faculty'}
                              onChange={(e) => handleQuickAssignDept(teacher.id, e.target.value)}
                              className="text-xs px-2.5 py-1 rounded border bg-background text-foreground font-medium"
                            >
                              {KNOWN_DEPARTMENTS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-primary">
                            #{teacher.biometricId || '—'}
                          </TableCell>
                          <TableCell>
                            {teacher.biometricId ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-none">
                                <Link2 className="h-3 w-3 mr-1" />
                                Mapped
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-none">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                Unmapped
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                setEditingTeacher(teacher);
                                setNewBiometricId(teacher.biometricId || '');
                                setNewDepartment(teacher.department || 'General Faculty');
                              }}
                            >
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mapping Edit Dialog */}
      <Dialog open={editingTeacher !== null} onOpenChange={(open) => !open && setEditingTeacher(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Biometric Mapping & Shift Route</DialogTitle>
            <DialogDescription>
              Set Biometric ID and Shift Department for <strong>{editingTeacher?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bioId">Hikvision Biometric / Employee ID</Label>
              <Input
                id="bioId"
                placeholder="e.g. 16, 01, 02"
                value={newBiometricId}
                onChange={(e) => setNewBiometricId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deptSelect">Department Shift Route</Label>
              <select
                id="deptSelect"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border bg-background text-foreground"
              >
                {KNOWN_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept} ({departmentShifts[dept]?.monFriStart} - {departmentShifts[dept]?.monFriEnd})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTeacher(null)}>Cancel</Button>
            <Button onClick={handleUpdateMapping} disabled={savingMapping}>
              {savingMapping ? 'Saving...' : 'Save Mapping & Shift Route'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wi-Fi Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Biometric Hardware IP & Credentials</DialogTitle>
            <DialogDescription>
              Set local Wi-Fi IP address and login details for your physical Hikvision terminal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Enable Integration</Label>
                <p className="text-xs text-muted-foreground">Activate automatic fetch for this college</p>
              </div>
              <Switch
                checked={configEnabled}
                onCheckedChange={setConfigEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ip">Device IP Address</Label>
              <Input
                id="ip"
                placeholder="e.g. 192.168.1.250"
                value={configIp}
                onChange={(e) => setConfigIp(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mappedDept">Mapped Department on Terminal</Label>
              <select
                id="mappedDept"
                value={configMappedDept}
                onChange={(e) => setConfigMappedDept(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border bg-background text-foreground"
              >
                <option value="">-- Select Department --</option>
                {KNOWN_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="ALL">ALL (No Filter)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Isolates biometric sync: Only members of this terminal department will be imported.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user">Device Username</Label>
              <Input
                id="user"
                placeholder="admin"
                value={configUsername}
                onChange={(e) => setConfigUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pass">Device Admin Password</Label>
              <div className="relative">
                <Input
                  id="pass"
                  type={showConfigPassword ? 'text' : 'password'}
                  placeholder="Enter device password"
                  value={configPassword}
                  onChange={(e) => setConfigPassword(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                  onClick={() => setShowConfigPassword(!showConfigPassword)}
                >
                  {showConfigPassword ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Range Fetch Modal Dialog */}
      <Dialog open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Fetch Biometric Logs by Date Range
            </DialogTitle>
            <DialogDescription>
              Enter custom <strong>Start Date</strong> and <strong>End Date</strong> to retrieve attendance records from the terminal hardware.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rangeStart" className="text-right font-medium">
                From Date
              </Label>
              <Input
                id="rangeStart"
                type="date"
                value={rangeStartDate}
                onChange={(e) => setRangeStartDate(e.target.value)}
                className="col-span-3 font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rangeEnd" className="text-right font-medium">
                To Date
              </Label>
              <Input
                id="rangeEnd"
                type="date"
                value={rangeEndDate}
                onChange={(e) => setRangeEndDate(e.target.value)}
                className="col-span-3 font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRangeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFetchDateRange}
              disabled={isSyncingRange || !rangeStartDate || !rangeEndDate}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncingRange ? 'animate-spin' : ''}`} />
              {isSyncingRange ? 'Fetching Range...' : 'Fetch & Sync Records'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
