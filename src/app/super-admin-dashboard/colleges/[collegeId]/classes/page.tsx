'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { College, Class, Subject } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, BookOpen, School, Notebook } from 'lucide-react';

export default function CollegeClassesPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;

  const [college, setCollege] = useState<College | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collegeId) return;

    const fetchData = async () => {
      try {
        // Fetch college
        const collegeSnap = await getDoc(doc(db, 'colleges', collegeId));
        if (collegeSnap.exists()) {
          setCollege({ id: collegeSnap.id, ...collegeSnap.data() } as College);
        }

        // Fetch classes
        const classesSnap = await getDocs(
          query(collection(db, 'classes'), where('collegeId', '==', collegeId))
        );
        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));

        // Fetch subjects
        const subjectsSnap = await getDocs(
          query(collection(db, 'subjects'), where('collegeId', '==', collegeId))
        );
        setSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));

      } catch (error) {
        console.error('Error fetching classes and subjects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collegeId]);

  const subjectMap = React.useMemo(() => {
    const map = new Map<string, string>();
    subjects.forEach(s => map.set(s.id, s.name));
    return map;
  }, [subjects]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground">{college?.name} / Curriculum</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">Classes & Subjects</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Classes Table Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-primary" />
              Classes Directory
            </CardTitle>
            <CardDescription>
              List of all classrooms registered under the college.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Name</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Subjects Count</TableHead>
                    <TableHead>Subjects List</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length > 0 ? (
                    classes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-semibold">{c.name}</TableCell>
                        <TableCell>{c.branch || '—'}</TableCell>
                        <TableCell>{c.subjectIds?.length ?? 0}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {c.subjectIds && c.subjectIds.length > 0 ? (
                            c.subjectIds.map(sid => subjectMap.get(sid) || sid).join(', ')
                          ) : (
                            <span className="text-muted-foreground text-xs italic">No subjects allocated</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No classes found for this college.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Subjects list card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Notebook className="h-5 w-5 text-primary" />
              Available Subjects
            </CardTitle>
            <CardDescription>
              List of all course subjects defined.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subjects.length > 0 ? (
              <div className="grid gap-2">
                {subjects.map((sub) => (
                  <div key={sub.id} className="p-3 border rounded-xl bg-card hover:bg-accent/30 transition-colors flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{sub.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground italic">
                No subjects registered.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
