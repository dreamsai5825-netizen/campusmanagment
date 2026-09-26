'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit,
  Mail,
  Phone,
  MapPin,
  IndianRupee,
  Calendar,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  BadgeCheck,
  Building2,
  Sparkles,
  TrendingUp,
  Filter,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Teacher, Employee, LeaveRequest } from '@/lib/types';
import { generateTeacherId } from '@/lib/id-utils';

const DEFAULT_LEAVE_TYPES: { type: string; code: string; defaultDays: number; description: string }[] = [
  { type: 'Casual Leave', code: 'CL', defaultDays: 12, description: 'Short planned personal leaves' },
  { type: 'Sick / Medical Leave', code: 'SL', defaultDays: 6, description: 'Health and medical recovery' },
  { type: 'Earned / Paid Leave', code: 'PL', defaultDays: 6, description: 'Annual accumulated vacation' },
  { type: 'Duty / Academic Leave', code: 'DL', defaultDays: 4, description: 'Workshops, exams & official duties' },
];

function formatCurrency(amount?: number) {
  if (!amount || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getInitials(name?: string) {
  if (!name) return 'EM';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function EmployeeManagementPage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<string>('all');

  // Dialog states
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState<{
    id?: string;
    employeeId: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    department: string;
    role: string;
    employmentType: 'Full-Time' | 'Part-Time' | 'Contract' | 'Visiting';
    joiningDate: string;
    currentCtc: number;
    monthlyGross: number;
    leaveQuotas: Record<string, number>;
  }>({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    department: 'General',
    role: 'Faculty',
    employmentType: 'Full-Time',
    joiningDate: new Date().toISOString().split('T')[0],
    currentCtc: 600000,
    monthlyGross: 50000,
    leaveQuotas: {
      'Casual Leave (CL)': 12,
      'Sick / Medical Leave (SL)': 6,
      'Earned / Paid Leave (PL)': 6,
      'Duty / Academic Leave (DL)': 4,
    },
  });

  // Load teachers/staff & leave requests for this college
  useEffect(() => {
    if (!principal?.collegeId) {
      setEmployees([]);
      setLeaveRequests([]);
      setLoading(false);
      return;
    }

    const unsubTeachers = onSnapshot(
      query(collection(db, 'teachers'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee));
        setEmployees(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading employees:', err);
        setLoading(false);
      }
    );

    const unsubLeaves = onSnapshot(
      query(collection(db, 'leaveRequests'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
        setLeaveRequests(list);
      }
    );

    return () => {
      unsubTeachers();
      unsubLeaves();
    };
  }, [principal?.collegeId]);

  // Compute departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      if (emp.department) set.add(emp.department);
      else if (emp.subjectSpecialty) set.add(emp.subjectSpecialty);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        (emp.name || '').toLowerCase().includes(q) ||
        (emp.employeeId || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q) ||
        (emp.phone || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q);

      const matchesDept =
        selectedDepartment === 'all' ||
        emp.department === selectedDepartment ||
        emp.subjectSpecialty === selectedDepartment;

      const matchesType =
        selectedEmploymentType === 'all' || emp.employmentType === selectedEmploymentType;

      return matchesSearch && matchesDept && matchesType;
    });
  }, [employees, searchQuery, selectedDepartment, selectedEmploymentType]);

  // Helper to calculate leaves taken for an employee
  const getEmployeeLeaveStats = (emp: Employee) => {
    // 1. Quotas (default 24 total if unset)
    const quotas: Record<string, number> = emp.leaveQuotas || {
      'Casual Leave (CL)': 12,
      'Sick / Medical Leave (SL)': 6,
      'Earned / Paid Leave (PL)': 6,
      'Duty / Academic Leave (DL)': 4,
    };
    const totalProvided = Object.values(quotas).reduce((sum, v) => sum + (Number(v) || 0), 0);

    // 2. Count approved leaves from leaveRequests or leavesTaken record
    const empLeaves = leaveRequests.filter(
      (lr) => (lr.senderId === emp.id || lr.senderName === emp.name) && lr.status === 'approved'
    );

    const hasLeavesTakenMap = emp.leavesTaken && Object.values(emp.leavesTaken).some((v) => Number(v) > 0);
    const takenByType: Record<string, number> = { ...(emp.leavesTaken || {}) };

    // Supplement with approved requests only if not recorded in leavesTaken map
    if (!hasLeavesTakenMap) {
      empLeaves.forEach((lr) => {
        const typeKey = lr.leaveType || Object.keys(quotas).find((k) =>
          lr.subject?.toLowerCase().includes(k.toLowerCase()) || lr.reason?.toLowerCase().includes(k.toLowerCase())
        ) || 'Casual Leave (CL)';
        let days = lr.duration || 1;
        if (!lr.duration && lr.startDate && lr.endDate) {
          const diff = new Date(lr.endDate).getTime() - new Date(lr.startDate).getTime();
          days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
        }
        takenByType[typeKey] = (takenByType[typeKey] || 0) + days;
      });
    }

    const totalTaken = Object.values(takenByType).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const totalRemaining = Math.max(0, totalProvided - totalTaken);

    return {
      quotas,
      totalProvided,
      takenByType,
      totalTaken,
      totalRemaining,
      empLeaves,
    };
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const totalCount = employees.length;
    let totalPayroll = 0;
    let totalQuota = 0;
    let totalTaken = 0;

    employees.forEach((emp) => {
      totalPayroll += Number(emp.currentCtc || 0);
      const stats = getEmployeeLeaveStats(emp);
      totalQuota += stats.totalProvided;
      totalTaken += stats.totalTaken;
    });

    return {
      totalCount,
      totalPayroll,
      totalQuota,
      totalTaken,
      totalRemaining: Math.max(0, totalQuota - totalTaken),
    };
  }, [employees, leaveRequests]);

  // Open Profile View
  const handleViewProfile = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsProfileModalOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormData({
      id: emp.id,
      employeeId: emp.employeeId || '',
      name: emp.name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      address: emp.address || '',
      department: emp.department || emp.subjectSpecialty || 'General',
      role: emp.role || (emp.roles && emp.roles[0]) || 'Faculty',
      employmentType: (emp.employmentType as any) || 'Full-Time',
      joiningDate: emp.joiningDate || new Date().toISOString().split('T')[0],
      currentCtc: emp.currentCtc || 600000,
      monthlyGross: emp.monthlyGross || Math.round((emp.currentCtc || 600000) / 12),
      leaveQuotas: emp.leaveQuotas || {
        'Casual Leave (CL)': 12,
        'Sick / Medical Leave (SL)': 6,
        'Earned / Paid Leave (PL)': 6,
        'Duty / Academic Leave (DL)': 4,
      },
    });
    setIsEditModalOpen(true);
  };

  // Open Add Dialog
  const handleOpenAdd = () => {
    const generatedEmpId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      employeeId: generatedEmpId,
      name: '',
      email: '',
      phone: '',
      address: '',
      department: 'Computer Science',
      role: 'Faculty',
      employmentType: 'Full-Time',
      joiningDate: new Date().toISOString().split('T')[0],
      currentCtc: 650000,
      monthlyGross: 54166,
      leaveQuotas: {
        'Casual Leave (CL)': 12,
        'Sick / Medical Leave (SL)': 6,
        'Earned / Paid Leave (PL)': 6,
        'Duty / Academic Leave (DL)': 4,
      },
    });
    setIsAddModalOpen(true);
  };

  // Handle Save
  const handleSaveEmployee = async (isNew: boolean) => {
    if (!principal?.collegeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Active college context missing.' });
      return;
    }
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Name and email are required.' });
      return;
    }

    setIsSaving(true);
    try {
      const totalLeavesProvided = Object.values(formData.leaveQuotas).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0
      );

      const payload = {
        collegeId: principal.collegeId,
        employeeId: formData.employeeId.trim(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        department: formData.department.trim(),
        role: formData.role.trim(),
        roles: [formData.role.trim()],
        employmentType: formData.employmentType,
        joiningDate: formData.joiningDate,
        currentCtc: Number(formData.currentCtc) || 0,
        monthlyGross: Number(formData.monthlyGross) || Math.round((Number(formData.currentCtc) || 0) / 12),
        leaveQuota: totalLeavesProvided,
        leaveQuotas: formData.leaveQuotas,
        updatedAt: new Date().toISOString(),
      };

      if (isNew) {
        const newDocRef = doc(collection(db, 'teachers'));
        await setDoc(newDocRef, {
          ...payload,
          createdAt: new Date().toISOString(),
          status: 'active',
        });
        toast({ title: 'Employee Created', description: `${formData.name} added to employee records.` });
        setIsAddModalOpen(false);
      } else if (formData.id) {
        await updateDoc(doc(db, 'teachers', formData.id), payload);
        toast({ title: 'Profile Updated', description: `Changes saved for ${formData.name}.` });
        setIsEditModalOpen(false);

        // Also update local selectedEmployee if viewing
        if (selectedEmployee && selectedEmployee.id === formData.id) {
          setSelectedEmployee({ ...selectedEmployee, ...payload });
        }
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message || 'Could not save employee.' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedStats = selectedEmployee ? getEmployeeLeaveStats(selectedEmployee) : null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
              Employee Management
            </h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Manage employee directory, comprehensive profiles, CTC compensation, and category-wise leave quotas.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="shrink-0 gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Add New Employee
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary bg-card/60 backdrop-blur-xs shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Employees
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Staff across all departments</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-card/60 backdrop-blur-xs shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Annual Payroll (CTC)
            </CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(kpis.totalPayroll)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total annualized staff compensation</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500 bg-card/60 backdrop-blur-xs shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Leaves Allotted
            </CardTitle>
            <Calendar className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-700 dark:text-sky-400">
              {kpis.totalQuota} Days
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all leave categories</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-card/60 backdrop-blur-xs shadow-xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Leave Consumption
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {kpis.totalTaken} Taken <span className="text-xs text-muted-foreground font-normal">/ {kpis.totalRemaining} Left</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.totalQuota > 0 ? `${Math.round((kpis.totalTaken / kpis.totalQuota) * 100)}% utilized` : '0% utilized'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Employee ID, Name, Email, Phone, or Department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEmploymentType} onValueChange={setSelectedEmploymentType}>
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="Job Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Types</SelectItem>
                <SelectItem value="Full-Time">Full-Time</SelectItem>
                <SelectItem value="Part-Time">Part-Time</SelectItem>
                <SelectItem value="Contract">Contract</SelectItem>
                <SelectItem value="Visiting">Visiting</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || selectedDepartment !== 'all' || selectedEmploymentType !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDepartment('all');
                  setSelectedEmploymentType('all');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Staff Directory</CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredEmployees.length} of {employees.length} employees
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-base font-semibold">No employees found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery ? 'Try adjusting your search criteria' : 'Click "Add New Employee" to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[240px]">Employee</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Department & Role</TableHead>
                    <TableHead>Current CTC</TableHead>
                    <TableHead className="w-[200px]">Leave Ledger (Bal / Total)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const stats = getEmployeeLeaveStats(emp);
                    const percentLeft =
                      stats.totalProvided > 0
                        ? Math.round((stats.totalRemaining / stats.totalProvided) * 100)
                        : 100;

                    return (
                      <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-primary/20">
                              <AvatarImage src={emp.photoUrl} alt={emp.name} />
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                {getInitials(emp.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                <span>{emp.name}</span>
                                {emp.employmentType && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                                    {emp.employmentType}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                                {emp.employeeId || `EMP-${emp.id.substring(0, 5)}`}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[170px]">{emp.email || '—'}</span>
                            </div>
                            {emp.phone && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span>{emp.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-medium text-xs text-foreground">
                              {emp.department || emp.subjectSpecialty || 'Academic'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {emp.role || (emp.roles && emp.roles.join(', ')) || 'Faculty'}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-semibold text-sm text-foreground font-mono">
                              {emp.currentCtc ? formatCurrency(emp.currentCtc) : '₹6,00,000'}
                              <span className="text-[10px] text-muted-foreground font-normal">/yr</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {formatCurrency(emp.monthlyGross || Math.round((emp.currentCtc || 600000) / 12))}/mo
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                {stats.totalRemaining} Left
                              </span>
                              <span className="text-muted-foreground text-[11px]">
                                {stats.totalTaken} used / {stats.totalProvided} alltd
                              </span>
                            </div>
                            <Progress
                              value={percentLeft}
                              className={`h-2 ${
                                percentLeft < 20
                                  ? '[&>div]:bg-red-500'
                                  : percentLeft < 50
                                  ? '[&>div]:bg-amber-500'
                                  : '[&>div]:bg-emerald-500'
                              }`}
                            />
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => handleViewProfile(emp)}
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              View Profile
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleOpenEdit(emp)}
                              title="Edit Employee & Quotas"
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* EMPLOYEE PROFILE MODAL (Rich Details view requested by user) */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {selectedEmployee && selectedStats && (
            <div>
              {/* Profile Top Banner */}
              <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-6 border-b">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary shadow-sm">
                      <AvatarImage src={selectedEmployee.photoUrl} alt={selectedEmployee.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                        {getInitials(selectedEmployee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold font-headline">{selectedEmployee.name}</h2>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-xs">
                          Active
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          ID: {selectedEmployee.employeeId || `EMP-${selectedEmployee.id.substring(0, 5)}`}
                        </span>
                        <span>•</span>
                        <span>{selectedEmployee.department || selectedEmployee.subjectSpecialty || 'Faculty'}</span>
                        <span>•</span>
                        <span>{selectedEmployee.employmentType || 'Full-Time'}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      handleOpenEdit(selectedEmployee);
                    }}
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit Profile
                  </Button>
                </div>
              </div>

              {/* Profile Body Content */}
              <div className="p-6 space-y-6">
                {/* 1. Contact & Identity Grid */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    Personal & Contact Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-xl border">
                    <div>
                      <span className="text-xs text-muted-foreground block">Employee ID</span>
                      <span className="text-sm font-semibold font-mono text-foreground">
                        {selectedEmployee.employeeId || 'EMP-UNASSIGNED'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground block">Official Email</span>
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{selectedEmployee.email || '—'}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground block">Phone Number</span>
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {selectedEmployee.phone || '—'}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-xs text-muted-foreground block">Residential Address</span>
                      <span className="text-sm font-medium text-foreground flex items-start gap-1.5 mt-0.5">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{selectedEmployee.address || 'Address not registered in file.'}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground block">Date of Joining</span>
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {selectedEmployee.joiningDate || '2024-01-15'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Compensation & CTC Information */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <IndianRupee className="h-4 w-4 text-emerald-600" />
                    Compensation & CTC Structure
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                      <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">
                        Current Annual CTC
                      </span>
                      <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono mt-1 block">
                        {formatCurrency(selectedEmployee.currentCtc || 600000)}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Per Annum Cost to Institution
                      </span>
                    </div>

                    <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl">
                      <span className="text-xs text-sky-800 dark:text-sky-300 font-medium block">
                        Monthly Gross Pay
                      </span>
                      <span className="text-2xl font-extrabold text-sky-700 dark:text-sky-400 font-mono mt-1 block">
                        {formatCurrency(selectedEmployee.monthlyGross || Math.round((selectedEmployee.currentCtc || 600000) / 12))}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Base Monthly Remuneration
                      </span>
                    </div>

                    <div className="bg-muted/40 border p-4 rounded-xl">
                      <span className="text-xs text-muted-foreground font-medium block">
                        Employment Classification
                      </span>
                      <span className="text-lg font-bold text-foreground mt-1 block">
                        {selectedEmployee.employmentType || 'Full-Time'}
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        {selectedEmployee.role || 'Permanent Faculty'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Leave Ledger & Balances by Types (Key Requirement) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-sky-600" />
                      Leave Entitlements & Balances
                    </h3>
                    <div className="text-xs font-semibold text-foreground">
                      Total: {selectedStats.totalRemaining} Remaining / {selectedStats.totalProvided} Allotted
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="bg-muted/30 p-4 rounded-xl border mb-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-foreground">Overall Annual Leave Consumption</span>
                      <span className="text-muted-foreground font-mono">
                        {selectedStats.totalTaken} days taken ({selectedStats.totalProvided > 0 ? Math.round((selectedStats.totalTaken / selectedStats.totalProvided) * 100) : 0}%)
                      </span>
                    </div>
                    <Progress
                      value={selectedStats.totalProvided > 0 ? ((selectedStats.totalProvided - selectedStats.totalTaken) / selectedStats.totalProvided) * 100 : 100}
                      className="h-2.5"
                    />
                  </div>

                  {/* Categorized Types Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(selectedStats.quotas).map(([typeKey, quotaDays]) => {
                      const taken = selectedStats.takenByType[typeKey] || 0;
                      const remaining = Math.max(0, (Number(quotaDays) || 0) - taken);
                      const percentLeft = quotaDays > 0 ? Math.round((remaining / quotaDays) * 100) : 0;

                      return (
                        <div key={typeKey} className="bg-card border p-3.5 rounded-xl shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-foreground">{typeKey}</span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] font-mono ${
                                remaining === 0
                                  ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                  : remaining <= 2
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              }`}
                            >
                              {remaining} Days Left
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 text-center text-xs py-1 bg-muted/30 rounded-lg">
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Provided</span>
                              <span className="font-bold text-foreground font-mono">{quotaDays}</span>
                            </div>
                            <div className="border-x">
                              <span className="text-[10px] text-muted-foreground block">Taken</span>
                              <span className="font-bold text-amber-600 font-mono">{taken}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block">Remaining</span>
                              <span className="font-bold text-emerald-600 font-mono">{remaining}</span>
                            </div>
                          </div>

                          <Progress value={percentLeft} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Recent Leave Activity */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Recent Leave Applications Log
                  </h3>
                  {selectedStats.empLeaves.length === 0 ? (
                    <div className="text-xs text-muted-foreground bg-muted/20 p-4 rounded-xl text-center border">
                      No approved or recorded leave applications for this employee yet.
                    </div>
                  ) : (
                    <div className="border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 text-xs">
                            <TableHead>Dates</TableHead>
                            <TableHead>Subject / Reason</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {selectedStats.empLeaves.slice(0, 5).map((lr) => (
                            <TableRow key={lr.id}>
                              <TableCell className="font-mono">
                                {lr.startDate || 'N/A'} {lr.endDate ? `to ${lr.endDate}` : ''}
                              </TableCell>
                              <TableCell>
                                <span className="font-medium text-foreground">{lr.subject || lr.reason || 'Leave'}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px]">
                                  {lr.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="p-4 border-t bg-muted/20">
                <Button variant="secondary" onClick={() => setIsProfileModalOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT EMPLOYEE DIALOG */}
      <Dialog
        open={isAddModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {isAddModalOpen ? 'Add New Employee' : `Edit Profile: ${formData.name}`}
            </DialogTitle>
            <DialogDescription>
              Provide employee identity, residential address, compensation (CTC), and leave quotas per type.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Row 1: Employee ID & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-id">Employee ID *</Label>
                <Input
                  id="emp-id"
                  placeholder="e.g. EMP-1042"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-name">Full Name *</Label>
                <Input
                  id="emp-name"
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            {/* Row 2: Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-email">Email Address *</Label>
                <Input
                  id="emp-email"
                  type="email"
                  placeholder="rajesh.sharma@college.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-phone">Phone Number</Label>
                <Input
                  id="emp-phone"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Row 3: Residential Address */}
            <div className="space-y-1.5">
              <Label htmlFor="emp-address">Residential Address</Label>
              <Input
                id="emp-address"
                placeholder="Flat No, Street, Landmark, City, State, PIN"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            {/* Row 4: Department, Role & Job Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-dept">Department</Label>
                <Input
                  id="emp-dept"
                  placeholder="e.g. Computer Science"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-role">Designation / Role</Label>
                <Input
                  id="emp-role"
                  placeholder="e.g. Assistant Professor"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-type">Job Type</Label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(val: any) => setFormData({ ...formData, employmentType: val })}
                >
                  <SelectTrigger id="emp-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-Time">Full-Time</SelectItem>
                    <SelectItem value="Part-Time">Part-Time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Visiting">Visiting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 5: CTC & Monthly Salary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
              <div className="space-y-1.5">
                <Label htmlFor="emp-ctc" className="text-emerald-900 dark:text-emerald-300">
                  Current Annual CTC (₹ / Annum)
                </Label>
                <Input
                  id="emp-ctc"
                  type="number"
                  placeholder="720000"
                  value={formData.currentCtc}
                  onChange={(e) => {
                    const ctc = Number(e.target.value) || 0;
                    setFormData({
                      ...formData,
                      currentCtc: ctc,
                      monthlyGross: Math.round(ctc / 12),
                    });
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-monthly" className="text-emerald-900 dark:text-emerald-300">
                  Monthly Gross Salary (₹ / Month)
                </Label>
                <Input
                  id="emp-monthly"
                  type="number"
                  placeholder="60000"
                  value={formData.monthlyGross}
                  onChange={(e) => setFormData({ ...formData, monthlyGross: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Row 6: Leave Quotas by Types (Key Requirement) */}
            <div className="space-y-2 bg-sky-500/5 p-3 rounded-xl border border-sky-500/20">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sky-900 dark:text-sky-300">
                  Leave Quotas Provided (Days / Year by Type)
                </Label>
                <span className="text-xs font-mono font-bold text-sky-700 dark:text-sky-400">
                  Total:{' '}
                  {Object.values(formData.leaveQuotas).reduce((sum, v) => sum + (Number(v) || 0), 0)}{' '}
                  Days
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {DEFAULT_LEAVE_TYPES.map((lt) => {
                  const key = `${lt.type} (${lt.code})`;
                  return (
                    <div key={key} className="space-y-1">
                      <span className="text-[11px] text-muted-foreground block truncate" title={lt.type}>
                        {lt.code} ({lt.type.split(' ')[0]})
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="90"
                        value={formData.leaveQuotas[key] ?? lt.defaultDays}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setFormData({
                            ...formData,
                            leaveQuotas: {
                              ...formData.leaveQuotas,
                              [key]: val,
                            },
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => handleSaveEmployee(isAddModalOpen)}
            >
              {isSaving ? 'Saving…' : isAddModalOpen ? 'Create Employee' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
