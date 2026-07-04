'use client';

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { use } from 'react';
import {
  ArrowLeft,
  Book,
  Phone,
  User,
  Users,
  Landmark,
  CheckCircle2,
  XCircle,
  CircleEllipsis,
  CalendarDays,
  NotebookText,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import AssessmentForm from '@/components/assessment-form';
import { StudentAttendanceModal } from '@/components/student-attendance-modal';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { useEffect, useState } from 'react';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student, Class, Parent, Subject } from '@/lib/types';

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = use(params);
  const teacher = useCurrentTeacher();
  const [student, setStudent] = useState<Student | null>(null);
  const [studentLoaded, setStudentLoaded] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentParent, setStudentParent] = useState<Parent | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!studentId) return;
    setStudentLoaded(false);
    const unsub = onSnapshot(doc(db, 'students', studentId), (snap) => {
      setStudentLoaded(true);
      if (snap.exists()) setStudent({ id: snap.id, ...snap.data() } as Student);
      else setStudent(null);
    });
    return () => unsub();
  }, [studentId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!studentId) return;
    const q = query(collection(db, 'parents'), where('studentId', '==', studentId));
    const unsub = onSnapshot(q, (snap) => {
      const doc = snap.docs[0];
      setStudentParent(doc ? { id: doc.id, ...doc.data() } as Parent : null);
    });
    return () => unsub();
  }, [studentId]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subjects'), (snap) => {
      setAllSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
    });
    return () => unsub();
  }, []);

  if (studentLoaded && studentId && student === null) notFound();
  if (!student) return null;

  const studentImage = PlaceHolderImages.find((p) => p.id === student.id);
  const studentClass = classes.find((c) => c.id === student.classId);

  const summary = student.attendance?.summary;
  const attendancePercentage =
    summary && summary.totalDays > 0
      ? (summary.present / summary.totalDays) * 100
      : 0;

  const getFeeStatus = (status: string) => {
    switch (status) {
      case 'Paid':
        return { icon: CheckCircle2, color: 'text-green-600' };
      case 'Partially Paid':
        return { icon: CircleEllipsis, color: 'text-yellow-500' };
      case 'Not Paid':
        return { icon: XCircle, color: 'text-red-600' };
      default:
        return { icon: CircleEllipsis, color: 'text-muted-foreground' };
    }
  };
  const feeStatusInfo = getFeeStatus(student.fees?.status ?? '');
  const FeeStatusIcon = feeStatusInfo.icon;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/students/class/${classId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Student Profile
          </h1>
          <p className="text-muted-foreground">
            Detailed information about {student.name}.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="text-center">
            <CardHeader className="items-center">
              {studentImage && (
                <Image
                  src={studentImage.imageUrl}
                  alt={student.name}
                  width={128}
                  height={128}
                  className="rounded-full border-4 border-primary/20"
                  data-ai-hint={studentImage.imageHint}
                />
              )}
              <CardTitle className="pt-4">{student.name}</CardTitle>
              <CardDescription>
                Student ID: {student.studentId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentClass && <Badge>{studentClass.name}</Badge>}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div className="flex items-center">
                <User className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Full Name:</span>
                <span className="text-muted-foreground">{student.name}</span>
              </div>
              <div className="flex items-center">
                <Mail className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Email:</span>
                <span className="text-muted-foreground">{student.email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Student Phone:</span>
                <span className="text-muted-foreground">{student.phone}</span>
              </div>
              <div className="flex items-center">
                <Book className="h-5 w-5 mr-3 text-muted-foreground" />
                <span className="font-medium w-32">Class:</span>
                <span className="text-muted-foreground">
                  {studentClass?.name} - {studentClass?.subject}
                </span>
              </div>
              {studentParent && (
                <>
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className="font-medium w-32">Parent/Guardian:</span>
                    <span className="text-muted-foreground">
                      {studentParent.name} ({studentParent.relationship})
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className="font-medium w-32">Parent's Phone:</span>
                    <span className="text-muted-foreground">
                      {studentParent.phone}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Fee Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-2 font-medium">
                <FeeStatusIcon
                  className={cn('h-5 w-5', feeStatusInfo.color)}
                />
                <span className={feeStatusInfo.color}>
                  {student.fees?.status ?? '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Balance</span>
              <span className="font-bold text-lg">
                ${(student.fees?.balance ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Attendance Record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Present</span>
              <span className="font-medium text-green-600">
                {summary?.present ?? 0} days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Absent</span>
              <span className="font-medium text-red-600">
                {summary?.absent ?? 0} days
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Percentage</span>
                <span className="font-bold text-lg">
                  {attendancePercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={attendancePercentage} className="h-2" />
            </div>
            <StudentAttendanceModal
              studentId={student.id}
              studentName={student.name}
              teacherSubjectIds={teacher?.subjectIds ?? []}
              allSubjects={allSubjects}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookText className="h-5 w-5 text-primary" />
              Internal Assessment
            </CardTitle>
            <CardDescription>
              Update student marks for each subject.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AssessmentForm
              initialAssessments={student.assessments}
              teacherSubject={teacher?.subjectSpecialty ?? ''}
              studentId={student.id}
              showAddButton={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
