'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Users,
  Search,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { generateStudentDocId, generateParentId, generateClassId } from '@/lib/id-utils';
import type { Student, Class } from '@/lib/types';

interface ParsedStudentRow {
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  className: string;
  classNameClean: string; // trimmed & mapped
  classId: string; // matched class ID, empty if new
  isClassNew: boolean;
  usn: string;
  phone: string;
  dob: string;
  gender: string;
  aadharNumber: string;
  homeAddress: string;
  caste: string;
  subCaste: string;
  religion: string;
  bloodGroup: string;
  parentName: string;
  parentPhone: string;
  parentRelationship: string;
  
  // validation states
  isValid: boolean;
  errors: string[];
  warnings: string[];
  alreadyExists: boolean;
  usnExists: boolean;
}

export default function ImportStudentsPage() {
  const principal = useCurrentPrincipal();
  const { selectedAcademicYear } = useAcademicYear();
  const { getPath } = useDashboardPath();
  const { toast } = useToast();
  const router = useRouter();

  // Firestore DB trackers
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Execution State
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // 1. Fetch existing classes and students for validation
  useEffect(() => {
    if (!principal?.collegeId) return;

    setLoadingDb(true);
    const unsubClasses = onSnapshot(
      query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setClasses(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Class)));
      }
    );

    const unsubStudents = onSnapshot(
      query(collection(db, 'students'), where('collegeId', '==', principal.collegeId)),
      (snap) => {
        setExistingStudents(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Student)));
        setLoadingDb(false);
      },
      (err) => {
        console.error(err);
        setLoadingDb(false);
      }
    );

    return () => {
      unsubClasses();
      unsubStudents();
    };
  }, [principal?.collegeId]);

  // Set of existing emails & USNs to check duplicates
  const existingEmails = useMemo(() => {
    return new Set(existingStudents.map((s) => (s.email ?? '').trim().toLowerCase()));
  }, [existingStudents]);

  const existingUsns = useMemo(() => {
    return new Set(existingStudents.map((s) => (s.usn ?? '').trim().toUpperCase()));
  }, [existingStudents]);

  // Download template generator
  const handleDownloadTemplate = () => {
    const headers = [
      'Email',
      'First Name',
      'Last Name',
      'Class',
      'Roll No / USN',
      'Phone',
      'Date of Birth',
      'Gender',
      'Aadhar Number',
      'Home Address',
      'Parent Name',
      'Parent Phone',
      'Parent Relationship'
    ];

    const sampleData = [
      {
        'Email': 'student.one@example.com',
        'First Name': 'John',
        'Last Name': 'Doe',
        'Class': 'BCA 1st Sem - Section A',
        'Roll No / USN': 'USN001',
        'Phone': '9876543210',
        'Date of Birth': '2005-08-15',
        'Gender': 'Male',
        'Aadhar Number': '123456789012',
        'Home Address': '123, MG Road, Bangalore',
        'Parent Name': 'Robert Doe',
        'Parent Phone': '9876543211',
        'Parent Relationship': 'Father'
      },
      {
        'Email': 'student.two@example.com',
        'First Name': 'Jane',
        'Last Name': 'Smith',
        'Class': 'BCA 1st Sem - Section B',
        'Roll No / USN': 'USN002',
        'Phone': '9876543212',
        'Date of Birth': '2005-09-20',
        'Gender': 'Female',
        'Aadhar Number': '987654321098',
        'Home Address': '456, Residency Road, Bangalore',
        'Parent Name': 'Mary Smith',
        'Parent Phone': '9876543213',
        'Parent Relationship': 'Mother'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students Template');
    XLSX.writeFile(wb, 'student_import_template.xlsx');
    toast({
      title: 'Template downloaded',
      description: 'Fill in your student records and upload this file.'
    });
  };

  // Helper to extract fields based on common header names
  const getHeaderValue = (row: any, aliases: string[]): string => {
    for (const alias of aliases) {
      const key = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === alias.toLowerCase()
      );
      if (key && row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    return '';
  };

  // Parse Date of Birth (supporting both ISO strings and Excel Serial Dates)
  const parseDobValue = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    // Handle excel date serial or string
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    return str;
  };

  // File Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawRows.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Empty sheet',
            description: 'No data rows found in the uploaded file.'
          });
          setParsedRows([]);
          return;
        }

        const processed: ParsedStudentRow[] = [];
        const fileEmails = new Set<string>(); // catch duplicate emails inside the file itself

        rawRows.forEach((row, idx) => {
          const email = getHeaderValue(row, ['email', 'email address', 'email id', 'student email']).toLowerCase();
          
          let firstName = getHeaderValue(row, ['first name', 'firstname', 'given name']);
          let lastName = getHeaderValue(row, ['last name', 'lastname', 'surname']);
          let fullName = getHeaderValue(row, ['full name', 'name', 'fullname', 'student name']);

          if (!firstName && fullName) {
            const parts = fullName.split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ');
          }

          if (!fullName && firstName) {
            fullName = `${firstName} ${lastName}`.trim();
          }

          const className = getHeaderValue(row, ['class', 'classname', 'grade', 'class name']);
          const usn = getHeaderValue(row, ['roll no', 'roll number', 'rollno', 'usn', 'student id', 'studentId', 'id']).toUpperCase();
          const phone = getHeaderValue(row, ['phone', 'phone number', 'contact', 'mobile', 'student phone', 'phoneNo']);
          const dob = parseDobValue(row['Date of Birth'] || row['dob'] || row['DOB'] || row['dateOfBirth'] || row['birthdate']);
          const gender = getHeaderValue(row, ['gender', 'sex']);
          const aadharNumber = getHeaderValue(row, ['aadhar number', 'aadhar', 'aadhar no', 'aadharNumber', 'adhaar']).replace(/[^\d]/g, '');
          const homeAddress = getHeaderValue(row, ['home address', 'address', 'homeAddress']);
          
          const caste = getHeaderValue(row, ['caste']);
          const subCaste = getHeaderValue(row, ['sub caste', 'sub-caste', 'subcaste']);
          const religion = getHeaderValue(row, ['religion']);
          const bloodGroup = getHeaderValue(row, ['blood group', 'bloodgroup', 'blood']);

          const parentName = getHeaderValue(row, ['parent name', 'father name', 'mother name', 'guardian name', 'parentName']);
          const parentPhone = getHeaderValue(row, ['parent phone', 'parent contact', 'parentMobile', 'parentPhone']);
          const parentRelationship = getHeaderValue(row, ['parent relationship', 'relationship', 'parentRelationship']) || 'Father';

          // Match Class
          const classNameClean = className.trim();
          const matchedClass = classes.find(
            (c) => c.name.trim().toLowerCase() === classNameClean.toLowerCase()
          );

          const errors: string[] = [];
          const warnings: string[] = [];

          if (!email) {
            errors.push('Missing Email Address');
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Invalid Email Format');
          }

          if (!firstName) {
            errors.push('Missing Name/First Name');
          }

          if (!classNameClean) {
            errors.push('Missing Class Name');
          }

          // Duplicate checks
          if (email) {
            if (fileEmails.has(email)) {
              errors.push(`Duplicate email "${email}" in file`);
            } else {
              fileEmails.add(email);
            }
          }

          const alreadyExists = email ? existingEmails.has(email) : false;
          const usnExists = usn ? existingUsns.has(usn) : false;

          if (alreadyExists) {
            warnings.push('Email already registered (will skip/overwrite depending on system rules)');
          }
          if (usnExists) {
            warnings.push(`USN/Roll No "${usn}" already registered to another student`);
          }

          processed.push({
            email,
            firstName,
            lastName,
            name: fullName,
            className,
            classNameClean,
            classId: matchedClass ? matchedClass.id : '',
            isClassNew: classNameClean ? !matchedClass : false,
            usn,
            phone,
            dob,
            gender,
            aadharNumber,
            homeAddress,
            caste,
            subCaste,
            religion,
            bloodGroup,
            parentName,
            parentPhone,
            parentRelationship,
            isValid: errors.length === 0,
            errors,
            warnings,
            alreadyExists,
            usnExists
          });
        });

        setParsedRows(processed);
        setCurrentPage(1);
        toast({
          title: 'File Parsed',
          description: `Loaded ${processed.length} rows. Please review errors and warnings before importing.`
        });
      } catch (err) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Parsing Error',
          description: 'Failed to read Excel file. Please use the provided template.'
        });
      }
    };
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawRows.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Empty sheet',
            description: 'No data rows found in the uploaded file.'
          });
          setParsedRows([]);
          return;
        }

        const processed: ParsedStudentRow[] = [];
        const fileEmails = new Set<string>(); // catch duplicate emails inside the file itself

        rawRows.forEach((row, idx) => {
          const email = getHeaderValue(row, ['email', 'email address', 'email id', 'student email']).toLowerCase();
          
          let firstName = getHeaderValue(row, ['first name', 'firstname', 'given name']);
          let lastName = getHeaderValue(row, ['last name', 'lastname', 'surname']);
          let fullName = getHeaderValue(row, ['full name', 'name', 'fullname', 'student name']);

          if (!firstName && fullName) {
            const parts = fullName.split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ');
          }

          if (!fullName && firstName) {
            fullName = `${firstName} ${lastName}`.trim();
          }

          const className = getHeaderValue(row, ['class', 'classname', 'grade', 'class name']);
          const usn = getHeaderValue(row, ['roll no', 'roll number', 'rollno', 'usn', 'student id', 'studentId', 'id']).toUpperCase();
          const phone = getHeaderValue(row, ['phone', 'phone number', 'contact', 'mobile', 'student phone', 'phoneNo']);
          const dob = parseDobValue(row['Date of Birth'] || row['dob'] || row['DOB'] || row['dateOfBirth'] || row['birthdate']);
          const gender = getHeaderValue(row, ['gender', 'sex']);
          const aadharNumber = getHeaderValue(row, ['aadhar number', 'aadhar', 'aadhar no', 'aadharNumber', 'adhaar']).replace(/[^\d]/g, '');
          const homeAddress = getHeaderValue(row, ['home address', 'address', 'homeAddress']);
          
          const caste = getHeaderValue(row, ['caste']);
          const subCaste = getHeaderValue(row, ['sub caste', 'sub-caste', 'subcaste']);
          const religion = getHeaderValue(row, ['religion']);
          const bloodGroup = getHeaderValue(row, ['blood group', 'bloodgroup', 'blood']);

          const parentName = getHeaderValue(row, ['parent name', 'father name', 'mother name', 'guardian name', 'parentName']);
          const parentPhone = getHeaderValue(row, ['parent phone', 'parent contact', 'parentMobile', 'parentPhone']);
          const parentRelationship = getHeaderValue(row, ['parent relationship', 'relationship', 'parentRelationship']) || 'Father';

          // Match Class
          const classNameClean = className.trim();
          const matchedClass = classes.find(
            (c) => c.name.trim().toLowerCase() === classNameClean.toLowerCase()
          );

          const errors: string[] = [];
          const warnings: string[] = [];

          if (!email) {
            errors.push('Missing Email Address');
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Invalid Email Format');
          }

          if (!firstName) {
            errors.push('Missing Name/First Name');
          }

          if (!classNameClean) {
            errors.push('Missing Class Name');
          }

          // Duplicate checks
          if (email) {
            if (fileEmails.has(email)) {
              errors.push(`Duplicate email "${email}" in file`);
            } else {
              fileEmails.add(email);
            }
          }

          const alreadyExists = email ? existingEmails.has(email) : false;
          const usnExists = usn ? existingUsns.has(usn) : false;

          if (alreadyExists) {
            warnings.push('Email already registered (will skip/overwrite depending on system rules)');
          }
          if (usnExists) {
            warnings.push(`USN/Roll No "${usn}" already registered to another student`);
          }

          processed.push({
            email,
            firstName,
            lastName,
            name: fullName,
            className,
            classNameClean,
            classId: matchedClass ? matchedClass.id : '',
            isClassNew: classNameClean ? !matchedClass : false,
            usn,
            phone,
            dob,
            gender,
            aadharNumber,
            homeAddress,
            caste,
            subCaste,
            religion,
            bloodGroup,
            parentName,
            parentPhone,
            parentRelationship,
            isValid: errors.length === 0,
            errors,
            warnings,
            alreadyExists,
            usnExists
          });
        });

        setParsedRows(processed);
        setCurrentPage(1);
        toast({
          title: 'File Parsed',
          description: `Loaded ${processed.length} rows. Please review errors and warnings before importing.`
        });
      } catch (err) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Parsing Error',
          description: 'Failed to read Excel file. Please use the provided template.'
        });
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Stats derivation
  const stats = useMemo(() => {
    let total = parsedRows.length;
    let valid = parsedRows.filter((r) => r.isValid && !r.alreadyExists).length;
    let invalid = parsedRows.filter((r) => !r.isValid).length;
    let existing = parsedRows.filter((r) => r.alreadyExists).length;

    const uniqueNewClasses = new Set<string>();
    parsedRows.forEach((r) => {
      if (r.isClassNew) uniqueNewClasses.add(r.classNameClean);
    });

    return { total, valid, invalid, existing, newClassesCount: uniqueNewClasses.size, newClassesNames: Array.from(uniqueNewClasses) };
  }, [parsedRows]);

  // Filter and pagination
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return parsedRows;
    const lower = searchTerm.toLowerCase();
    return parsedRows.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.email.toLowerCase().includes(lower) ||
        r.className.toLowerCase().includes(lower) ||
        r.usn.toLowerCase().includes(lower)
    );
  }, [parsedRows, searchTerm]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);

  // Executing the student import
  const handleImport = async () => {
    if (!principal?.collegeId) return;
    if (parsedRows.length === 0) return;

    const validRows = parsedRows.filter((r) => r.isValid && !r.alreadyExists);
    if (validRows.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No records to import',
        description: 'Ensure there are valid, non-existing rows in your sheet.'
      });
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: validRows.length });

    try {
      // 1. Create Class Documents for new classes
      const createdClassIdsMap: Record<string, string> = {};
      const classBatch = writeBatch(db);
      let classBatchCount = 0;

      stats.newClassesNames.forEach((className) => {
        const id = generateClassId(className);
        createdClassIdsMap[className.toLowerCase()] = id;
        classBatch.set(doc(db, 'classes', id), {
          id,
          name: className,
          collegeId: principal.collegeId,
          subjectIds: []
        });
        classBatchCount++;
      });

      if (classBatchCount > 0) {
        await classBatch.commit();
        toast({
          title: 'Classes Created',
          description: `Successfully added ${classBatchCount} new classes to the database.`
        });
      }

      // 2. Import Students & Parents in chunks of 200 rows (200 students + 200 parents = 400 writes, fits Firestore 500 limit)
      const chunkSize = 200;
      let importedCount = 0;

      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((row) => {
          // Resolve classId
          const classId = row.classId || createdClassIdsMap[row.classNameClean.toLowerCase()];
          const studentId = row.usn || `S${String(Date.now() + Math.floor(Math.random() * 1000)).slice(-6).padStart(6, '0')}`;
          const docId = generateStudentDocId(studentId);

          // Write Student Document
          batch.set(doc(db, 'students', docId), {
            studentId,
            name: row.name,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone || row.parentPhone,
            classId,
            collegeId: principal.collegeId,
            academicYear: selectedAcademicYear,
            caste: row.caste,
            subCaste: row.subCaste,
            religion: row.religion,
            gender: row.gender || 'Other',
            bloodGroup: row.bloodGroup,
            dateOfBirth: row.dob,
            admissionNumber: studentId,
            homeAddress: row.homeAddress,
            aadharNumber: row.aadharNumber,
            fees: {
              status: 'Not Paid',
              balance: 0,
              totalFees: 0,
              paid: 0,
              breakdown: {
                collegeFees: 0,
                libraryFees: 0,
                hostelFees: 0,
                examFees: 0,
                transportFees: 0,
                otherFees: 0
              }
            },
            attendance: {
              summary: { present: 0, absent: 0, totalDays: 0 },
              bySubject: []
            },
            assessments: []
          });

          // Write Parent Document
          if (row.parentPhone) {
            const pName = row.parentName || `Parent of ${row.name}`;
            const parentId = generateParentId(docId, pName);
            batch.set(doc(db, 'parents', parentId), {
              studentId: docId,
              name: pName,
              relationship: row.parentRelationship,
              phone: row.parentPhone,
              collegeId: principal.collegeId
            });
          }
        });

        await batch.commit();
        importedCount += chunk.length;
        setImportProgress({ current: importedCount, total: validRows.length });
      }

      toast({
        title: 'Students Imported',
        description: `Successfully saved ${importedCount} student records. Creating login credentials now...`
      });

      // 3. Trigger bulk student login creation in the background
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/create-student-logins', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          });
          const authData = await res.json().catch(() => ({}));
          if (res.ok) {
            toast({
              title: 'Logins Configured',
              description: authData.message ?? 'Student user logins generated successfully.'
            });
          } else {
            console.error('Failed to create logins:', authData.error);
            toast({
              variant: 'destructive',
              title: 'Login Warning',
              description: 'Student profiles imported successfully, but login account creation failed. You can run "Create student login" manually in the students list.'
            });
          }
        } catch (authErr) {
          console.error(authErr);
        }
      }

      // Reset state and redirect
      setFile(null);
      setParsedRows([]);
      router.push(getPath('/students'));
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'An error occurred during database import.'
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* Header section */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={getPath('/students')}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">Import Students</h1>
          <p className="text-muted-foreground text-sm">
            Bulk upload and organize your student records using Excel spreadsheets or CSVs.
          </p>
        </div>
      </div>

      {loadingDb ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
          <span className="text-muted-foreground">Loading college configuration...</span>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* File input cards */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" /> Step 1: Template
                </CardTitle>
                <CardDescription>
                  Download the formatted template to ensure your spreadsheet columns match the system format correctly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleDownloadTemplate} className="w-full" variant="outline">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Download Template (.xlsx)
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" /> Step 2: Upload File
                </CardTitle>
                <CardDescription>
                  Select your completed spreadsheet (`.xlsx`, `.xls`, or `.csv`) to validate and import.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-muted rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground/60 mb-2" />
                  <span className="text-sm font-medium text-foreground">
                    {file ? file.name : 'Choose a spreadsheet file'}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Drag and drop or click to browse
                  </span>
                  <Input
                    ref={fileInputRef}
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Verification section */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {parsedRows.length > 0 ? (
              <>
                {/* Stats Panel */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-semibold text-primary uppercase">Total Rows</span>
                      <span className="text-2xl font-bold mt-1">{stats.total}</span>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-500/5 border-emerald-500/20">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-semibold text-emerald-600 uppercase">Valid & New</span>
                      <span className="text-2xl font-bold text-emerald-600 mt-1">{stats.valid}</span>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-semibold text-amber-600 uppercase">Existing (Skip)</span>
                      <span className="text-2xl font-bold text-amber-600 mt-1">{stats.existing}</span>
                    </CardContent>
                  </Card>
                  <Card className="bg-rose-500/5 border-rose-500/20">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-semibold text-rose-600 uppercase">Invalid (Errors)</span>
                      <span className="text-2xl font-bold text-rose-600 mt-1">{stats.invalid}</span>
                    </CardContent>
                  </Card>
                </div>

                {/* Auto Create Class Alerts */}
                {stats.newClassesCount > 0 && (
                  <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-900">
                          {stats.newClassesCount} classes will be auto-created:
                        </h4>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                          {stats.newClassesNames.join(', ')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Table Preview */}
                <Card className="border border-border">
                  <CardHeader className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">Preview Data</CardTitle>
                      <CardDescription>Verify the values and status of the records before database execution.</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search parsed data..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-9 h-9"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="min-w-full divide-y divide-border text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Email</th>
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Class</th>
                          <th className="px-4 py-3 text-left font-semibold text-muted-foreground">USN / Roll</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-background">
                        {paginatedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.errors.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded" title={row.errors.join('; ')}>
                                  <XCircle className="h-3.5 w-3.5" /> Error
                                </span>
                              ) : row.alreadyExists ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded" title="Student email already exists. Record will not be modified.">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Skip
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{row.name || '-'}</div>
                              {row.phone && <div className="text-xs text-muted-foreground">{row.phone}</div>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{row.email || '-'}</td>
                            <td className="px-4 py-3">
                              <div className="text-foreground">{row.className || '-'}</div>
                              {row.isClassNew && (
                                <span className="inline-block text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium mt-0.5">
                                  New Class
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.usn || '-'}</td>
                          </tr>
                        ))}
                        {filteredRows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-muted-foreground">
                              No rows matched your search filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>

                  {/* Pagination Footer */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages} ({filteredRows.length} items)
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((c) => c - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((c) => c + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Confirm Import Panel */}
                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFile(null);
                      setParsedRows([]);
                    }}
                    disabled={importing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={importing || stats.valid === 0}
                    className="min-w-32"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing {importProgress.current}/{importProgress.total}
                      </>
                    ) : (
                      <>Import {stats.valid} Students</>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <Card className="border border-dashed border-border py-16 text-center bg-card shadow-sm flex flex-col items-center justify-center">
                <FileSpreadsheet className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1">No file uploaded</h3>
                <p className="text-muted-foreground max-w-sm text-sm mx-auto mb-4">
                  Please upload your Excel template using the upload card on the left to start importing students.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
