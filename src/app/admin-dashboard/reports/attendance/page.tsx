'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Calendar, 
  Download, 
  Eye, 
  Loader2, 
  GraduationCap, 
  Check, 
  X, 
  Minus, 
  CalendarDays,
  Search,
  BookOpen
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import { Preloader } from '@/components/ui/preloader';
import * as XLSX from 'xlsx';

export default function AttendanceReportsPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  
  // Modal states
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
  
  const [viewTodayOpen, setViewTodayOpen] = useState(false);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todaySearch, setTodaySearch] = useState('');

  const [viewMonthlyOpen, setViewMonthlyOpen] = useState(false);
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlySearch, setMonthlySearch] = useState('');
  
  const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-06"
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);

  useEffect(() => {
    if (!principal?.collegeId) return;

    const classesQuery = query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId));
    const unsubClasses = onSnapshot(classesQuery, 
      (snap) => {
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setClassesLoaded(true);
      },
      (err) => {
        console.error('Error loading classes:', err);
        setClassesLoaded(true);
      }
    );

    const studentsQuery = query(collection(db, 'students'), where('collegeId', '==', principal.collegeId));
    const unsubStudents = onSnapshot(studentsQuery, 
      (snap) => {
        setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setStudentsLoaded(true);
      },
      (err) => {
        console.error('Error loading students:', err);
        setStudentsLoaded(true);
      }
    );

    const subjectsQuery = query(collection(db, 'subjects'), where('collegeId', '==', principal.collegeId));
    const unsubSubjects = onSnapshot(subjectsQuery, 
      (snap) => {
        setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setSubjectsLoaded(true);
      },
      (err) => {
        console.error('Error loading subjects:', err);
        setSubjectsLoaded(true);
      }
    );

    return () => {
      unsubClasses();
      unsubStudents();
      unsubSubjects();
    };
  }, [principal?.collegeId]);

  // Load today's attendance records
  useEffect(() => {
    if (!viewTodayOpen || !selectedClass) return;
    setTodayLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const q = query(
      collection(db, 'attendanceRecords'),
      where('classId', '==', selectedClass.id),
      where('date', '==', today)
    );
    getDocs(q)
      .then((snap) => {
        setTodayRecords(snap.docs.map(d => d.data()));
        setTodayLoading(false);
      })
      .catch((e) => {
        console.error('Error fetching today\'s records:', e);
        setTodayLoading(false);
        toast({
          title: "Error",
          description: "Failed to load today's attendance records",
          variant: "destructive"
        });
      });
  }, [viewTodayOpen, selectedClass]);

  // Load monthly attendance records
  useEffect(() => {
    if (!viewMonthlyOpen || !selectedClass || !selectedMonth) return;
    setMonthlyLoading(true);
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;
    
    const q = query(
      collection(db, 'attendanceRecords'),
      where('classId', '==', selectedClass.id),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    getDocs(q)
      .then((snap) => {
        setMonthlyRecords(snap.docs.map(d => d.data()));
        setMonthlyLoading(false);
      })
      .catch((e) => {
        console.error('Error fetching monthly records:', e);
        setMonthlyLoading(false);
        toast({
          title: "Error",
          description: "Failed to load monthly attendance records",
          variant: "destructive"
        });
      });
  }, [viewMonthlyOpen, selectedClass, selectedMonth]);

  const handleClassClick = (cls: any) => {
    setSelectedClass(cls);
    setOptionsDialogOpen(true);
  };

  // Export Daily Excel
  const handleDownloadTodayExcel = async (cls: any) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const q = query(
        collection(db, 'attendanceRecords'),
        where('classId', '==', cls.id),
        where('date', '==', today)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => d.data());
      
      const classStudents = students.filter(s => s.classId === cls.id);
      const classSubjectIds = cls.subjectIds || [];
      const classSubjects = classSubjectIds.map((id: string) => subjects.find(s => s.id === id)).filter(Boolean);
      
      const headerRow = ['Student Name', 'Student ID', ...classSubjects.map((sub: any) => sub.name)];
      
      const dataRows = classStudents.map(student => {
        const row = [student.name, student.studentId || student.id];
        classSubjects.forEach((sub: any) => {
          const record = records.find(r => r.studentId === student.id && r.subjectId === sub.id);
          row.push(record ? record.status.toUpperCase() : '—');
        });
        return row;
      });
      
      const rows = [
        ['Institution Name', 'Annapurna Institute'],
        ['Class Name', cls.name],
        ['Date', today],
        [],
        headerRow,
        ...dataRows
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Attendance');
      XLSX.writeFile(wb, `${cls.name.replace(/\s+/g, '_')}_Daily_Attendance_${today}.xlsx`);
      
      toast({
        title: "Export Success",
        description: `Daily attendance report for ${cls.name} has been downloaded.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Export Error",
        description: "Failed to download daily attendance Excel.",
        variant: "destructive"
      });
    }
  };

  // Export Monthly Excel
  const handleDownloadMonthlyExcel = async (cls: any) => {
    try {
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;
      
      const q = query(
        collection(db, 'attendanceRecords'),
        where('classId', '==', cls.id),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => d.data());
      
      const classStudents = students.filter(s => s.classId === cls.id);
      
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const monthIndex = parseInt(monthStr, 10) - 1;
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      
      const headerRow = ['Student Name', 'Student ID', ...dayNumbers.map(d => String(d)), 'Total Present', 'Total Sessions', 'Attendance %'];
      
      const dataRows = classStudents.map(student => {
        let totalPresent = 0;
        let totalSessions = 0;
        
        const row = [student.name, student.studentId || student.id];
        
        dayNumbers.forEach(d => {
          const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
          const dayRecords = records.filter(r => r.studentId === student.id && r.date === dateStr);
          
          if (dayRecords.length === 0) {
            row.push('');
          } else {
            const hasPresent = dayRecords.some(r => r.status === 'present');
            const hasAbsent = dayRecords.some(r => r.status === 'absent');
            
            if (hasPresent) {
              row.push('P');
              totalPresent++;
              totalSessions++;
            } else if (hasAbsent) {
              row.push('A');
              totalSessions++;
            } else {
              row.push('—');
            }
          }
        });
        
        const pct = totalSessions > 0 ? ((totalPresent / totalSessions) * 100).toFixed(1) + '%' : '—';
        row.push(totalPresent, totalSessions, pct);
        
        return row;
      });
      
      const rows = [
        ['Institution Name', 'Annapurna Institute'],
        ['Class Name', cls.name],
        ['Month', selectedMonth],
        [],
        headerRow,
        ...dataRows
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Attendance');
      XLSX.writeFile(wb, `${cls.name.replace(/\s+/g, '_')}_Monthly_Attendance_${selectedMonth}.xlsx`);
      
      toast({
        title: "Export Success",
        description: `Monthly attendance report for ${cls.name} has been downloaded.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Export Error",
        description: "Failed to download monthly attendance Excel.",
        variant: "destructive"
      });
    }
  };

  const getStudentCount = (classId: string) => {
    return students.filter(s => s.classId === classId).length;
  };

  const getSubjectsForClass = (cls: any) => {
    const classSubjectIds = cls?.subjectIds || [];
    return classSubjectIds
      .map((id: string) => subjects.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', ') || 'No subjects assigned';
  };

  const pageLoading = !classesLoaded || !studentsLoaded || !subjectsLoaded;
  if (pageLoading) {
    return <Preloader message="Loading attendance reports..." fullScreen size="lg" />;
  }

  // Filter students for today view
  const todayClassStudents = selectedClass 
    ? students.filter(s => s.classId === selectedClass.id && s.name.toLowerCase().includes(todaySearch.toLowerCase()))
    : [];

  // Filter students for monthly view
  const monthlyClassStudents = selectedClass 
    ? students.filter(s => s.classId === selectedClass.id && s.name.toLowerCase().includes(monthlySearch.toLowerCase()))
    : [];

  const selectedClassSubjects = selectedClass
    ? (selectedClass.subjectIds || []).map((id: string) => subjects.find(s => s.id === id)).filter(Boolean)
    : [];

  const [selectedYearStr, selectedMonthStr] = selectedMonth.split('-');
  const selectedYearVal = parseInt(selectedYearStr, 10);
  const selectedMonthIndexVal = parseInt(selectedMonthStr, 10) - 1;
  const numDays = new Date(selectedYearVal, selectedMonthIndexVal + 1, 0).getDate();
  const daysList = Array.from({ length: numDays }, (_, i) => i + 1);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-900 text-white p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin-dashboard/reports">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-headline">Class Attendance Reports</h1>
            <p className="text-gray-300 text-sm">Select a class to view daily or monthly attendance registers.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-medium">{new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
        </div>
      </div>

      {/* Grid of Clickable Class Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {classes.length === 0 ? (
          <Card className="col-span-full border-dashed p-12 text-center bg-gray-50/50">
            <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="font-semibold text-lg text-gray-700">No Classes Found</h3>
            <p className="text-gray-500 text-sm mt-1">There are no classes created in this institution yet.</p>
          </Card>
        ) : (
          classes.map((cls) => (
            <Card 
              key={cls.id} 
              className="group cursor-pointer border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-indigo-500/40"
              onClick={() => handleClassClick(cls)}
            >
              <CardHeader className="pb-3 bg-gradient-to-br from-indigo-50/50 to-white">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {cls.name}
                  </CardTitle>
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-none font-bold">
                    {getStudentCount(cls.id)} Students
                  </Badge>
                </div>
                <CardDescription className="text-slate-500 font-medium text-xs flex items-center gap-1.5 mt-1.5">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[250px]">{getSubjectsForClass(cls)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 pb-4">
                <span className="text-indigo-600 font-semibold text-xs inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  Generate Attendance Reports <span className="text-sm font-bold">→</span>
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Main Options Dialog */}
      <Dialog open={optionsDialogOpen} onOpenChange={setOptionsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 bg-white/95 backdrop-blur-md">
          <DialogHeader className="pb-4 border-b border-slate-100">
            <DialogTitle className="text-xl font-bold text-slate-800">
              {selectedClass?.name} - Reports Scoping
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm mt-1">
              Select which attendance report you would like to view or export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            {/* Daily report block */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <CalendarDays className="h-4.5 w-4.5 text-indigo-600" />
                  Today&apos;s Attendance
                </h4>
                <p className="text-xs text-slate-500 mt-1">View or download attendance spreadsheet taken today across all subjects.</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs" 
                  onClick={() => {
                    setOptionsDialogOpen(false);
                    setViewTodayOpen(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" /> View Today
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs"
                  onClick={() => handleDownloadTodayExcel(selectedClass)}
                >
                  <Download className="w-4 h-4 mr-2" /> Download Excel
                </Button>
              </div>
            </div>

            {/* Monthly report block */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-pink-600" />
                    Monthly Cumulative Report
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">View or download a full grid register for a specific month.</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="month-select" className="text-xs font-semibold text-slate-700">Choose Month</Label>
                <Input
                  id="month-select"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full h-9 bg-white"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button 
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs"
                  onClick={() => {
                    setOptionsDialogOpen(false);
                    setViewMonthlyOpen(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" /> View Month
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs"
                  onClick={() => handleDownloadMonthlyExcel(selectedClass)}
                >
                  <Download className="w-4 h-4 mr-2" /> Download Excel
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setOptionsDialogOpen(false)} className="w-full sm:w-auto font-medium text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Today's Attendance View Dialog */}
      <Dialog open={viewTodayOpen} onOpenChange={setViewTodayOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto p-6 bg-white">
          <DialogHeader className="pb-4 border-b">
            <div className="flex justify-between items-center pr-6">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Daily Attendance - {selectedClass?.name}
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-sm mt-1">
                  Today&apos;s attendance records for the class: {new Date().toLocaleDateString('en-CA')}
                </DialogDescription>
              </div>
              <Button 
                onClick={() => handleDownloadTodayExcel(selectedClass)} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5"
              >
                <Download className="w-4 h-4" /> Download Excel
              </Button>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-center max-w-sm relative">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search students..."
                value={todaySearch}
                onChange={(e) => setTodaySearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {todayLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-slate-500 text-sm">Fetching daily records...</p>
              </div>
            ) : todayClassStudents.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No student profiles found for this class.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto max-h-[50vh]">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700 w-12">#</TableHead>
                      <TableHead className="font-semibold text-slate-700">Student Name</TableHead>
                      <TableHead className="font-semibold text-slate-700">Student ID</TableHead>
                      {selectedClassSubjects.map((sub: any) => (
                        <TableHead key={sub.id} className="font-semibold text-slate-700 text-center min-w-28">
                          {sub.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayClassStudents.map((student, idx) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono text-slate-500 text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-semibold text-slate-800">{student.name}</TableCell>
                        <TableCell className="font-mono text-slate-500 text-xs">{student.studentId || student.id.slice(0, 8)}</TableCell>
                        {selectedClassSubjects.map((sub: any) => {
                          const record = todayRecords.find(
                            (r) => r.studentId === student.id && r.subjectId === sub.id
                          );
                          const status = record?.status;
                          return (
                            <TableCell key={sub.id} className="text-center">
                              {status === 'present' ? (
                                <Badge className="bg-green-50 text-green-700 border-none font-bold">
                                  <Check className="w-3.5 h-3.5 mr-1" /> P
                                </Badge>
                              ) : status === 'absent' ? (
                                <Badge className="bg-red-50 text-red-700 border-none font-bold">
                                  <X className="w-3.5 h-3.5 mr-1" /> A
                                </Badge>
                              ) : status === 'cancelled' ? (
                                <Badge className="bg-yellow-50 text-yellow-700 border-none font-bold">
                                  <Minus className="w-3.5 h-3.5 mr-1" /> —
                                </Badge>
                              ) : (
                                <span className="text-slate-300 font-semibold">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setViewTodayOpen(false)} className="w-full sm:w-auto">
              Close View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monthly Attendance View Dialog */}
      <Dialog open={viewMonthlyOpen} onOpenChange={setViewMonthlyOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-6 bg-white">
          <DialogHeader className="pb-4 border-b">
            <div className="flex flex-wrap justify-between items-center gap-4 pr-6">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">
                  Monthly Register - {selectedClass?.name}
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-sm mt-1">
                  Cumulative daily record for the month: {selectedMonth}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="month-view-input" className="text-xs font-semibold text-slate-700">Month:</Label>
                  <Input
                    id="month-view-input"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-9 w-40 bg-white"
                  />
                </div>
                <Button 
                  onClick={() => handleDownloadMonthlyExcel(selectedClass)} 
                  className="bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs gap-1.5"
                >
                  <Download className="w-4 h-4" /> Download Excel
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-center max-w-sm relative">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search students..."
                value={monthlySearch}
                onChange={(e) => setMonthlySearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {monthlyLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
                <p className="text-slate-500 text-sm">Fetching monthly records...</p>
              </div>
            ) : monthlyClassStudents.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No student profiles found for this class.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto max-h-[55vh]">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700 w-12 sticky left-0 bg-slate-50">#</TableHead>
                      <TableHead className="font-semibold text-slate-700 sticky left-12 bg-slate-50 min-w-44 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Student Name</TableHead>
                      <TableHead className="font-semibold text-slate-700 min-w-28 text-center">Student ID</TableHead>
                      {daysList.map((day) => (
                        <TableHead key={day} className="font-semibold text-slate-700 text-center min-w-10 p-1 text-[10px]">
                          {day}
                        </TableHead>
                      ))}
                      <TableHead className="font-bold text-slate-800 text-center bg-slate-100 min-w-16">P</TableHead>
                      <TableHead className="font-bold text-slate-800 text-center bg-slate-100 min-w-16">Total</TableHead>
                      <TableHead className="font-bold text-slate-800 text-center bg-indigo-50 min-w-20">Rate %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyClassStudents.map((student, idx) => {
                      let totalPresent = 0;
                      let totalSessions = 0;

                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono text-slate-500 text-xs sticky left-0 bg-white">{idx + 1}</TableCell>
                          <TableCell className="font-bold text-slate-800 sticky left-12 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{student.name}</TableCell>
                          <TableCell className="font-mono text-slate-500 text-xs text-center">{student.studentId || student.id.slice(0, 8)}</TableCell>
                          {daysList.map((day) => {
                            const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                            const dayRecords = monthlyRecords.filter(
                              (r) => r.studentId === student.id && r.date === dateStr
                            );

                            if (dayRecords.length === 0) {
                              return (
                                <TableCell key={day} className="text-center p-1 text-slate-300">—</TableCell>
                              );
                            }

                            const hasPresent = dayRecords.some(r => r.status === 'present');
                            const hasAbsent = dayRecords.some(r => r.status === 'absent');
                            const hasCancelled = dayRecords.some(r => r.status === 'cancelled');

                            let display = '';
                            let textClass = '';

                            if (hasPresent) {
                              display = 'P';
                              textClass = 'text-green-600 font-bold bg-green-50/50';
                              totalPresent++;
                              totalSessions++;
                            } else if (hasAbsent) {
                              display = 'A';
                              textClass = 'text-red-600 font-bold bg-red-50/50';
                              totalSessions++;
                            } else if (hasCancelled) {
                              display = 'C';
                              textClass = 'text-yellow-600 font-semibold';
                            } else {
                              display = '—';
                              textClass = 'text-slate-300';
                            }

                            return (
                              <TableCell key={day} className={`text-center p-1 text-xs border ${textClass}`}>
                                {display}
                              </TableCell>
                            );
                          })}
                          
                          {/* Aggregate stats */}
                          <TableCell className="text-center bg-slate-50/80 font-bold text-green-700">{totalPresent}</TableCell>
                          <TableCell className="text-center bg-slate-50/80 font-semibold text-slate-700">{totalSessions}</TableCell>
                          <TableCell className="text-center bg-indigo-50/50 font-bold text-indigo-700">
                            {totalSessions > 0 ? (
                              <Badge className="bg-indigo-100 hover:bg-indigo-100 text-indigo-700 border-none font-mono font-bold text-[10px]">
                                {((totalPresent / totalSessions) * 100).toFixed(0)}%
                              </Badge>
                            ) : (
                              <span className="text-slate-400 font-semibold text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setViewMonthlyOpen(false)} className="w-full sm:w-auto">
              Close View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
