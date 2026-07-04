'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentStudent } from '@/hooks/use-current-user';
import { formatSlot12h } from '@/lib/time-utils';
import type { Class, Subject } from '@/lib/types';
import { CalendarSearch } from 'lucide-react';

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
];

type TimetableEvent = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  classId?: string;
  customText?: string;
};

type Timetable = {
  id: string;
  name: string;
  collegeId?: string;
  events: TimetableEvent[];
  timeSlots?: string[];
  days?: string[];
};

export default function StudentTimetablePage() {
  const student = useCurrentStudent();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!student?.collegeId) {
      setTimetables([]);
      return;
    }
    const q = query(
      collection(db, 'timetables'),
      where('collegeId', '==', student.collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setTimetables(
        snap.docs.map((d) => ({
          id: d.id,
          events: d.data().events ?? [],
          timeSlots: d.data().timeSlots,
          days: d.data().days,
          name: d.data().name ?? 'Timetable',
          collegeId: d.data().collegeId,
        } as Timetable))
      );
    });
    return () => unsub();
  }, [student?.collegeId]);

  useEffect(() => {
    if (!student?.collegeId) {
      setClasses([]);
      return;
    }
    const q = query(
      collection(db, 'classes'),
      where('collegeId', '==', student.collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });
    return () => unsub();
  }, [student?.collegeId]);

  useEffect(() => {
    if (!student?.collegeId) {
      setSubjects([]);
      return;
    }
    const q = query(
      collection(db, 'subjects'),
      where('collegeId', '==', student.collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
    });
    return () => unsub();
  }, [student?.collegeId]);

  const timetable: Timetable | undefined = timetables[0];

  const days = useMemo(() => {
    if (!timetable?.days?.length) return DEFAULT_DAYS;
    return timetable.days;
  }, [timetable]);

  const timeSlots = useMemo(() => {
    if (timetable?.timeSlots?.length) {
      return [...timetable.timeSlots].sort((a, b) =>
        a.split(' - ')[0].localeCompare(b.split(' - ')[0])
      );
    }
    if (!timetable) return DEFAULT_TIME_SLOTS;
    const allSlots = new Set<string>(DEFAULT_TIME_SLOTS);
    timetable.events?.forEach((event) => {
      if (event.startTime && event.endTime) {
        allSlots.add(`${event.startTime.trim()} - ${event.endTime.trim()}`);
      }
    });
    return Array.from(allSlots).sort((a, b) =>
      a.split(' - ')[0].localeCompare(b.split(' - ')[0])
    );
  }, [timetable]);

  const normalizeTime = (t: string): string => {
    const s = (t ?? '').trim();
    if (s.length === 4 && s[1] === ':') return '0' + s;
    return s;
  };

  const getEventForSlot = (day: string, timeSlot: string): TimetableEvent | undefined => {
    if (!timetable?.events?.length) return undefined;
    const parts = timeSlot.split(' - ').map((s) => s.trim());
    const slotStart = normalizeTime(parts[0] ?? '');
    const slotEnd = normalizeTime(parts[1] ?? '');
    if (!slotStart || !slotEnd) return undefined;

    const ok = (e: TimetableEvent) => {
      if (e.day !== day) return false;
      if (e.classId && e.classId !== student?.classId) return false;
      return true;
    };
    const exact = timetable.events.find(
      (e) => ok(e) && normalizeTime(e.startTime) === slotStart && normalizeTime(e.endTime) === slotEnd
    );
    if (exact) return exact;
    return timetable.events.find((e) => {
      if (!ok(e)) return false;
      const eStart = normalizeTime(e.startTime);
      const eEnd = normalizeTime(e.endTime);
      return slotStart >= eStart && slotEnd <= eEnd;
    });
  };

  const getSubjectName = (classItem: Class): string => {
    if (classItem.subject) return classItem.subject;
    const firstId = classItem.subjectIds?.[0];
    if (!firstId) return classItem.name;
    const sub = subjects.find((s) => s.id === firstId);
    return sub?.name ?? classItem.name;
  };

  if (!student) return null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          My Timetable
        </h1>
        <p className="text-muted-foreground">
          Your weekly class schedule{student.classId ? ' for your class' : ''}.
        </p>
      </div>

      {timetable ? (
        <Card>
          <CardHeader>
            <CardTitle>{timetable.name}</CardTitle>
            <CardDescription>
              This is a view-only schedule. Contact administration for any changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28 border-r bg-muted/50">Day</TableHead>
                    {timeSlots.map((slot) => (
                      <TableHead
                        key={slot}
                        className="border-r text-center min-w-[120px] bg-muted/50 whitespace-nowrap"
                      >
                        {formatSlot12h(slot)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((day) => (
                    <TableRow key={day}>
                      <TableCell className="font-medium border-r align-top w-28">{day}</TableCell>
                      {timeSlots.map((slot) => (
                        <TableCell
                          key={day + '-' + slot}
                          className="p-1 border-r align-top min-h-[4rem]"
                        >
                          <div className="w-full min-h-[4rem] text-left p-1">
                            {(() => {
                              const event = getEventForSlot(day, slot);
                              if (!event) return null;
                              if (event.customText) {
                                return (
                                  <div className="bg-primary/10 p-2 rounded-lg min-h-[3rem] flex flex-col justify-center">
                                    <p className="font-semibold text-primary text-sm">{event.customText}</p>
                                  </div>
                                );
                              }
                              if (event.classId) {
                                const eventClass = classes.find((c) => c.id === event.classId);
                                if (eventClass) {
                                  const subjectLabel = getSubjectName(eventClass);
                                  return (
                                    <div className="bg-primary/10 p-2 rounded-lg min-h-[3rem] flex flex-col justify-center">
                                      <p className="font-semibold text-primary text-sm">{subjectLabel}</p>
                                      <p className="text-xs text-muted-foreground">{eventClass.name}</p>
                                    </div>
                                  );
                                }
                              }
                              return null;
                            })()}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No Timetable Available</CardTitle>
            <CardDescription>
              {student.collegeId
                ? 'Your timetable has not been created yet. Contact your administration.'
                : 'Your profile is not linked to a college yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-10">
            <CalendarSearch className="w-16 h-16 text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
