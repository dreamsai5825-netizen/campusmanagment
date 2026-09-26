'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { Teacher, TeacherLeave } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Download,
  Calendar as CalendarIcon,
  Search,
  Filter,
  SortAsc,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

export type TraditionalAttendanceMatrixProps = {
  teachers: Teacher[];
  yearMonth: string; // e.g. "2026-08"
  logs: any[];
  leaves?: TeacherLeave[];
  departmentFilter: string;
  searchQuery: string;
  onMonthChange: (newYearMonth: string) => void;
  onDeptChange: (newDept: string) => void;
  onSearchChange: (newSearch: string) => void;
  availableDepartments: string[];
  collegeName?: string;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function TraditionalAttendanceMatrix({
  teachers,
  yearMonth,
  logs,
  leaves = [],
  departmentFilter,
  searchQuery,
  onMonthChange,
  onDeptChange,
  onSearchChange,
  availableDepartments,
  collegeName = 'Institution'
}: TraditionalAttendanceMatrixProps) {
  // Parse year and month
  const [yearStr, monthStr] = (yearMonth || new Date().toISOString().slice(0, 7)).split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

  // Calendar popover & day highlight state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Total days in the selected month
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  // First day weekday index (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = useMemo(() => {
    return new Date(year, month - 1, 1).getDay();
  }, [year, month]);

  // Today reference
  const today = useMemo(() => new Date(), []);

  // Year options for quick select dropdown
  const currentYear = today.getFullYear();
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
      years.push(y);
    }
    if (!years.includes(year)) {
      years.push(year);
      years.sort((a, b) => a - b);
    }
    return years;
  }, [currentYear, year]);

  // Reset selectedDay if it exceeds days in the new month
  useEffect(() => {
    if (selectedDay !== null && selectedDay > daysInMonth) {
      setSelectedDay(null);
    }
  }, [daysInMonth, selectedDay]);

  const handlePrevMonth = () => {
    const prevDate = new Date(year, month - 2, 1);
    const newYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(newYm);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month, 1);
    const newYm = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(newYm);
  };

  const handleMonthSelect = (mIdx: number) => {
    const newYm = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
    onMonthChange(newYm);
  };

  const handleYearSelect = (y: number) => {
    const newYm = `${y}-${String(month).padStart(2, '0')}`;
    onMonthChange(newYm);
  };

  const handleToday = () => {
    const t = new Date();
    const newYm = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(newYm);
    setSelectedDay(t.getDate());
    setIsCalendarOpen(false);
  };

  const handleCurrentMonth = () => {
    const t = new Date();
    const newYm = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(newYm);
    setSelectedDay(null);
  };

  // Array of day objects { dayNum: 1..31, dateStr: "YYYY-MM-DD", dayName: "Mon", isSunday: boolean }
  const monthDays = useMemo(() => {
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const dateObj = new Date(year, month - 1, d);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const isSunday = dateObj.getDay() === 0;
      days.push({
        dayNum: d,
        dateStr,
        dayName,
        isSunday
      });
    }
    return days;
  }, [year, month, daysInMonth]);

  // Fast Lookup Maps for Check-Ins and Leaves
  // Check-In Map: key -> `${teacherId}_${dateStr}` or `${biometricId}_${dateStr}`
  const checkInMap = useMemo(() => {
    const map = new Set<string>();
    if (!Array.isArray(logs)) return map;

    logs.forEach((log) => {
      // Determine dateStr from log
      let dStr = '';
      if (log.date) {
        dStr = log.date;
      } else if (log.timeISO) {
        dStr = log.timeISO.split('T')[0];
      } else if (log.timestamp) {
        const dt = new Date(log.timestamp);
        if (!isNaN(dt.getTime())) {
          const yyyy = dt.getFullYear();
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          dStr = `${yyyy}-${mm}-${dd}`;
        }
      }

      if (!dStr) return;

      if (log.teacherId) {
        map.add(`${log.teacherId}_${dStr}`);
      }
      if (log.biometricId) {
        map.add(`bio_${log.biometricId}_${dStr}`);
      }
    });

    return map;
  }, [logs]);

  // Leaves Map: key -> `${teacherId}_${dateStr}` => leaveCode ('CL', 'ML', 'EL', 'LWP')
  const leaveMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!Array.isArray(leaves)) return map;

    leaves.forEach((l) => {
      if (!l.date || !l.teacherId) return;
      const typeLower = (l.type || '').toLowerCase();
      let code = 'CL';
      if (typeLower.includes('medical') || typeLower.includes('sick') || typeLower.includes('ml')) {
        code = 'ML';
      } else if (typeLower.includes('earned') || typeLower.includes('el')) {
        code = 'EL';
      } else if (typeLower.includes('lwp') || typeLower.includes('without pay') || typeLower.includes('unpaid')) {
        code = 'LWP';
      } else if (typeLower.includes('duty') || typeLower.includes('dl')) {
        code = 'DL';
      } else {
        code = 'CL';
      }
      map.set(`${l.teacherId}_${l.date}`, code);
    });

    return map;
  }, [leaves]);

  // Filter & Sort Teachers by Biometric ID (Ascending)
  const filteredTeachers = useMemo(() => {
    return teachers
      .filter((t) => {
        const matchesDept = departmentFilter === 'ALL' || (t.department || 'General Faculty') === departmentFilter;
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          t.name.toLowerCase().includes(q) ||
          (t.biometricId || '').toLowerCase().includes(q) ||
          (t.department || '').toLowerCase().includes(q);
        return matchesDept && matchesSearch;
      })
      .sort((a, b) => {
        const bioA = parseInt((a.biometricId || '').replace(/\D/g, ''), 10) || 99999;
        const bioB = parseInt((b.biometricId || '').replace(/\D/g, ''), 10) || 99999;
        return bioA - bioB;
      });
  }, [teachers, departmentFilter, searchQuery]);

  // Handle Export to Excel
  const handleExportExcel = () => {
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
    const titleRow = [`${collegeName} - Faculty Monthly Attendance Register Matrix (${monthName} ${year})`].concat(
      Array(daysInMonth + 14).fill('')
    );
    
    // Header Row 1
    const headerRow1 = [
      'Biometric ID',
      'Faculty Name',
      'Department',
      ...monthDays.map((d) => `${d.dayNum} (${d.dayName})`),
      'Total Present (P)',
      'Total Absent (A)',
      'CL Allotted',
      'CL Taken',
      'CL Balance',
      'ML Allotted',
      'ML Taken',
      'ML Balance',
      'EL Allotted',
      'EL Taken',
      'EL Balance',
      'Total Payable Days'
    ];

    const dataRows = filteredTeachers.map((t) => {
      let pCount = 0;
      let aCount = 0;
      let clTakenCount = 0;
      let mlTakenCount = 0;
      let elTakenCount = 0;

      const dailyStatuses = monthDays.map((d) => {
        const hasCheckIn =
          checkInMap.has(`${t.id}_${d.dateStr}`) ||
          (t.biometricId && checkInMap.has(`bio_${t.biometricId}_${d.dateStr}`));
        const leaveCode = leaveMap.get(`${t.id}_${d.dateStr}`);

        if (hasCheckIn) {
          pCount++;
          return 'P';
        } else if (leaveCode) {
          if (leaveCode === 'CL') clTakenCount++;
          if (leaveCode === 'ML') mlTakenCount++;
          if (leaveCode === 'EL') elTakenCount++;
          return leaveCode;
        } else if (d.isSunday) {
          return 'WO';
        } else {
          aCount++;
          return 'A';
        }
      });

      const clAllotted = t.leaveQuotas?.['CL'] ?? t.leaveQuotas?.['Casual Leave (CL)'] ?? 12;
      const mlAllotted = t.leaveQuotas?.['ML'] ?? t.leaveQuotas?.['Medical Leave (ML)'] ?? 10;
      const elAllotted = t.leaveQuotas?.['EL'] ?? t.leaveQuotas?.['Earned Leave (EL)'] ?? 15;

      const clBal = Math.max(0, clAllotted - clTakenCount);
      const mlBal = Math.max(0, mlAllotted - mlTakenCount);
      const elBal = Math.max(0, elAllotted - elTakenCount);
      const payableDays = pCount + clTakenCount + mlTakenCount + elTakenCount;

      return [
        t.biometricId || `#${t.id.slice(0, 4)}`,
        t.name,
        t.department || 'General Faculty',
        ...dailyStatuses,
        pCount,
        aCount,
        clAllotted,
        clTakenCount,
        clBal,
        mlAllotted,
        mlTakenCount,
        mlBal,
        elAllotted,
        elTakenCount,
        elBal,
        payableDays
      ];
    });

    const excelData = [titleRow, [], headerRow1, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${monthName}_Register`);
    XLSX.writeFile(wb, `${collegeName.replace(/\s+/g, '_')}_Attendance_Register_${yearMonth}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-card p-4 border rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search faculty name, biometric ID..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={departmentFilter}
              onChange={(e) => onDeptChange(e.target.value)}
              className="px-3 py-2 text-sm rounded-md border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Departments ({teachers.length})</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Modern Calendar Dropdown for Month & Date Navigation */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-10 px-3 flex items-center justify-between gap-2.5 font-medium border bg-background hover:bg-muted/50 text-foreground shadow-sm transition-all min-w-[210px]",
                  isCalendarOpen && "ring-2 ring-primary/40 border-primary"
                )}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">
                    {selectedDay
                      ? `${String(selectedDay).padStart(2, '0')} ${MONTH_NAMES[month - 1]} ${year}`
                      : `${MONTH_NAMES[month - 1]} ${year}`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  {selectedDay && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDay(null);
                      }}
                      className="hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
                      title="Clear day filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isCalendarOpen && "rotate-180")} />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-4 shadow-2xl border rounded-2xl bg-popover/95 backdrop-blur-md text-popover-foreground z-50" align="start">
              <div className="space-y-4">
                {/* Popover Header: Month & Year select dropdowns + Prev/Next buttons */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-muted"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex items-center gap-1.5 flex-1 justify-center">
                    {/* Month Select */}
                    <select
                      value={month - 1}
                      onChange={(e) => handleMonthSelect(parseInt(e.target.value, 10))}
                      className="px-2 py-1 text-xs font-semibold rounded-md border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx}>
                          {name}
                        </option>
                      ))}
                    </select>

                    {/* Year Select */}
                    <select
                      value={year}
                      onChange={(e) => handleYearSelect(parseInt(e.target.value, 10))}
                      className="px-2 py-1 text-xs font-semibold rounded-md border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 hover:bg-muted"
                    onClick={handleNextMonth}
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                    <span
                      key={d}
                      className={cn(
                        "text-[11px] font-semibold py-1 rounded",
                        i === 0 ? "text-rose-500 font-bold" : "text-muted-foreground"
                      )}
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8 w-8" />
                  ))}
                  {monthDays.map((d) => {
                    const isSelected = selectedDay === d.dayNum;
                    const isToday =
                      today.getFullYear() === year &&
                      today.getMonth() + 1 === month &&
                      today.getDate() === d.dayNum;

                    return (
                      <button
                        key={d.dayNum}
                        type="button"
                        onClick={() => {
                          if (selectedDay === d.dayNum) {
                            setSelectedDay(null);
                          } else {
                            setSelectedDay(d.dayNum);
                            setIsCalendarOpen(false);
                          }
                        }}
                        className={cn(
                          "h-8 w-8 text-xs rounded-md font-medium transition-all flex flex-col items-center justify-center relative mx-auto",
                          isSelected
                            ? "bg-primary text-primary-foreground font-bold shadow-md ring-2 ring-primary/40"
                            : d.isSunday
                            ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            : "text-foreground hover:bg-accent",
                          isToday && !isSelected && "border border-primary font-bold text-primary"
                        )}
                      >
                        <span>{d.dayNum}</span>
                        {isToday && (
                          <span className={cn(
                            "w-1 h-1 rounded-full absolute bottom-0.5",
                            isSelected ? "bg-primary-foreground" : "bg-primary"
                          )} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Popover Footer: Quick Buttons */}
                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleCurrentMonth}
                    >
                      Full Month
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary font-medium hover:bg-primary/10"
                      onClick={handleToday}
                    >
                      Today
                    </Button>
                  </div>

                  {selectedDay !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => setSelectedDay(null)}
                    >
                      Clear Day Focus
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="gap-2 font-medium" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Monthly Register (.xlsx)
          </Button>
        </div>
      </div>

      {/* Legend & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border rounded-lg text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-muted-foreground">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300">P</span>
            <span className="text-muted-foreground">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold border border-rose-300">A</span>
            <span className="text-muted-foreground">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border border-slate-300">WO</span>
            <span className="text-muted-foreground">Weekly Off (Sun)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold border border-amber-300">CL</span>
            <span className="text-muted-foreground">Casual Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold border border-sky-300">ML</span>
            <span className="text-muted-foreground">Medical Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold border border-purple-300">EL</span>
            <span className="text-muted-foreground">Earned Leave</span>
          </div>

          {/* Active Day Focus Chip */}
          {selectedDay !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/25 rounded-md text-primary font-semibold text-xs animate-in fade-in zoom-in-95">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Day {selectedDay} ({monthDays[selectedDay - 1]?.dayName || ''}, {selectedDay} {MONTH_NAMES[month - 1]})</span>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="hover:text-primary/70 p-0.5 rounded hover:bg-primary/15 transition-colors"
                title="Clear day focus"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
          <SortAsc className="h-3 w-3" />
          Sorted by Biometric ID (Ascending)
        </Badge>
      </div>

      {/* Main Traditional Register Table with Sticky Left Columns & Top Headers */}
      <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto max-h-[70vh] relative">
          <Table className="w-full border-collapse text-xs">
            <TableHeader className="sticky top-0 z-20 bg-muted/90 backdrop-blur-sm border-b">
              {/* Row 1: Section Headers */}
              <TableRow className="border-b bg-muted/60">
                <TableHead colSpan={3} className="border-r font-bold text-center bg-muted/80 text-foreground py-2">
                  Faculty Information
                </TableHead>
                <TableHead colSpan={daysInMonth} className="border-r font-bold text-center bg-muted/80 text-foreground py-2">
                  Daily Attendance Grid ({new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' })} {year})
                </TableHead>
                <TableHead colSpan={2} className="border-r font-bold text-center bg-emerald-100/50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 py-2">
                  Month Summary
                </TableHead>
                <TableHead colSpan={3} className="border-r font-bold text-center bg-amber-100/50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 py-2">
                  Casual Leave (CL)
                </TableHead>
                <TableHead colSpan={3} className="border-r font-bold text-center bg-sky-100/50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 py-2">
                  Medical Leave (ML)
                </TableHead>
                <TableHead colSpan={3} className="border-r font-bold text-center bg-purple-100/50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 py-2">
                  Earned Leave (EL)
                </TableHead>
                <TableHead className="font-bold text-center bg-primary/10 text-primary py-2">
                  Payable
                </TableHead>
              </TableRow>

              {/* Row 2: Field Columns */}
              <TableRow className="bg-muted/40">
                {/* Sticky Left Column Headers */}
                <TableHead className="w-[80px] min-w-[80px] sticky left-0 z-30 bg-muted border-r font-bold text-foreground">
                  Bio ID
                </TableHead>
                <TableHead className="w-[180px] min-w-[180px] sticky left-[80px] z-30 bg-muted border-r font-bold text-foreground">
                  Faculty Name
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px] sticky left-[260px] z-30 bg-muted border-r font-bold text-foreground">
                  Department
                </TableHead>

                {/* Day Columns (1..31) */}
                {monthDays.map((d) => {
                  const isSelected = selectedDay === d.dayNum;
                  return (
                    <TableHead
                      key={d.dayNum}
                      onClick={() => setSelectedDay(selectedDay === d.dayNum ? null : d.dayNum)}
                      title={`Click to ${isSelected ? 'clear focus' : 'focus on'} Day ${d.dayNum}`}
                      className={cn(
                        "w-[36px] min-w-[36px] p-1 text-center border-r font-semibold cursor-pointer select-none transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-inset z-10 font-bold"
                          : d.isSunday
                          ? "bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-900/30"
                          : "text-foreground hover:bg-muted/70"
                      )}
                    >
                      <div className="flex flex-col items-center">
                        <span className={cn("font-bold text-xs", isSelected && "text-primary-foreground")}>
                          {d.dayNum}
                        </span>
                        <span className={cn(
                          "text-[9px] uppercase font-mono",
                          isSelected ? "text-primary-foreground/90 font-bold" : "text-muted-foreground"
                        )}>
                          {d.dayName.slice(0, 2)}
                        </span>
                      </div>
                    </TableHead>
                  );
                })}

                {/* Right Summary Columns */}
                <TableHead className="w-[45px] text-center border-r bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold">P</TableHead>
                <TableHead className="w-[45px] text-center border-r bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 font-bold">A</TableHead>

                <TableHead className="w-[50px] text-center border-r bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-semibold">CL Allot</TableHead>
                <TableHead className="w-[50px] text-center border-r bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-semibold">CL Taken</TableHead>
                <TableHead className="w-[50px] text-center border-r bg-amber-100/80 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 font-bold">CL Bal</TableHead>

                <TableHead className="w-[50px] text-center border-r bg-sky-50/70 dark:bg-sky-950/20 text-sky-800 dark:text-sky-300 font-semibold">ML Allot</TableHead>
                <TableHead className="w-[50px] text-center border-r bg-sky-50/70 dark:bg-sky-950/20 text-sky-800 dark:text-sky-300 font-semibold">ML Taken</TableHead>
                <TableHead className="w-[50px] text-center border-r bg-sky-100/80 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200 font-bold">ML Bal</TableHead>

                <TableHead className="w-[50px] text-center border-r bg-purple-50/70 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300 font-semibold">EL Allot</TableHead>
                <TableHead className="w-[50px] text-center border-r bg-purple-50/70 dark:bg-purple-950/20 text-purple-800 dark:text-purple-300 font-semibold">EL Taken</TableHead>
                <TableHead className="w-[50px] text-center border-r bg-purple-100/80 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 font-bold">EL Bal</TableHead>

                <TableHead className="w-[60px] text-center bg-primary/15 text-primary font-extrabold">Payable Days</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={daysInMonth + 16} className="text-center py-12 text-muted-foreground text-sm">
                    No faculty members found for the selected department or search filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeachers.map((teacher) => {
                  let pCount = 0;
                  let aCount = 0;
                  let clTakenCount = 0;
                  let mlTakenCount = 0;
                  let elTakenCount = 0;

                  const dailyCells = monthDays.map((d) => {
                    const hasCheckIn =
                      checkInMap.has(`${teacher.id}_${d.dateStr}`) ||
                      (teacher.biometricId && checkInMap.has(`bio_${teacher.biometricId}_${d.dateStr}`));
                    const leaveCode = leaveMap.get(`${teacher.id}_${d.dateStr}`);

                    if (hasCheckIn) {
                      pCount++;
                      return { status: 'P', style: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 font-bold' };
                    } else if (leaveCode) {
                      if (leaveCode === 'CL') {
                        clTakenCount++;
                        return { status: 'CL', style: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 font-bold' };
                      }
                      if (leaveCode === 'ML') {
                        mlTakenCount++;
                        return { status: 'ML', style: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 font-bold' };
                      }
                      if (leaveCode === 'EL') {
                        elTakenCount++;
                        return { status: 'EL', style: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 font-bold' };
                      }
                      return { status: leaveCode, style: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 font-bold' };
                    } else if (d.isSunday) {
                      return { status: 'WO', style: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 font-semibold' };
                    } else {
                      aCount++;
                      return { status: 'A', style: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 font-bold' };
                    }
                  });

                  // Quotas
                  const clAllotted = teacher.leaveQuotas?.['CL'] ?? teacher.leaveQuotas?.['Casual Leave (CL)'] ?? 12;
                  const mlAllotted = teacher.leaveQuotas?.['ML'] ?? teacher.leaveQuotas?.['Medical Leave (ML)'] ?? 10;
                  const elAllotted = teacher.leaveQuotas?.['EL'] ?? teacher.leaveQuotas?.['Earned Leave (EL)'] ?? 15;

                  const clBal = Math.max(0, clAllotted - clTakenCount);
                  const mlBal = Math.max(0, mlAllotted - mlTakenCount);
                  const elBal = Math.max(0, elAllotted - elTakenCount);
                  const totalPayableDays = pCount + clTakenCount + mlTakenCount + elTakenCount;

                  return (
                    <TableRow key={teacher.id} className="hover:bg-muted/30 transition-colors">
                      {/* Sticky Biometric ID */}
                      <TableCell className="sticky left-0 z-10 bg-card border-r font-mono text-xs font-semibold text-primary">
                        {teacher.biometricId ? `#${teacher.biometricId}` : `#${teacher.id.slice(0, 4)}`}
                      </TableCell>

                      {/* Sticky Faculty Name */}
                      <TableCell className="sticky left-[80px] z-10 bg-card border-r font-medium text-foreground truncate max-w-[180px]">
                        {teacher.name}
                      </TableCell>

                      {/* Sticky Department */}
                      <TableCell className="sticky left-[260px] z-10 bg-card border-r text-xs text-muted-foreground truncate max-w-[130px]">
                        <span className="px-2 py-0.5 rounded bg-muted font-medium text-[11px]">
                          {teacher.department || 'General Faculty'}
                        </span>
                      </TableCell>

                      {/* Daily Cells (1..31) */}
                      {dailyCells.map((cell, idx) => {
                        const isSelectedCol = selectedDay === (idx + 1);
                        return (
                          <TableCell
                            key={idx}
                            className={cn(
                              "p-1 text-center border-r transition-colors",
                              isSelectedCol && "bg-primary/10"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-7 h-7 rounded border text-[11px] transition-all",
                                cell.style,
                                isSelectedCol && "ring-2 ring-primary ring-offset-1 shadow-sm font-black scale-105"
                              )}
                            >
                              {cell.status}
                            </span>
                          </TableCell>
                        );
                      })}

                      {/* Right Hand Side Summary Columns */}
                      <TableCell className="text-center font-bold border-r bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                        {pCount}
                      </TableCell>
                      <TableCell className="text-center font-bold border-r bg-rose-50/80 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300">
                        {aCount}
                      </TableCell>

                      <TableCell className="text-center border-r font-mono text-muted-foreground">{clAllotted}</TableCell>
                      <TableCell className="text-center border-r font-mono text-amber-700 dark:text-amber-400 font-semibold">{clTakenCount}</TableCell>
                      <TableCell className="text-center border-r font-mono font-extrabold bg-amber-100/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
                        {clBal}
                      </TableCell>

                      <TableCell className="text-center border-r font-mono text-muted-foreground">{mlAllotted}</TableCell>
                      <TableCell className="text-center border-r font-mono text-sky-700 dark:text-sky-400 font-semibold">{mlTakenCount}</TableCell>
                      <TableCell className="text-center border-r font-mono font-extrabold bg-sky-100/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200">
                        {mlBal}
                      </TableCell>

                      <TableCell className="text-center border-r font-mono text-muted-foreground">{elAllotted}</TableCell>
                      <TableCell className="text-center border-r font-mono text-purple-700 dark:text-purple-400 font-semibold">{elTakenCount}</TableCell>
                      <TableCell className="text-center border-r font-mono font-extrabold bg-purple-100/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200">
                        {elBal}
                      </TableCell>

                      <TableCell className="text-center font-extrabold bg-primary/10 text-primary font-mono text-xs">
                        {totalPayableDays}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
