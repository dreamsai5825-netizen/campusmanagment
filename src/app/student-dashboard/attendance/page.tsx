'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCurrentStudent } from '@/hooks/use-current-user';
import { BookOpen, CalendarCheck, LayoutList } from 'lucide-react';

export default function StudentAttendancePage() {
  const student = useCurrentStudent();
  const summary = student?.attendance?.summary ?? { present: 0, absent: 0, totalDays: 0 };
  const attendanceBySubject = student?.attendance?.bySubject ?? [];
  const hasAnyAttendance = summary.totalDays > 0 || attendanceBySubject.length > 0;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          My Attendance
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Here is your overall and subject-wise attendance record.
        </p>
      </div>

      {summary.totalDays > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Overall
              </CardTitle>
              <span className="font-bold text-xl">
                {summary.totalDays > 0
                  ? ((summary.present / summary.totalDays) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <CardDescription>
              Your overall attendance across all subjects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              value={summary.totalDays > 0 ? (summary.present / summary.totalDays) * 100 : 0}
              className="h-2"
            />
            <div className="flex justify-between text-sm">
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg">{summary.present}</span>
                <span className="text-muted-foreground">Present Days</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg">{summary.absent}</span>
                <span className="text-muted-foreground">Absent Days</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-bold text-lg">{summary.totalDays}</span>
                <span className="text-muted-foreground">Total Days</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject-wise distribution */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutList className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">
            Subject-wise distribution
          </h2>
        </div>

        {attendanceBySubject.length > 0 ? (
          <>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[400px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-right">Attendance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceBySubject.map((record) => {
                      const percentage =
                        record.total > 0 ? (record.present / record.total) * 100 : 0;
                      return (
                        <TableRow key={record.subject}>
                          <TableCell className="font-medium">{record.subject}</TableCell>
                          <TableCell className="text-center">{record.present}</TableCell>
                          <TableCell className="text-center">{record.absent}</TableCell>
                          <TableCell className="text-center">{record.total}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {attendanceBySubject.map((record) => {
                const percentage =
                  record.total > 0 ? (record.present / record.total) * 100 : 0;
                return (
                  <Card key={record.subject}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          {record.subject}
                        </CardTitle>
                        <span className="font-bold text-xl">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <CardDescription>
                        Your attendance record for {record.subject}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Progress value={percentage} className="h-2" />
                      <div className="flex justify-between text-sm">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-lg">{record.present}</span>
                          <span className="text-muted-foreground">Present Days</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-lg">{record.absent}</span>
                          <span className="text-muted-foreground">Absent Days</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-lg">{record.total}</span>
                          <span className="text-muted-foreground">Total Days</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          !hasAnyAttendance && (
            <Card>
              <CardContent className="flex justify-center items-center h-48">
                <p className="text-muted-foreground">
                  No attendance data available yet. Your teacher will mark attendance and it will appear here.
                </p>
              </CardContent>
            </Card>
          )
        )}

        {hasAnyAttendance && attendanceBySubject.length === 0 && (
          <Card>
            <CardContent className="flex justify-center items-center h-32">
              <p className="text-muted-foreground">
                Subject-wise breakdown will appear here once your teachers mark attendance by subject.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
