'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Student, College, Class, Parent } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Search, Users, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

export default function SuperAdminStudentsPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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

        // Fetch parents
        const parentsSnap = await getDocs(
          query(collection(db, 'parents'), where('collegeId', '==', collegeId))
        );
        setParents(parentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Parent)));

        // Fetch students
        const studentsSnap = await getDocs(
          query(collection(db, 'students'), where('collegeId', '==', collegeId))
        );
        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));

      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collegeId]);

  const classMap = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach(c => map.set(c.id, c.name));
    return map;
  }, [classes]);

  const studentParentsMap = React.useMemo(() => {
    const map = new Map<string, Parent>();
    parents.forEach(p => {
      if (p.studentId) map.set(p.studentId, p);
    });
    return map;
  }, [parents]);

  const filteredStudents = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.usn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportExcel = async () => {
    if (students.length === 0) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'No student records to export.' });
      return;
    }
    setExporting(true);
    try {
      // Create headers representing all details we have in CMS
      const headers = [
        'Student ID', 'Name', 'USN', 'Email', 'Phone', 'Class', 'Status',
        'Academic Year', 'Gender', 'Date of Birth', 'Aadhar Number', 
        'Blood Group', 'Religion', 'Caste', 'Sub-Caste', 'Admission Date', 
        'Admission Number', 'Emergency Contact', 'Home Address',
        'Parent Name', 'Parent Relationship', 'Parent Phone'
      ];

      const rows = filteredStudents.map(s => {
        const classLabel = classMap.get(s.classId) || 'Unknown';
        const parent = studentParentsMap.get(s.id);

        return [
          s.studentId || '',
          s.name || '',
          s.usn || '',
          s.email || '',
          s.phone || '',
          classLabel,
          s.status || 'Active',
          s.academicYear || '',
          s.gender || '',
          s.dateOfBirth || '',
          s.aadharNumber || '',
          s.bloodGroup || '',
          s.religion || '',
          s.caste || '',
          s.subCaste || '',
          s.admissionDate || '',
          s.admissionNumber || '',
          s.emergencyNumber || '',
          s.homeAddress || '',
          parent?.name || '',
          parent?.relationship || '',
          parent?.phone || ''
        ];
      });

      const excelData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Students List');
      
      const fileName = `${college?.name.replace(/\s+/g, '-')}-Students-Export.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({ title: 'Export Successful', description: `Exported ${filteredStudents.length} students to ${fileName}` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'An error occurred while exporting.' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-sm text-muted-foreground">{college?.name} / Students</div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">Students Directory</h1>
          </div>
        </div>

        <Button 
          onClick={handleExportExcel} 
          disabled={exporting || filteredStudents.length === 0}
          className="sm:w-auto w-full gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-md w-full bg-card rounded-lg border px-3 py-1">
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <Input
          type="text"
          placeholder="Search by name, email, or USN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-1"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>USN</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold">{s.studentId || '—'}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="font-mono">{s.usn || '—'}</TableCell>
                      <TableCell>{classMap.get(s.classId) || 'Loading...'}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>{s.phone || '—'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          s.status === 'Active' || !s.status 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {s.status || 'Active'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No students found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
