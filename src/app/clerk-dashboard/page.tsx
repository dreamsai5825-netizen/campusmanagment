'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  School,
  Users,
  Calendar,
  Megaphone,
  Landmark,
  UserPlus,
  Clock,
} from 'lucide-react';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { filterByAcademicYear } from '@/lib/academic-year-filter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import type { Student, Teacher } from '@/lib/types';

export default function ClerkDashboardPage() {
  const principal = useCurrentPrincipal(); // Resolves clerk data
  const {
    selectedAcademicYear,
    setSelectedAcademicYear,
    availableAcademicYears,
    currentAcademicYear,
  } = useAcademicYear();
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [classCount, setClassCount] = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [isAcademicYearDialogOpen, setIsAcademicYearDialogOpen] = useState(false);

  // License Countdown States
  const [countdownText, setCountdownText] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');
  const [hasLicense, setHasLicense] = useState(false);

  // Helper countdown function
  const getCountdown = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;

    if (diff <= 0) {
      return { expired: true, text: 'Expired' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let text = '';
    if (days > 0) text += `${days}d `;
    if (hours > 0 || days > 0) text += `${hours}h `;
    text += `${minutes}m`;

    return { expired: false, text };
  };

  useEffect(() => {
    if (!principal?.collegeId) return;

    const unsub = onSnapshot(doc(db, 'colleges', principal.collegeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const billing = data.billing;
        if (billing && billing.expiryDate) {
          setHasLicense(true);
          setPaymentLink(billing.paymentLink || '');
          
          const update = () => {
            const res = getCountdown(billing.expiryDate);
            setCountdownText(res.text);
            setIsExpired(res.expired);
          };
          update();
          const timer = setInterval(update, 60000);
          return () => clearInterval(timer);
        } else {
          setHasLicense(false);
        }
      }
    });

    return () => unsub();
  }, [principal?.collegeId]);

  const studentsForYear = useMemo(
    () => filterByAcademicYear(allStudents, selectedAcademicYear),
    [allStudents, selectedAcademicYear]
  );
  const studentCount = studentsForYear.length;
  const teachersForYear = useMemo(
    () => filterByAcademicYear(allTeachers, selectedAcademicYear),
    [allTeachers, selectedAcademicYear]
  );
  const teacherCount = teachersForYear.length;

  const handleAcademicYearChange = useCallback(
    (value: string) => {
      setSelectedAcademicYear(value);
      setIsAcademicYearDialogOpen(false);
    },
    [setSelectedAcademicYear]
  );

  useEffect(() => {
    if (!principal?.collegeId) {
      setAllStudents([]);
      setAllTeachers([]);
      setClassCount(0);
      setAnnouncementCount(0);
      return;
    }
    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setAllStudents(
          snap.docs.map((d) => ({ ...d.data(), id: d.id } as Student))
        );
      }
    );
    const unsubTeachers = onSnapshot(
      query(collection(db, 'teachers'), where('collegeId', '==', principal.collegeId)),
      (snap) =>
        setAllTeachers(
          snap.docs.map((d) => ({ ...d.data(), id: d.id } as Teacher))
        )
    );
    const unsubClasses = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
      (snap) => setClassCount(snap.size)
    );
    const unsubAnnouncements = onSnapshot(
      query(collection(db, 'announcements'), where('collegeId', '==', principal.collegeId)),
      (snap) => setAnnouncementCount(snap.size)
    );

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubClasses();
      unsubAnnouncements();
    };
  }, [principal?.collegeId]);

  const dashboardCards = [
    {
      title: 'Academic Year',
      value: selectedAcademicYear,
      subtitle:
        selectedAcademicYear === currentAcademicYear
          ? 'Current academic year'
          : 'Click to change',
      icon: Calendar,
      href: null as string | null,
      isAcademicYear: true,
    },
    {
      title: 'Admission',
      value: 'New Student',
      subtitle: selectedAcademicYear,
      icon: UserPlus,
      href: '/clerk-dashboard/admission',
    },
    {
      title: 'Total Students',
      value: studentCount,
      subtitle: `In ${selectedAcademicYear}`,
      icon: Users,
      href: '/clerk-dashboard/students',
    },
    {
      title: 'Total Teachers',
      value: teacherCount,
      subtitle: `In ${selectedAcademicYear}`,
      icon: Users,
      href: '/clerk-dashboard/teachers',
    },
    {
      title: 'Total Classes',
      value: classCount,
      subtitle: 'All classes',
      icon: School,
      href: '/clerk-dashboard/classes',
    },
    {
      title: 'Fee Book',
      value: 'By Class',
      subtitle: selectedAcademicYear,
      icon: Landmark,
      href: '/clerk-dashboard/finances',
    },
  ];

  const academicYearSelect = (
    <Select value={selectedAcademicYear} onValueChange={handleAcademicYearChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select academic year..." />
      </SelectTrigger>
      <SelectContent side="bottom" className="max-h-48 overflow-y-auto">
        {availableAcademicYears.map((year) => (
          <SelectItem key={year} value={year}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          Clerk Dashboard
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Welcome back, {principal?.name ?? 'Clerk'}! Viewing data for{' '}
          <span className="font-medium text-foreground">{selectedAcademicYear}</span>.
        </p>
      </div>

      {hasLicense && (
        <Card className={`border-l-4 ${isExpired ? 'border-l-destructive bg-destructive/5' : 'border-l-amber-500 bg-amber-500/5'}`}>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${isExpired ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600'}`}>
                <Clock className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-sm text-foreground">
                  {isExpired ? 'System License Expired' : 'System License Renewal Countdown'}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isExpired 
                    ? 'Your access license has expired. Please process the pending payment to prevent service interruption.'
                    : `Your system subscription is valid. Time remaining: ${countdownText}. Please pay your annual maintenance or per-head usage bill.`}
                </p>
              </div>
            </div>
            {paymentLink && (
              <Button 
                variant={isExpired ? 'destructive' : 'default'} 
                className="shrink-0"
                onClick={() => window.open(paymentLink, '_blank')}
              >
                Pay Bill & Renew
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dashboardCards.map((card) => {
          const cardComponent = (
            <Card
              key={card.title}
              className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                )}
              </CardContent>
            </Card>
          );

          if (card.isAcademicYear) {
            return (
              <Dialog
                key={card.title}
                open={isAcademicYearDialogOpen}
                onOpenChange={setIsAcademicYearDialogOpen}
              >
                <DialogTrigger asChild>
                  <div className="cursor-pointer">{cardComponent}</div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Academic Year</DialogTitle>
                    <DialogDescription>
                      Choose the academic year to filter students, fees, and related
                      records.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {academicYearSelect}
                  </div>
                </DialogContent>
              </Dialog>
            );
          }

          return (
            <Link href={card.href!} key={card.title} className="cursor-pointer">
              {cardComponent}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School Statistics Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Student counts reflect the selected academic year: {selectedAcademicYear}. Teachers,
              classes, and announcements are shown college-wide. Use the Academic Year card above to switch between academic cycles.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
