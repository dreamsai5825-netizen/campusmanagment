'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Assignment, College, Class } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ClipboardList, Calendar, BookOpen, School } from 'lucide-react';

export default function SuperAdminCollegeAssignmentsPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;

  const [college, setCollege] = useState<College | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
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

    // Query assignments
    const assignmentsQuery = query(
      collection(db, 'assignments'),
      where('collegeId', '==', collegeId)
    );
    const unsubAssignments = onSnapshot(assignmentsQuery, (snap) => {
      const list = snap.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Assignment)
      );
      setAssignments(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching assignments:', err);
      setLoading(false);
    });

    // Query classes to resolve names
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
      unsubAssignments();
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

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground">{college?.name || 'College'} / Academic Data</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-sky-500" />
            Assignments
          </h1>
        </div>
      </div>

      {/* Main List */}
      <div className="grid gap-4 md:grid-cols-2">
        {assignments.length === 0 ? (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground font-medium">No assignments found</p>
              <p className="text-sm text-muted-foreground/75 mt-1">Teachers in this college have not created any assignments yet.</p>
            </CardContent>
          </Card>
        ) : (
          assignments.map((assignment) => (
            <Card key={assignment.id} className="hover:border-primary/30 transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground leading-snug">{assignment.title}</CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1.5 mt-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      Subject: {assignment.subject || 'N/A'}
                    </CardDescription>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    assignment.status === 'active' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>
                    {assignment.status.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {assignment.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                    {assignment.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs pt-2 border-t">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <School className="h-3.5 w-3.5" />
                    Class: {classMap.get(assignment.classId) || 'N/A'}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1 border-l pl-3">
                    <Calendar className="h-3.5 w-3.5" />
                    Due Date: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
