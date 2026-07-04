'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Timetable, College, Class } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CalendarDays, Clock, School, Calendar } from 'lucide-react';

export default function SuperAdminCollegeTimetablesPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;

  const [college, setCollege] = useState<College | null>(null);
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedTimetable, setSelectedTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collegeId) return;

    // Fetch college
    const fetchCollege = async () => {
      try {
        const collegeSnap = await getDoc(doc(db, 'colleges', collegeId));
        if (collegeSnap.exists()) {
          setCollege({ id: collegeSnap.id, ...collegeSnap.data() } as College);
        }
      } catch (err) {
        console.error('Error fetching college:', err);
      }
    };
    fetchCollege();

    // Query timetables
    const timetablesQuery = query(
      collection(db, 'timetables'),
      where('collegeId', '==', collegeId)
    );
    const unsubTimetables = onSnapshot(timetablesQuery, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Timetable)
      );
      setTimetables(list);
      if (list.length > 0 && !selectedTimetable) {
        setSelectedTimetable(list[0]);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching timetables:', err);
      setLoading(false);
    });

    // Query classes
    const classesQuery = query(
      collection(db, 'classes'),
      where('collegeId', '==', collegeId)
    );
    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Class)
      );
      setClasses(list);
    }, (err) => {
      console.error('Error fetching classes:', err);
    });

    return () => {
      unsubTimetables();
      unsubClasses();
    };
  }, [collegeId]);

  const classMap = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach(c => map.set(c.id, c.name + (c.branch ? ` (${c.branch})` : '')));
    return map;
  }, [classes]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Days of week default
  const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground">{college?.name || 'College'} / Academic Schedules</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-orange-500" />
            Timetables
          </h1>
        </div>
      </div>

      {timetables.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">No timetables found</p>
            <p className="text-sm text-muted-foreground/75 mt-1">This college has not configured any timetables yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Timetable List sidebar */}
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Available Schedules</h2>
            {timetables.map((t) => (
              <Button
                key={t.id}
                variant={selectedTimetable?.id === t.id ? 'default' : 'outline'}
                className="justify-start text-left truncate w-full"
                onClick={() => setSelectedTimetable(t)}
              >
                <Calendar className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{t.name}</span>
              </Button>
            ))}
          </div>

          {/* Timetable view grid */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">{selectedTimetable?.name}</CardTitle>
                  <CardDescription>Visual event schedule grid</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedTimetable && selectedTimetable.events && selectedTimetable.events.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Day</TableHead>
                        <TableHead className="w-48">Time Slot</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Details / Subject</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTimetable.events.map((evt) => (
                        <TableRow key={evt.id}>
                          <TableCell className="font-semibold">{evt.day}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            {evt.startTime} - {evt.endTime}
                          </TableCell>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1">
                              <School className="h-3.5 w-3.5 text-muted-foreground" />
                              {evt.classId ? classMap.get(evt.classId) || evt.classId : 'General'}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-primary">{evt.customText || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm italic">
                  No events added to this timetable schedule.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
