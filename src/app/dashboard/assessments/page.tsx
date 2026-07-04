'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, NotebookText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Student, Subject } from '@/lib/types';
import { getTeacherSubjectNames } from '@/lib/subject-utils';

export default function AddAssessmentPage() {
  const teacher = useCurrentTeacher();
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [marks, setMarks] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!teacher?.id) return;
    const unsub = onSnapshot(
      collection(db, 'teachers', teacher.id, 'assignedClasses'),
      (snap) => setAssignedClassIds(snap.docs.map((d) => d.id))
    );
    return () => unsub();
  }, [teacher?.id]);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setStudents([]);
      return;
    }
    const q = query(
      collection(db, 'students'),
      where('collegeId', '==', teacher.collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
    });
    return () => unsub();
  }, [teacher?.collegeId]);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setSubjects([]);
      return;
    }
    const q = query(
      collection(db, 'subjects'),
      where('collegeId', '==', teacher.collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
    });
    return () => unsub();
  }, [teacher?.collegeId]);

  const studentsInMyClasses = students.filter((s) =>
    assignedClassIds.includes(s.classId ?? '')
  );
  const subjectNames = teacher ? getTeacherSubjectNames(teacher, subjects) : [];

  const handleAdd = async () => {
    if (!selectedStudentId || !selectedSubject.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a student and a subject.',
      });
      return;
    }
    const marksNum = marks === '' ? 0 : parseInt(marks, 10);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Marks must be between 0 and 100.',
      });
      return;
    }
    setAdding(true);
    try {
      const studentRef = doc(db, 'students', selectedStudentId);
      const snap = await getDoc(studentRef);
      const existing = (snap.data()?.assessments ?? []) as { subject: string; marks: number }[];
      if (existing.some((a) => a.subject === selectedSubject)) {
        toast({
          variant: 'destructive',
          title: 'Already exists',
          description: 'This student already has marks for this subject. Update from the student profile.',
        });
        setAdding(false);
        return;
      }
      await updateDoc(studentRef, {
        assessments: [...existing, { subject: selectedSubject, marks: marksNum }],
      });
      toast({
        title: 'Assessment added',
        description: `${selectedSubject} — ${marksNum} marks for ${students.find((s) => s.id === selectedStudentId)?.name ?? 'student'}.`,
      });
      setSelectedSubject('');
      setMarks('');
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add assessment.',
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Add Internal Assessment
          </h1>
          <p className="text-muted-foreground">
            Add marks for a student by subject. To update existing marks, go to the student profile.
          </p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotebookText className="h-5 w-5 text-primary" />
            Add assessment
          </CardTitle>
          <CardDescription>
            Select a student (from your classes), subject, and enter marks (0–100).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {studentsInMyClasses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.studentId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {subjectNames.length > 0 ? (
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="subject-name">Subject name</Label>
              <Input
                id="subject-name"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                placeholder="e.g. Mathematics"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="marks">Marks (0–100)</Label>
            <Input
              id="marks"
              type="number"
              min={0}
              max={100}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              placeholder="0"
            />
          </div>

          <Button
            onClick={handleAdd}
            disabled={adding || !selectedStudentId || studentsInMyClasses.length === 0}
            className="w-full"
          >
            {adding ? 'Adding…' : 'Add assessment'}
          </Button>

          <p className="text-sm text-muted-foreground">
            To update marks for an existing subject, go to{' '}
            <Link href="/dashboard/students" className="text-primary underline">
              Students
            </Link>
            , open the student profile, and use the Internal Assessment card to edit and save.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
