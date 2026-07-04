'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Teacher, College } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Search, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

export default function SuperAdminTeachersPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
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

        // Fetch teachers
        const teachersSnap = await getDocs(
          query(collection(db, 'teachers'), where('collegeId', '==', collegeId))
        );
        setTeachers(teachersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));

      } catch (error) {
        console.error('Error fetching teachers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collegeId]);

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.usn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportExcel = async () => {
    if (teachers.length === 0) {
      toast({ variant: 'destructive', title: 'Export Failed', description: 'No teacher records to export.' });
      return;
    }
    setExporting(true);
    try {
      // Create headers representing all details we have in CMS
      const headers = [
        'Teacher ID / USN', 'Name', 'Email', 'Phone', 'Roles', 'Specialty', 'Academic Year'
      ];

      const rows = filteredTeachers.map(t => {
        const rolesDisplay = t.roles ? t.roles.join(', ') : (t.role || 'Teacher');
        return [
          t.usn || '',
          t.name || '',
          t.email || '',
          t.phone || '',
          rolesDisplay,
          t.subjectSpecialty || '',
          t.academicYear || ''
        ];
      });

      const excelData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Teachers List');
      
      const fileName = `${college?.name.replace(/\s+/g, '-')}-Teachers-Export.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({ title: 'Export Successful', description: `Exported ${filteredTeachers.length} teachers to ${fileName}` });
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
            <div className="text-sm text-muted-foreground">{college?.name} / Teachers</div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">Teachers Directory</h1>
          </div>
        </div>

        <Button 
          onClick={handleExportExcel} 
          disabled={exporting || filteredTeachers.length === 0}
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
          placeholder="Search by name, email, or ID..."
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
                  <TableHead>Teacher ID / USN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Specialty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-semibold">{t.usn || '—'}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.email}</TableCell>
                      <TableCell>{t.phone || '—'}</TableCell>
                      <TableCell>
                        {t.roles ? t.roles.map(role => (
                          <span key={role} className="inline-block mr-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                            {role}
                          </span>
                        )) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                            {t.role || 'Teacher'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{t.subjectSpecialty || '—'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No teachers found matching your search.
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
