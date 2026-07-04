'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, collection, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { College, Principal, Student } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getStudentFeeSummary, formatInr } from '@/lib/student-fees';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  UserSquare2, 
  Settings, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldAlert, 
  UserCheck,
  BookOpen,
  Landmark,
  Megaphone,
  AlertOctagon,
  CreditCard,
  ClipboardList,
  CalendarDays,
  FileClock,
  MessageSquare
} from 'lucide-react';

export default function CollegeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;

  const [college, setCollege] = useState<College | null>(null);
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  
  // New States
  const [classCount, setClassCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [complaintCount, setComplaintCount] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  
  // Extra college data states
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [timetableCount, setTimetableCount] = useState(0);
  const [leaveRequestCount, setLeaveRequestCount] = useState(0);
  const [reportedIssueCount, setReportedIssueCount] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collegeId) return;

    const fetchData = async () => {
      try {
        // Fetch college doc
        const collegeSnap = await getDoc(doc(db, 'colleges', collegeId));
        if (collegeSnap.exists()) {
          setCollege({ id: collegeSnap.id, ...collegeSnap.data() } as College);
        }

        // Fetch principal
        const principalQuery = query(
          collection(db, 'principals'),
          where('collegeId', '==', collegeId)
        );
        const principalSnap = await getDocs(principalQuery);
        if (!principalSnap.empty) {
          setPrincipal({ id: principalSnap.docs[0].id, ...principalSnap.docs[0].data() } as Principal);
        }

        // Fetch students & calculate fees
        const studentQuery = query(
          collection(db, 'students'),
          where('collegeId', '==', collegeId)
        );
        const studentSnap = await getDocs(studentQuery);
        setStudentCount(studentSnap.size);
        
        let collected = 0;
        let outstanding = 0;
        studentSnap.docs.forEach(docSnap => {
          const studentData = docSnap.data() as Student;
          const fee = getStudentFeeSummary(studentData);
          collected += fee.paidAmount;
          outstanding += fee.outstandingAmount;
        });
        setTotalCollected(collected);
        setTotalOutstanding(outstanding);

        // Fetch teacher count
        const teacherQuery = query(
          collection(db, 'teachers'),
          where('collegeId', '==', collegeId)
        );
        const teacherSnap = await getDocs(teacherQuery);
        setTeacherCount(teacherSnap.size);

        // Fetch class count
        const classQuery = query(
          collection(db, 'classes'),
          where('collegeId', '==', collegeId)
        );
        const classSnap = await getDocs(classQuery);
        setClassCount(classSnap.size);

        // Fetch subject count
        const subjectQuery = query(
          collection(db, 'subjects'),
          where('collegeId', '==', collegeId)
        );
        const subjectSnap = await getDocs(subjectQuery);
        setSubjectCount(subjectSnap.size);

        // Fetch announcement count
        const announcementQuery = query(
          collection(db, 'announcements'),
          where('collegeId', '==', collegeId)
        );
        const announcementSnap = await getDocs(announcementQuery);
        setAnnouncementCount(announcementSnap.size);

        // Fetch complaint count
        const complaintQuery = query(
          collection(db, 'complaints'),
          where('collegeId', '==', collegeId)
        );
        const complaintSnap = await getDocs(complaintQuery);
        setComplaintCount(complaintSnap.size);

        // Fetch assignments count
        const assignmentsSnap = await getDocs(
          query(collection(db, 'assignments'), where('collegeId', '==', collegeId))
        );
        setAssignmentCount(assignmentsSnap.size);

        // Fetch timetables count
        const timetablesSnap = await getDocs(
          query(collection(db, 'timetables'), where('collegeId', '==', collegeId))
        );
        setTimetableCount(timetablesSnap.size);

        // Fetch leave requests count
        const leaveRequestsSnap = await getDocs(
          query(collection(db, 'leaveRequests'), where('collegeId', '==', collegeId))
        );
        setLeaveRequestCount(leaveRequestsSnap.size);

        // Fetch reported issues count
        const reportIssuesSnap = await getDocs(
          query(collection(db, 'reportIssues'), where('collegeId', '==', collegeId))
        );
        setReportedIssueCount(reportIssuesSnap.size);

      } catch (error) {
        console.error('Error fetching college details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collegeId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="text-center py-12">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-bold">College Not Found</h3>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/super-admin-dashboard')}>
          Back to Directory
        </Button>
      </div>
    );
  }

  const billingInfo = (college as any).billing;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/super-admin-dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground">Colleges / {college.name}</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">{college.name}</h1>
        </div>
      </div>

      {/* Section 1: Directory & Administration */}
      <div>
        <h2 className="text-lg font-bold text-muted-foreground mb-4 uppercase tracking-wider">Administration & Directory</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Primary Details */}
          <Card className="hover:border-primary/50 transition-all duration-300 flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Primary Details</CardTitle>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-2 text-xs flex-1">
              <div className="flex items-start gap-2">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{principal?.name ?? 'Not Assigned'}</p>
                  <p className="text-muted-foreground truncate">{principal?.email ?? 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-muted-foreground line-clamp-2">{college.address || 'No address provided'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-muted-foreground">{college.code}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Students */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/students`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Students</CardTitle>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{studentCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Total registered students</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Directory →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 3: Teachers */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/teachers`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Teachers</CardTitle>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                    <UserSquare2 className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{teacherCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Total faculty members</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Directory →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 4: Settings & Billing */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/settings`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Settings & Billing</CardTitle>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                    <Settings className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                {billingInfo ? (
                  <div className="text-xs space-y-1">
                    <p className="font-semibold capitalize text-amber-600 truncate">{billingInfo.module === 'per-head' ? 'Per Head Scale' : 'Full Scale'}</p>
                    <p className="text-muted-foreground">Est. Bill: {formatInr(billingInfo.module === 'per-head' ? billingInfo.amount * (studentCount + teacherCount + (principal ? 1 : 0)) : billingInfo.amount)} / yr</p>
                  </div>
                ) : (
                  <p className="text-xs text-destructive font-medium">No Module Set</p>
                )}
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  Billing Settings →
                </div>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* Section 2: College Data & Activities */}
      <div>
        <h2 className="text-lg font-bold text-muted-foreground mb-4 uppercase tracking-wider">Academic & Operational Data</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 5: Classes & Subjects */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/classes`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Classes & Subjects</CardTitle>
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{classCount} <span className="text-sm font-normal text-muted-foreground">Classes</span></div>
                <div className="text-xl font-bold text-muted-foreground mt-1">{subjectCount} <span className="text-sm font-normal text-muted-foreground">Subjects</span></div>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Curriculum →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 6: Fee Book */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/finances`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Fee Book</CardTitle>
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500 group-hover:bg-teal-500 group-hover:text-white transition-all duration-300">
                    <Landmark className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-sm space-y-1">
                  <p className="text-emerald-600 font-semibold">Collected: {formatInr(totalCollected)}</p>
                  <p className="text-orange-600 font-semibold">Outstanding: {formatInr(totalOutstanding)}</p>
                </div>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Financials →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 7: Announcements */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/announcements`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Announcements</CardTitle>
                  <div className="p-2 rounded-xl bg-pink-500/10 text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-all duration-300">
                    <Megaphone className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{announcementCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Total broadcast messages</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Announcements →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 8: Complaints */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/complaints`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Complaints</CardTitle>
                  <div className="p-2 rounded-xl bg-red-500/10 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all duration-300">
                    <AlertOctagon className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{complaintCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Total grievance reports</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Complaints →
                </div>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>

      {/* Section 3: Communications & Workflows */}
      <div>
        <h2 className="text-lg font-bold text-muted-foreground mb-4 uppercase tracking-wider">Communications & Workflows</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

          {/* Card 9: Assignments */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/assignments`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Assignments</CardTitle>
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-all duration-300">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{assignmentCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Tasks and homework lists</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Assignments →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 10: Timetables */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/timetables`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Timetables</CardTitle>
                  <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{timetableCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Schedules and calendars</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Timetables →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 11: Leave Requests */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/leave-requests`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Leave Requests</CardTitle>
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
                    <FileClock className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{leaveRequestCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Staff time-off applications</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Leave Requests →
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Card 12: Reported Issues */}
          <Link href={`/super-admin-dashboard/colleges/${collegeId}/reported-issues`}>
            <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors">Reported Issues</CardTitle>
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex flex-col justify-end flex-1">
                <div className="text-3xl font-extrabold text-foreground">{reportedIssueCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Technical and facility queries</p>
                <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
                  View Reported Issues →
                </div>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>
    </div>
  );
}
