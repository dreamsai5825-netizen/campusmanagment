'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Trash2, Edit, Printer, ChevronUp, ChevronDown, Ban } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { collection, onSnapshot, query, where, deleteDoc, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import type { Student, Class, Parent } from '@/lib/types';
import { useAcademicYear } from '@/contexts/academic-year-context';
import { useDashboardPath } from '@/hooks/use-dashboard-path';
import { filterByAcademicYear } from '@/lib/academic-year-filter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ToastAction } from '@/components/ui/toast';

export default function ClassStudentsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;
  const principal = useCurrentPrincipal();
  const { selectedAcademicYear } = useAcademicYear();
  const { getPath } = useDashboardPath();

  const [studentClass, setStudentClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const studentsForYear = useMemo(
    () => filterByAcademicYear(students, selectedAcademicYear),
    [students, selectedAcademicYear]
  );

  const { toast } = useToast();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [collegeName, setCollegeName] = useState<string>('CMS Portal');

  // Fetch all classes in the college for Promote/Demote matching
  useEffect(() => {
    if (!principal?.collegeId) return;
    const q = query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });
    return () => unsubscribe();
  }, [principal?.collegeId]);

  // Fetch college name
  useEffect(() => {
    if (!principal?.collegeId) return;
    const loadCollege = async () => {
      try {
        const collegeDoc = await getDoc(doc(db, 'colleges', principal.collegeId));
        if (collegeDoc.exists()) {
          setCollegeName(collegeDoc.data().name);
        }
      } catch (err) {
        console.error("Error loading college info:", err);
      }
    };
    loadCollege();
  }, [principal?.collegeId]);

  const getNextClassName = (currentClass: string): string | null => {
    const classOrder = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    const currentIndex = classOrder.findIndex(cls => currentClass.includes(cls));
    if (currentIndex >= 0 && currentIndex < classOrder.length - 1) {
      return currentClass.replace(classOrder[currentIndex], classOrder[currentIndex + 1]);
    }
    const numberMatch = currentClass.match(/\d+/);
    if (numberMatch) {
      const currentNum = parseInt(numberMatch[0], 10);
      if (currentNum >= 1 && currentNum < 12) {
        return currentClass.replace(numberMatch[0], (currentNum + 1).toString());
      }
    }
    return null;
  };

  const getPrevClassName = (currentClass: string): string | null => {
    const classOrder = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    const currentIndex = classOrder.findIndex(cls => currentClass.includes(cls));
    if (currentIndex > 0) {
      return currentClass.replace(classOrder[currentIndex], classOrder[currentIndex - 1]);
    }
    const numberMatch = currentClass.match(/\d+/);
    if (numberMatch) {
      const currentNum = parseInt(numberMatch[0], 10);
      if (currentNum > 1 && currentNum <= 12) {
        return currentClass.replace(numberMatch[0], (currentNum - 1).toString());
      }
    }
    return null;
  };

  type HistoryAction = {
    type: 'promote' | 'demote' | 'debar' | 'activate' | 'bulk-promote' | 'bulk-demote' | 'bulk-debar' | 'bulk-activate';
    studentIds: string[];
    previousClassIds?: { [studentId: string]: string };
    previousStatuses?: { [studentId: string]: string };
  };

  const handleUndo = async (action: HistoryAction) => {
    try {
      if (action.type === 'promote' || action.type === 'demote' || action.type === 'bulk-promote' || action.type === 'bulk-demote') {
        if (!action.previousClassIds) return;
        for (const studentId of action.studentIds) {
          const originalClassId = action.previousClassIds[studentId];
          if (originalClassId) {
            await updateDoc(doc(db, 'students', studentId), { classId: originalClassId });
          }
        }
        toast({ title: 'Undo Successful', description: 'Reverted class promotion/demotion.' });
      } else if (action.type === 'debar' || action.type === 'activate' || action.type === 'bulk-debar' || action.type === 'bulk-activate') {
        if (!action.previousStatuses) return;
        for (const studentId of action.studentIds) {
          const originalStatus = action.previousStatuses[studentId] || 'Active';
          await updateDoc(doc(db, 'students', studentId), { status: originalStatus });
        }
        toast({ title: 'Undo Successful', description: 'Reverted student status change.' });
      }
    } catch (err) {
      console.error("Undo error:", err);
      toast({ variant: 'destructive', title: 'Undo Failed', description: 'Failed to revert changes.' });
    }
  };

  const handlePromoteStudent = async (student: Student) => {
    try {
      const currentClassDoc = allClasses.find(c => c.id === student.classId);
      if (!currentClassDoc) {
        toast({ variant: 'destructive', title: 'Error', description: 'Current class not found.' });
        return;
      }
      const nextClassName = getNextClassName(currentClassDoc.name);
      if (!nextClassName) {
        toast({ variant: 'destructive', title: 'Cannot Promote', description: 'Student is already in the highest class.' });
        return;
      }
      const targetClass = allClasses.find(c => c.name.toLowerCase() === nextClassName.toLowerCase());
      if (!targetClass) {
        toast({
          variant: 'destructive',
          title: 'Cannot Promote',
          description: `Class "${nextClassName}" does not exist. Please create it first under Manage Classes.`
        });
        return;
      }
      await updateDoc(doc(db, 'students', student.id), { classId: targetClass.id });
      const historyAction: HistoryAction = {
        type: 'promote',
        studentIds: [student.id],
        previousClassIds: { [student.id]: student.classId }
      };
      toast({
        title: 'Student Promoted',
        description: `${student.name} promoted to ${targetClass.name}.`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndo(historyAction)}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to promote student.' });
    }
  };

  const handleDemoteStudent = async (student: Student) => {
    try {
      const currentClassDoc = allClasses.find(c => c.id === student.classId);
      if (!currentClassDoc) {
        toast({ variant: 'destructive', title: 'Error', description: 'Current class not found.' });
        return;
      }
      const prevClassName = getPrevClassName(currentClassDoc.name);
      if (!prevClassName) {
        toast({ variant: 'destructive', title: 'Cannot Demote', description: 'Student is already in the lowest class.' });
        return;
      }
      const targetClass = allClasses.find(c => c.name.toLowerCase() === prevClassName.toLowerCase());
      if (!targetClass) {
        toast({
          variant: 'destructive',
          title: 'Cannot Demote',
          description: `Class "${prevClassName}" does not exist. Please create it first under Manage Classes.`
        });
        return;
      }
      await updateDoc(doc(db, 'students', student.id), { classId: targetClass.id });
      const historyAction: HistoryAction = {
        type: 'demote',
        studentIds: [student.id],
        previousClassIds: { [student.id]: student.classId }
      };
      toast({
        title: 'Student Demoted',
        description: `${student.name} demoted to ${targetClass.name}.`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndo(historyAction)}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to demote student.' });
    }
  };

  const handleDebarStudent = async (student: Student) => {
    try {
      const isCurrentlyDebarred = student.status === 'Debarred';
      const newStatus = isCurrentlyDebarred ? 'Active' : 'Debarred';
      await updateDoc(doc(db, 'students', student.id), { status: newStatus });
      const historyAction: HistoryAction = {
        type: isCurrentlyDebarred ? 'activate' : 'debar',
        studentIds: [student.id],
        previousStatuses: { [student.id]: student.status || 'Active' }
      };
      toast({
        title: isCurrentlyDebarred ? 'Student Activated' : 'Student Debarred',
        description: `${student.name} is now ${newStatus.toLowerCase()}.`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndo(historyAction)}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update student status.' });
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`Are you sure you want to delete ${student.name}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'students', student.id));
      const parentsQuery = query(collection(db, 'parents'), where('studentId', '==', student.id));
      const parentsSnapshot = await getDocs(parentsQuery);
      for (const parentDoc of parentsSnapshot.docs) {
        await deleteDoc(doc(db, 'parents', parentDoc.id));
      }
      toast({ title: 'Student Deleted', description: `${student.name} has been successfully deleted.` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete student.' });
    }
  };

  const handleEditStudent = (studentId: string) => {
    router.push(getPath(`/students/${studentId}?edit=true`));
  };

  const handlePrintStudent = async (student: Student) => {
    try {
      const parentsQuery = query(collection(db, 'parents'), where('studentId', '==', student.id));
      const parentsSnapshot = await getDocs(parentsQuery);
      const studentParent = !parentsSnapshot.empty 
        ? (parentsSnapshot.docs[0].data() as Parent) 
        : null;

      const currentClassDoc = allClasses.find(c => c.id === student.classId);
      const className = currentClassDoc?.name || 'N/A';

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({ variant: 'destructive', title: 'Print Failed', description: 'Pop-up blocked. Please enable pop-ups.' });
        return;
      }

      const paid = student.fees?.paid ?? 0;
      const totalFees = student.fees?.totalFees ?? 0;
      const balance = student.fees?.balance ?? Math.max(0, totalFees - paid);
      const feeStatus = student.fees?.status || (totalFees ? (paid >= totalFees ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Not Paid') : 'Not Paid');

      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Student Profile - ${student.name}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
            .college-name { font-size: 24px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; margin: 0 0 5px 0; }
            .title { font-size: 18px; color: #4b5563; font-weight: 600; margin: 0; }
            .profile-section { display: grid; grid-template-columns: 1fr 3fr; gap: 30px; margin-bottom: 30px; }
            .photo-container { border: 1px solid #d1d5db; border-radius: 8px; width: 150px; height: 180px; overflow: hidden; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; }
            .photo-container img { width: 100%; height: 100%; object-fit: cover; }
            .no-photo { font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 500; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 25px; }
            .info-item { border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; }
            .info-label { font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
            .info-value { font-size: 14px; font-weight: 500; color: #111827; }
            .section-title { font-size: 14px; font-weight: bold; color: #1e3a8a; border-bottom: 1px dashed #cbd5e1; padding-bottom: 5px; margin: 30px 0 15px 0; text-transform: uppercase; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
            .sig-line { border-top: 1px solid #4b5563; margin-top: 50px; font-size: 12px; font-weight: 600; color: #4b5563; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="college-name">${collegeName}</h1>
            <h2 class="title">Student Profile Sheet</h2>
          </div>
          
          <div class="profile-section">
            <div>
              <div class="photo-container">
                ${student.photoUrl ? `<img src="${student.photoUrl}" alt="Student Photo" />` : `<span class="no-photo">No Photo</span>`}
              </div>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Student Name</div>
                <div class="info-value">${student.name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">USN / Student ID</div>
                <div class="info-value">${student.usn || student.studentId || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Class</div>
                <div class="info-value">${className}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Academic Year</div>
                <div class="info-value">${student.academicYear || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${student.email || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Phone</div>
                <div class="info-value">${student.phone || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section-title">Personal Information</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Date of Birth</div>
              <div class="info-value">${student.dateOfBirth || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Gender</div>
              <div class="info-value">${student.gender || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Blood Group</div>
              <div class="info-value">${student.bloodGroup || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Aadhar Number</div>
              <div class="info-value">${student.aadharNumber || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Caste</div>
              <div class="info-value">${student.caste || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Sub-caste</div>
              <div class="info-value">${student.subCaste || 'N/A'}</div>
            </div>
            <div class="info-item" style="grid-column: span 2;">
              <div class="info-label">Address</div>
              <div class="info-value">${student.homeAddress || 'N/A'}</div>
            </div>
          </div>

          <div class="section-title">Parent / Guardian Details</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Parent/Guardian Name</div>
              <div class="info-value">${studentParent ? studentParent.name : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Relationship</div>
              <div class="info-value">${studentParent ? studentParent.relationship : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Parent Contact Number</div>
              <div class="info-value">${studentParent ? studentParent.phone : 'N/A'}</div>
            </div>
          </div>

          <div class="section-title">Financial Balance Details</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Total Fee Amount</div>
              <div class="info-value">₹${(student.fees?.totalFees ?? 0).toLocaleString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Amount Paid</div>
              <div class="info-value">₹${(student.fees?.paid ?? 0).toLocaleString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Pending Balance</div>
              <div class="info-value">₹${balance.toLocaleString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Payment Status</div>
              <div class="info-value">${feeStatus}</div>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-line">Student's Signature</div>
            <div class="sig-line">Parent's Signature</div>
            <div class="sig-line">Principal's Signature</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printHTML);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Print Failed', description: 'An error occurred while preparing the print view.' });
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Clear selection when academic year or class changes
  useEffect(() => {
    setSelectedIds([]);
  }, [selectedAcademicYear, classId]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(studentsForYear.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkPromote = async () => {
    if (selectedIds.length === 0) return;
    try {
      const selectedStudents = studentsForYear.filter(s => selectedIds.includes(s.id));
      const currentClassDoc = allClasses.find(c => c.id === classId);
      if (!currentClassDoc) {
        toast({ variant: 'destructive', title: 'Error', description: 'Current class not found.' });
        return;
      }
      const nextClassName = getNextClassName(currentClassDoc.name);
      if (!nextClassName) {
        toast({ variant: 'destructive', title: 'Cannot Promote', description: 'Class is already at the highest level.' });
        return;
      }
      const targetClass = allClasses.find(c => c.name.toLowerCase() === nextClassName.toLowerCase());
      if (!targetClass) {
        toast({
          variant: 'destructive',
          title: 'Cannot Promote',
          description: `Class "${nextClassName}" does not exist. Please create it first under Manage Classes.`
        });
        return;
      }

      const previousClassIds: { [studentId: string]: string } = {};
      selectedStudents.forEach(s => {
        previousClassIds[s.id] = s.classId;
      });

      let count = 0;
      for (const student of selectedStudents) {
        await updateDoc(doc(db, 'students', student.id), { classId: targetClass.id });
        count++;
      }
      
      const historyAction: HistoryAction = {
        type: 'bulk-promote',
        studentIds: selectedStudents.map(s => s.id),
        previousClassIds
      };

      setSelectedIds([]);
      toast({
        title: 'Students Promoted',
        description: `Successfully promoted ${count} student(s) to ${targetClass.name}.`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndo(historyAction)}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to promote some students.' });
    }
  };

  const handleBulkDemote = async () => {
    if (selectedIds.length === 0) return;
    try {
      const selectedStudents = studentsForYear.filter(s => selectedIds.includes(s.id));
      const currentClassDoc = allClasses.find(c => c.id === classId);
      if (!currentClassDoc) {
        toast({ variant: 'destructive', title: 'Error', description: 'Current class not found.' });
        return;
      }
      const prevClassName = getPrevClassName(currentClassDoc.name);
      if (!prevClassName) {
        toast({ variant: 'destructive', title: 'Cannot Demote', description: 'Class is already at the lowest level.' });
        return;
      }
      const targetClass = allClasses.find(c => c.name.toLowerCase() === prevClassName.toLowerCase());
      if (!targetClass) {
        toast({
          variant: 'destructive',
          title: 'Cannot Demote',
          description: `Class "${prevClassName}" does not exist. Please create it first under Manage Classes.`
        });
        return;
      }

      const previousClassIds: { [studentId: string]: string } = {};
      selectedStudents.forEach(s => {
        previousClassIds[s.id] = s.classId;
      });

      let count = 0;
      for (const student of selectedStudents) {
        await updateDoc(doc(db, 'students', student.id), { classId: targetClass.id });
        count++;
      }

      const historyAction: HistoryAction = {
        type: 'bulk-demote',
        studentIds: selectedStudents.map(s => s.id),
        previousClassIds
      };

      setSelectedIds([]);
      toast({
        title: 'Students Demoted',
        description: `Successfully demoted ${count} student(s) to ${targetClass.name}.`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndo(historyAction)}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to demote some students.' });
    }
  };

  const handleBulkDebar = async () => {
    if (selectedIds.length === 0) return;
    try {
      const selectedStudents = studentsForYear.filter(s => selectedIds.includes(s.id));
      const previousStatuses: { [studentId: string]: string } = {};
      selectedStudents.forEach(s => {
        previousStatuses[s.id] = s.status || 'Active';
      });

      let count = 0;
      for (const id of selectedIds) {
        await updateDoc(doc(db, 'students', id), { status: 'Debarred' });
        count++;
      }

      const historyAction: HistoryAction = {
        type: 'bulk-debar',
        studentIds: selectedIds,
        previousStatuses
      };

      setSelectedIds([]);
      toast({
        title: 'Students Debarred',
        description: `Successfully debarred ${count} student(s).`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndo(historyAction)}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to debar students.' });
    }
  };

  const handleBulkActivate = async () => {
    if (selectedIds.length === 0) return;
    try {
      const selectedStudents = studentsForYear.filter(s => selectedIds.includes(s.id));
      const previousStatuses: { [studentId: string]: string } = {};
      selectedStudents.forEach(s => {
        previousStatuses[s.id] = s.status || 'Active';
      });

      let count = 0;
      for (const id of selectedIds) {
        await updateDoc(doc(db, 'students', id), { status: 'Active' });
        count++;
      }

      const historyAction: HistoryAction = {
        type: 'bulk-activate',
        studentIds: selectedIds,
        previousStatuses
      };

      setSelectedIds([]);
      toast({
        title: 'Students Activated',
        description: `Successfully activated ${count} student(s).`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndo(historyAction)}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to activate students.' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected student(s)? This action cannot be undone.`)) {
      return;
    }
    try {
      let count = 0;
      for (const id of selectedIds) {
        await deleteDoc(doc(db, 'students', id));
        const parentsQuery = query(collection(db, 'parents'), where('studentId', '==', id));
        const parentsSnapshot = await getDocs(parentsQuery);
        for (const parentDoc of parentsSnapshot.docs) {
          await deleteDoc(doc(db, 'parents', parentDoc.id));
        }
        count++;
      }
      setSelectedIds([]);
      toast({ title: 'Students Deleted', description: `Successfully deleted ${count} student(s).` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete some students.' });
    }
  };

  const handleBulkPrint = async () => {
    if (selectedIds.length === 0) return;
    try {
      const selectedStudents = studentsForYear.filter(s => selectedIds.includes(s.id));
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({ variant: 'destructive', title: 'Print Failed', description: 'Pop-up blocked. Please enable pop-ups.' });
        return;
      }

      let printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bulk Student Profiles</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.5; }
            .page-break { page-break-after: always; }
            .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
            .college-name { font-size: 24px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; margin: 0 0 5px 0; }
            .title { font-size: 18px; color: #4b5563; font-weight: 600; margin: 0; }
            .profile-section { display: grid; grid-template-columns: 1fr 3fr; gap: 30px; margin-bottom: 30px; }
            .photo-container { border: 1px solid #d1d5db; border-radius: 8px; width: 150px; height: 180px; overflow: hidden; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; }
            .photo-container img { width: 100%; height: 100%; object-fit: cover; }
            .no-photo { font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 500; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 25px; }
            .info-item { border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; }
            .info-label { font-size: 11px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
            .info-value { font-size: 14px; font-weight: 500; color: #111827; }
            .section-title { font-size: 14px; font-weight: bold; color: #1e3a8a; border-bottom: 1px dashed #cbd5e1; padding-bottom: 5px; margin: 30px 0 15px 0; text-transform: uppercase; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
            .sig-line { border-top: 1px solid #4b5563; margin-top: 50px; font-size: 12px; font-weight: 600; color: #4b5563; padding-top: 5px; }
          </style>
        </head>
        <body>
      `;

      const currentClassDoc = allClasses.find(c => c.id === classId);
      const className = currentClassDoc?.name || 'N/A';

      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        
        // Fetch parent details
        const parentsQuery = query(collection(db, 'parents'), where('studentId', '==', student.id));
        const parentsSnapshot = await getDocs(parentsQuery);
        const studentParent = !parentsSnapshot.empty 
          ? (parentsSnapshot.docs[0].data() as Parent) 
          : null;

        const paid = student.fees?.paid ?? 0;
        const totalFees = student.fees?.totalFees ?? 0;
        const balance = student.fees?.balance ?? Math.max(0, totalFees - paid);
        const feeStatus = student.fees?.status || (totalFees ? (paid >= totalFees ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Not Paid') : 'Not Paid');

        printHTML += `
          <div class="profile-page-container ${i < selectedStudents.length - 1 ? 'page-break' : ''}">
            <div class="header">
              <h1 class="college-name">${collegeName}</h1>
              <h2 class="title">Student Profile Sheet</h2>
            </div>
            
            <div class="profile-section">
              <div>
                <div class="photo-container">
                  ${student.photoUrl ? `<img src="${student.photoUrl}" alt="Student Photo" />` : `<span class="no-photo">No Photo</span>`}
                </div>
              </div>
              
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Student Name</div>
                  <div class="info-value">${student.name}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">USN / Student ID</div>
                  <div class="info-value">${student.usn || student.studentId || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Class</div>
                  <div class="info-value">${className}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Academic Year</div>
                  <div class="info-value">${student.academicYear || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Email</div>
                  <div class="info-value">${student.email || 'N/A'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Phone</div>
                  <div class="info-value">${student.phone || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div class="section-title">Personal Information</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Date of Birth</div>
                <div class="info-value">${student.dateOfBirth || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Gender</div>
                <div class="info-value">${student.gender || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Blood Group</div>
                <div class="info-value">${student.bloodGroup || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Aadhar Number</div>
                <div class="info-value">${student.aadharNumber || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Caste</div>
                <div class="info-value">${student.caste || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Sub-caste</div>
                <div class="info-value">${student.subCaste || 'N/A'}</div>
              </div>
              <div class="info-item" style="grid-column: span 2;">
                <div class="info-label">Address</div>
                <div class="info-value">${student.homeAddress || 'N/A'}</div>
              </div>
            </div>

            <div class="section-title">Parent / Guardian Details</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Parent/Guardian Name</div>
                <div class="info-value">${studentParent ? studentParent.name : 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Relationship</div>
                <div class="info-value">${studentParent ? studentParent.relationship : 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Parent Contact Number</div>
                <div class="info-value">${studentParent ? studentParent.phone : 'N/A'}</div>
              </div>
            </div>

            <div class="section-title">Financial Balance Details</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Total Fee Amount</div>
                <div class="info-value">₹${totalFees.toLocaleString()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Amount Paid</div>
                <div class="info-value">₹${paid.toLocaleString()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Pending Balance</div>
                <div class="info-value">₹${balance.toLocaleString()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Payment Status</div>
                <div class="info-value">${feeStatus}</div>
              </div>
            </div>

            <div class="signatures">
              <div class="sig-line">Student's Signature</div>
              <div class="sig-line">Parent's Signature</div>
              <div class="sig-line">Principal's Signature</div>
            </div>
          </div>
        `;
      }

      printHTML += `
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printHTML);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Print Failed', description: 'An error occurred while preparing the print view.' });
    }
  };

  useEffect(() => {
    if (!classId) return;

    // Load the class
    const classUnsubscribe = onSnapshot(
      query(collection(db, 'classes'), where('id', '==', classId)),
      (snapshot) => {
        if (!snapshot.empty) {
          setStudentClass({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Class);
        }
      }
    );

    return () => classUnsubscribe();
  }, [classId]);

  useEffect(() => {
    if (!classId) return;

    // Load students in this class
    const studentsUnsubscribe = onSnapshot(
      query(collection(db, 'students'), where('classId', '==', classId)),
      (snapshot) => {
        const studentsData = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as Student))
          .sort((a, b) =>
            (a.usn || a.studentId || '').localeCompare(
              b.usn || b.studentId || '',
              undefined,
              { numeric: true }
            )
          );
        setStudents(studentsData);
      }
    );

    return () => studentsUnsubscribe();
  }, [classId]);

  const handleStudentClick = (studentId: string) => {
    router.push(getPath(`/students/${studentId}`));
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
                {studentClass?.name ?? 'Loading...'}
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              {studentsForYear.length}{' '}
              {studentsForYear.length === 1 ? 'student' : 'students'} ({selectedAcademicYear})
            </p>
          </div>
        </div>
      </div>

      {studentsForYear.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all"
              checked={selectedIds.length === studentsForYear.length && studentsForYear.length > 0}
              onCheckedChange={(checked) => handleSelectAll(!!checked)}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium leading-none cursor-pointer select-none"
            >
              Select All ({selectedIds.length} of {studentsForYear.length} selected)
            </label>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 hover:bg-primary/10 hover:text-primary"
                onClick={handleBulkPromote}
              >
                <ChevronUp className="h-4 w-4" />
                Promote
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 hover:bg-primary/10 hover:text-primary"
                onClick={handleBulkDemote}
              >
                <ChevronDown className="h-4 w-4" />
                Demote
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-destructive hover:bg-destructive/10"
                onClick={handleBulkDebar}
              >
                <Ban className="h-4 w-4" />
                Debar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                onClick={handleBulkActivate}
              >
                <Ban className="h-4 w-4" />
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 hover:bg-primary/10 hover:text-primary"
                onClick={handleBulkPrint}
              >
                <Printer className="h-4 w-4" />
                Print Profiles
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {studentsForYear.length === 0 ? (
          <Card className="border-dashed col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                No students in this class for {selectedAcademicYear}
              </p>
            </CardContent>
          </Card>
        ) : (
          studentsForYear.map((student) => {
            const studentImage = PlaceHolderImages.find(p => p.id === student.id);

            return (
              <Card
                key={student.id}
                onClick={() => handleStudentClick(student.id)}
                className="flex flex-col cursor-pointer transition-all hover:shadow-lg hover:scale-105"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(student.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((prev) => [...prev, student.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== student.id));
                          }
                        }}
                      />
                    </div>
                    <Avatar>
                      <AvatarImage src={student.photoUrl ?? studentImage?.imageUrl} />
                      <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base truncate">{student.name}</CardTitle>
                        {student.status === 'Debarred' && (
                          <Badge variant="destructive" className="text-[9px] font-bold px-1.5 py-0 h-4 uppercase shrink-0">
                            Debarred
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        {student.usn || student.studentId}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow pb-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium truncate text-xs">{student.email || '-'}</p>
                    </div>
                    {student.phone && (
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="font-medium text-xs">{student.phone}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <div 
                  className="mt-auto border-t p-2 flex justify-between items-center gap-1 bg-muted/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePromoteStudent(student);
                    }}
                    title="Promote"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDemoteStudent(student);
                    }}
                    title="Demote"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      student.status === 'Debarred' 
                        ? "text-destructive hover:bg-destructive/10" 
                        : "hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-950 dark:hover:text-amber-400"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDebarStudent(student);
                    }}
                    title={student.status === 'Debarred' ? "Activate Student" : "Debar Student"}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditStudent(student.id);
                    }}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintStudent(student);
                    }}
                    title="Print Profile"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStudent(student);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
