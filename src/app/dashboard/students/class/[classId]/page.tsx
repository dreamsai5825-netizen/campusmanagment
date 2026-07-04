'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student, Class } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';

export default function ClassStudentsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [classData, setClassData] = useState<Class | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Load class data
  useEffect(() => {
    if (!classId) return;
    const unsub = onSnapshot(doc(db, 'classes', classId), (snap) => {
      if (snap.exists()) {
        setClassData({ id: snap.id, ...snap.data() } as Class);
      }
    });
    return () => unsub();
  }, [classId]);

  // Load students in this class
  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    const q = query(
      collection(db, 'students'),
      where('classId', '==', classId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const loadedStudents = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Student))
        .sort((a, b) =>
          (a.usn || a.studentId || '').localeCompare(
            b.usn || b.studentId || '',
            undefined,
            { numeric: true }
          )
        );
      setStudents(loadedStudents);
      setLoading(false);
    });
    return () => unsub();
  }, [classId]);

  // Filter students based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStudents(students);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredStudents(
        students.filter(
          (student) =>
            student.name.toLowerCase().includes(term) ||
            student.email.toLowerCase().includes(term) ||
            (student.phone?.toLowerCase().includes(term) ?? false) ||
            (student.usn?.toLowerCase().includes(term) ?? false) ||
            student.studentId.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, students]);

  const handleStudentClick = (studentId: string) => {
    router.push(`/dashboard/students/class/${classId}/${studentId}`);
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            {classData?.name}
          </h1>
          <p className="text-muted-foreground">
            {classData?.subject && `Subject: ${classData.subject}`}
            {!classData?.subject && 'Manage students in this class'}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm('')}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Students table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading students...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {students.length === 0
            ? 'No students found in this class.'
            : 'No students match your search.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-x-auto">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => {
                const studentImage = PlaceHolderImages.find(
                  (p) => p.id === student.id
                );
                return (
                  <TableRow
                    key={student.id}
                    onClick={() => handleStudentClick(student.id)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {studentImage && (
                          <Image
                            src={studentImage.imageUrl}
                            alt={student.name}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        )}
                        <span>{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{student.usn || student.studentId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.email}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.phone || '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
