'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Class, Student } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users, BookOpen } from 'lucide-react';
import { useCurrentTeacher } from '@/hooks/use-current-user';

export default function StudentsPage() {
  const router = useRouter();
  const teacher = useCurrentTeacher();
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentCountByClass, setStudentCountByClass] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacher?.collegeId) return;

    // Load classes for this college
    const classQuery = query(
      collection(db, 'classes'),
      where('collegeId', '==', teacher.collegeId)
    );
    const unsubC = onSnapshot(classQuery, (snap) => {
      const loadedClasses = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class));
      setClasses(loadedClasses);

      // Load student counts for each class
      const counts: Record<string, number> = {};
      loadedClasses.forEach((cls) => {
        const studentQuery = query(
          collection(db, 'students'),
          where('classId', '==', cls.id)
        );
        onSnapshot(studentQuery, (studentSnap) => {
          counts[cls.id] = studentSnap.docs.length;
          setStudentCountByClass({ ...counts });
        });
      });

      setLoading(false);
    });

    return () => unsubC();
  }, [teacher?.collegeId]);

  const handleClassClick = (classId: string) => {
    router.push(`/dashboard/students/class/${classId}`);
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
          Students by Class
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Select a class to view and manage students.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading classes...
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No classes found. Create classes in Admin Dashboard.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleClassClick(cls.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {cls.name}
                </CardTitle>
                {cls.subject && (
                  <CardDescription>{cls.subject}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{studentCountByClass[cls.id] ?? 0} Students</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
