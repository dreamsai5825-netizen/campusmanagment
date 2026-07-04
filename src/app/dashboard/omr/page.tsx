'use client';

import React, { useState, useEffect } from 'react';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { generateOMRPdf, exportOMRResultsToExcel, normalizeAnswersCasing } from '@/lib/omr-pdf-generator';
import { valuateOMRSheet } from '@/ai/flows/omr-valuation-flow';
import { useToast } from '@/hooks/use-toast';

// UI components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  FileSpreadsheet,
  FileText,
  Download,
  Eye,
  Upload,
  Plus,
  Trash2,
  Settings2,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Info,
  Calendar,
  User,
  Hash,
  Save,
} from 'lucide-react';
import type { OMRExam, OMRStudentResult } from '@/lib/types';

function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const img = new window.Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
        } catch (e) {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = imageUrl;
  });
}

export default function OMRWorkspacePage() {
  const teacher = useCurrentTeacher();
  const { toast } = useToast();

  const [collegeInfo, setCollegeInfo] = useState<{ name: string; logoUrl?: string } | null>(null);
  const [collegeLogoBase64, setCollegeLogoBase64] = useState<string | null>(null);

  // Sync current teacher's college info
  useEffect(() => {
    if (!teacher?.collegeId) return;

    const unsub = onSnapshot(
      doc(db, 'colleges', teacher.collegeId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCollegeInfo({
            name: data.name || '',
            logoUrl: data.logoUrl || data.logo || undefined,
          });
        }
      },
      (err) => {
        console.error('Error fetching college info:', err);
      }
    );

    return () => unsub();
  }, [teacher?.collegeId]);

  // Convert college logo to base64
  useEffect(() => {
    if (!collegeInfo?.logoUrl) {
      setCollegeLogoBase64(null);
      return;
    }

    let active = true;
    const convert = async () => {
      const b64 = await getBase64ImageFromUrl(collegeInfo.logoUrl!);
      if (active) {
        setCollegeLogoBase64(b64);
      }
    };
    convert();
    return () => {
      active = false;
    };
  }, [collegeInfo?.logoUrl]);

  // Tab state
  const [activeTab, setActiveTab] = useState('generate');

  // PDF JS Loader state
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);

  // --- GENERATOR STATE ---
  const [testName, setTestName] = useState('Unit Test 1');
  const [rollNumberLength, setRollNumberLength] = useState(7);
  const [numSubjects, setNumSubjects] = useState(3);
  const [subjectsConfig, setSubjectsConfig] = useState([
    { name: 'Physics', questionCount: 25 },
    { name: 'Chemistry', questionCount: 25 },
    { name: 'Maths', questionCount: 25 },
  ]);
  const [answerOptions, setAnswerOptions] = useState('A,B,C,D');
  
  // Checkboxes
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeInstructions, setIncludeInstructions] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [additionalInstructions, setAdditionalInstructions] = useState('Negative marks apply.');

  // Preview PDF state
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // --- VALUATION STATE ---
  const [exams, setExams] = useState<OMRExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<OMRExam | null>(null);
  
  // Custom Scoring Metrics
  const [correctMarks, setCorrectMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);

  // Key Answer Upload
  const [keyUploadLoading, setKeyUploadLoading] = useState(false);
  const [detectedKeyAnswers, setDetectedKeyAnswers] = useState<Record<string, Record<string, string>>>({});
  const [keyEditMode, setKeyEditMode] = useState(false);
  const [viewKeyAnswersOpen, setViewKeyAnswersOpen] = useState(false);

  // Students PDF Valuation
  const [studentValuationLoading, setStudentValuationLoading] = useState(false);
  const [valuationProgress, setValuationProgress] = useState(0);
  const [currentProcessingPage, setCurrentProcessingPage] = useState(0);
  const [totalProcessingPages, setTotalProcessingPages] = useState(0);
  
  // Valuation Results
  const [studentResults, setStudentResults] = useState<OMRStudentResult[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedResult, setSelectedResult] = useState<OMRStudentResult | null>(null);
  const [uploadedKeySheetUrl, setUploadedKeySheetUrl] = useState<string | null>(null);
  const [viewUploadedSheetOpen, setViewUploadedSheetOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'ledger' | 'scanner' | 'image'>('ledger');

  // Dynamically load PDF.js client-side
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).pdfjsLib) {
      setPdfJsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      setPdfJsLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load PDF.js CDN');
    };
    document.head.appendChild(script);
  }, []);

  // Sync exams for the logged in college/teacher
  useEffect(() => {
    if (!teacher?.collegeId) return;

    const qExams = query(
      collection(db, 'omr_exams'),
      where('collegeId', '==', teacher.collegeId)
    );

    const unsub = onSnapshot(qExams, (snap) => {
      const examsList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OMRExam));
      setExams(examsList);
    });

    return () => unsub();
  }, [teacher?.collegeId]);

  // Sync results when exam changes
  useEffect(() => {
    if (!selectedExamId) {
      setStudentResults([]);
      setSelectedExam(null);
      return;
    }

    const exam = exams.find((e) => e.id === selectedExamId) || null;
    setSelectedExam(exam);
    if (exam) {
      setTestName(exam.testName);
      setCorrectMarks(exam.correctMarks ?? 1);
      setNegativeMarks(exam.negativeMarks ?? 0);
      setDetectedKeyAnswers(exam.keyAnswers ?? {});
      setKeyEditMode(true);
    }

    const qResults = query(
      collection(db, 'omr_results'),
      where('examId', '==', selectedExamId)
    );

    const unsub = onSnapshot(qResults, (snap) => {
      const resultsList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OMRStudentResult));
      setStudentResults(resultsList);
    });

    return () => unsub();
  }, [selectedExamId, exams]);

  // Handle Dynamic Subject input array sizing
  useEffect(() => {
    const nextSubjects = [...subjectsConfig];
    if (numSubjects > nextSubjects.length) {
      // Add more default subjects
      for (let i = nextSubjects.length; i < numSubjects; i++) {
        nextSubjects.push({ name: `Subject ${i + 1}`, questionCount: 20 });
      }
    } else if (numSubjects < nextSubjects.length) {
      // Slice off excess subjects
      nextSubjects.splice(numSubjects);
    }
    setSubjectsConfig(nextSubjects);
  }, [numSubjects]);

  // Clear PDF blob url on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Trigger PDF rebuild for Preview
  const handlePreviewPdf = () => {
    try {
      const opts = answerOptions.split(',').map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Please specify answer options (e.g. A,B,C,D)',
        });
        return;
      }

      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }

      const docPdf = generateOMRPdf({
        testName,
        rollNumberLength,
        subjects: subjectsConfig,
        options: opts,
        includeDetails,
        includeInstructions,
        includeSignatures,
        additionalInstructions,
        collegeName: collegeInfo?.name || undefined,
        collegeLogoBase64: collegeLogoBase64 || undefined,
      });

      const blob = docPdf.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);

      toast({
        title: 'Preview Updated',
        description: 'The OMR sheet preview has been updated successfully.',
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Failed to generate preview',
        description: 'An error occurred during OMR generation.',
      });
    }
  };

  // Auto-generate preview when logo is loaded or pdf engine ready
  useEffect(() => {
    if (pdfJsLoaded) {
      handlePreviewPdf();
    }
  }, [pdfJsLoaded, collegeLogoBase64, collegeInfo?.name]);

  // Trigger PDF Rebuild & Download
  const handleDownloadPdf = () => {
    try {
      const opts = answerOptions.split(',').map((o) => o.trim()).filter(Boolean);
      const docPdf = generateOMRPdf({
        testName,
        rollNumberLength,
        subjects: subjectsConfig,
        options: opts,
        includeDetails,
        includeInstructions,
        includeSignatures,
        additionalInstructions,
        collegeName: collegeInfo?.name || undefined,
        collegeLogoBase64: collegeLogoBase64 || undefined,
      });
      docPdf.save(`${testName.replace(/\s+/g, '_')}_OMR.pdf`);
      toast({
        title: 'Download Started',
        description: 'Your OMR template is downloading.',
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to download OMR PDF.',
      });
    }
  };

  // Helper to extract page from PDF as Base64 Image
  const convertPdfPageToImage = async (file: File, pageNum: number): Promise<string> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF viewer engine not loaded yet. Please wait a few seconds and try again.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);

    const viewport = page.getViewport({ scale: 1.8 }); // 1.8 is ideal resolution balance for client preview
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas context.');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // Helper to extract base64 from image files directly
  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process Key Sheet Upload
  const handleKeySheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setKeyUploadLoading(true);
    try {
      let base64Image = '';
      let base64Pdf = '';
      let isPdf = false;
      if (file.type === 'application/pdf') {
        isPdf = true;
        base64Pdf = await convertImageToBase64(file);
        try {
          base64Image = await convertPdfPageToImage(file, 1);
        } catch (e) {
          console.warn('Failed to render client preview image:', e);
        }
      } else if (file.type.startsWith('image/')) {
        base64Image = await convertImageToBase64(file);
      } else {
        throw new Error('Unsupported file format. Please upload PDF or image.');
      }

      toast({
        title: 'Parsing Answer Key...',
        description: 'AI Vision Engine is reading the filled bubbles on the OMR sheet.',
      });

      // Prepare expected subjects and options list from selected exam or generator configuration
      const subjectsObj = selectedExam 
        ? selectedExam.subjects
        : subjectsConfig.map((s) => ({ name: s.name, questionCount: s.questionCount }));
      
      const options = selectedExam
        ? selectedExam.options
        : answerOptions.split(',').map((o) => o.trim()).filter(Boolean);
        
      const rNumLen = selectedExam
        ? selectedExam.rollNumberLength
        : rollNumberLength;

      const parsed = await valuateOMRSheet({
        base64Image: isPdf ? undefined : base64Image,
        base64Pdf: isPdf ? base64Pdf : undefined,
        pageNumber: isPdf ? 1 : undefined,
        subjects: subjectsObj,
        options,
        rollNumberLength: rNumLen,
      });

      const normalized = normalizeAnswersCasing(parsed.answers, subjectsObj);
      setDetectedKeyAnswers(normalized);
      setUploadedKeySheetUrl(base64Image);
      setKeyEditMode(true);

      toast({
        title: 'Key Sheet Scanned',
        description: 'Answers detected successfully! Review and save the key below.',
      });
    } catch (err: any) {
      console.error(err);
      const isQuota = err.message?.toLowerCase().includes('quota') || err.message?.includes('429');
      toast({
        variant: 'destructive',
        title: isQuota ? 'System Rate Limit Exceeded' : 'Scan Failed',
        description: isQuota 
          ? 'The scanning engine is temporarily busy. Please wait a minute before retrying.'
          : (err.message || 'Could not parse key sheet. Please check your file.'),
      });
    } finally {
      setKeyUploadLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  // Save/Create OMR Exam definition
  const handleSaveExamKey = async () => {
    if (!testName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please specify a test name.',
      });
      return;
    }

    if (Object.keys(detectedKeyAnswers).length === 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please upload a key sheet first, or fill out key answers.',
      });
      return;
    }

    try {
      const examId = selectedExamId || doc(collection(db, 'omr_exams')).id;
      const subjects = subjectsConfig.map((s) => ({ name: s.name, questionCount: s.questionCount }));
      const options = answerOptions.split(',').map((o) => o.trim()).filter(Boolean);

      const examData: OMRExam = {
        id: examId,
        testName,
        subjects,
        options,
        rollNumberLength,
        keyAnswers: detectedKeyAnswers,
        correctMarks,
        negativeMarks,
        teacherId: teacher?.id || 'unknown',
        collegeId: teacher?.collegeId || 'unknown',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'omr_exams', examId), examData);
      setSelectedExamId(examId);
      setKeyEditMode(false);

      toast({
        title: 'Exam Key Saved',
        description: 'Answer key and configuration saved to the cloud successfully.',
      });
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save exam key config.',
      });
    }
  };

  // Save OMR Template from the Generator tab (without requiring keyAnswers first)
  const handleSaveFromGenerator = async () => {
    if (!testName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please specify a test name.',
      });
      return;
    }

    try {
      const examId = selectedExamId || doc(collection(db, 'omr_exams')).id;
      const subjects = subjectsConfig.map((s) => ({ name: s.name, questionCount: s.questionCount }));
      const options = answerOptions.split(',').map((o) => o.trim()).filter(Boolean);

      const examData: OMRExam = {
        id: examId,
        testName,
        subjects,
        options,
        rollNumberLength,
        keyAnswers: detectedKeyAnswers || {},
        correctMarks,
        negativeMarks,
        teacherId: teacher?.id || 'unknown',
        collegeId: teacher?.collegeId || 'unknown',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'omr_exams', examId), examData);
      setSelectedExamId(examId);

      toast({
        title: 'OMR Template Saved',
        description: `Exam template "${testName}" saved successfully. You can now use it in OMR Valuation.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save OMR exam configuration.',
      });
    }
  };

  // Valuation calculation for single student response against exam key
  const scoreStudentSheet = (studentAnswers: Record<string, Record<string, string>>) => {
    if (!selectedExam) return { score: 0, correct: 0, incorrect: 0, unattempted: 0, maxScore: 0 };

    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let maxScore = 0;

    selectedExam.subjects.forEach((subj) => {
      const keyObj = selectedExam.keyAnswers[subj.name] || {};
      const studObj = studentAnswers[subj.name] || {};

      for (let q = 1; q <= subj.questionCount; q++) {
        const correctOpt = keyObj[String(q)] || '';
        const studentOpt = studObj[String(q)] || '';

        // If key answer is not filled, it doesn't count towards marks
        if (!correctOpt) continue;
        
        maxScore += correctMarks;

        if (!studentOpt) {
          unattempted++;
        } else if (studentOpt === correctOpt) {
          correct++;
        } else {
          incorrect++;
        }
      }
    });

    const score = (correct * correctMarks) - (incorrect * negativeMarks);
    return { score, correct, incorrect, unattempted, maxScore };
  };

  // Valuation of Scanned Students PDF
  const handleStudentsPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExam) return;

    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'PDF engine loading, please try again in a few seconds.',
      });
      return;
    }

    setStudentValuationLoading(true);
    setValuationProgress(0);

    try {
      const base64Pdf = await convertImageToBase64(file);
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageCount = pdf.numPages;

      setTotalProcessingPages(pageCount);
      toast({
        title: 'Processing PDF Started',
        description: `Found ${pageCount} pages. Running valuation...`,
      });

      const subjects = selectedExam.subjects.map((s) => s.name);
      const options = selectedExam.options;
      const rollLen = selectedExam.rollNumberLength;

      for (let p = 1; p <= pageCount; p++) {
        setCurrentProcessingPage(p);
        setValuationProgress(Math.round(((p - 1) / pageCount) * 100));

        // Render page to image (stored in database for teacher visual review)
        const pageImage = await convertPdfPageToImage(file, p);

        // Run Server-side OpenCV OMR Scanner using PDF page conversion on the server
        const result = await valuateOMRSheet({
          base64Pdf,
          pageNumber: p,
          subjects: selectedExam.subjects,
          options,
          rollNumberLength: rollLen,
        });

        const normalizedAnswers = normalizeAnswersCasing(result.answers, selectedExam.subjects);

        // Compute scores
        const { score, correct, incorrect, unattempted, maxScore } = scoreStudentSheet(normalizedAnswers);

        // Lookup student in database to resolve name, class, and section dynamically
        let studentName = result.studentInfo.name || `Scanned Student P.${p}`;
        let studentClass = result.studentInfo.class || '';
        let studentSection = result.studentInfo.section || '';

        // Clean roll number (strip leading zeros) to match database values
        let rollNumber = result.rollNumber;
        if (rollNumber) {
          rollNumber = rollNumber.trim().replace(/^0+/, '');
        }

        if (rollNumber) {
          try {
            let qStudents = query(
              collection(db, 'students'),
              where('collegeId', '==', selectedExam.collegeId),
              where('usn', '==', rollNumber)
            );
            let studentSnap = await getDocs(qStudents);

            if (studentSnap.empty) {
              qStudents = query(
                collection(db, 'students'),
                where('collegeId', '==', selectedExam.collegeId),
                where('studentId', '==', rollNumber)
              );
              studentSnap = await getDocs(qStudents);
            }

            if (!studentSnap.empty) {
              const studentData = studentSnap.docs[0].data();
              studentName = studentData.name || studentName;
              
              if (studentData.classId) {
                // Fetch class list to resolve name
                const qClasses = query(
                  collection(db, 'classes'),
                  where('collegeId', '==', selectedExam.collegeId)
                );
                const classSnap = await getDocs(qClasses);
                const classData = classSnap.docs.find(d => d.id === studentData.classId)?.data();
                if (classData) {
                  const className = classData.name || '';
                  if (className.includes('-')) {
                    const parts = className.split('-');
                    studentClass = parts[0].trim();
                    studentSection = parts[1].trim();
                  } else {
                    studentClass = className;
                    studentSection = '';
                  }
                }
              }
            }
          } catch (err) {
            console.error('Error resolving student database info:', err);
          }
        }

        // Save result doc to Firestore
        const resultId = doc(collection(db, 'omr_results')).id;
        const resultDoc: OMRStudentResult = {
          id: resultId,
          examId: selectedExam.id,
          rollNumber: rollNumber || `UNKNOWN-${p}`,
          studentName,
          studentClass,
          studentSection,
          answers: normalizedAnswers,
          score,
          correctCount: correct,
          incorrectCount: incorrect,
          unattemptedCount: unattempted,
          maxScore,
          evaluatedAt: new Date().toISOString(),
          scannedImage: pageImage,
        };

        await setDoc(doc(db, 'omr_results', resultId), resultDoc);
      }

      setValuationProgress(100);
      toast({
        title: 'Valuation Complete',
        description: `Successfully processed ${pageCount} student OMR sheets!`,
      });
    } catch (err: any) {
      console.error(err);
      const isQuota = err.message?.toLowerCase().includes('quota') || err.message?.includes('429');
      toast({
        variant: 'destructive',
        title: isQuota ? 'System Rate Limit Exceeded' : 'Processing Failed',
        description: isQuota 
          ? 'The scanning engine is temporarily busy. Please wait a minute before retrying.'
          : (err.message || 'An error occurred during sheet scanning.'),
      });
    } finally {
      setStudentValuationLoading(false);
      e.target.value = '';
    }
  };

  // Delete result doc
  const handleDeleteResult = async (resId: string) => {
    try {
      await deleteDoc(doc(db, 'omr_results', resId));
      toast({
        title: 'Result Deleted',
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Failed to delete result',
      });
    }
  };

  // Delete Exam key
  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam configuration? All associated student results will be orphaned.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'omr_exams', examId));
      setSelectedExamId('');
      toast({
        title: 'Exam deleted successfully',
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Failed to delete exam',
      });
    }
  };

  // Clear Server Answer Key
  const handleClearAnswerKey = async () => {
    if (!selectedExamId) return;
    if (!confirm('Are you sure you want to clear the saved correct options for this exam configuration?')) {
      return;
    }
    try {
      await updateDoc(doc(db, 'omr_exams', selectedExamId), {
        keyAnswers: {}
      });
      setDetectedKeyAnswers({});
      toast({
        title: 'Answer Key Cleared',
        description: 'The stored correct options have been cleared from the database.',
      });
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to clear answer key.',
      });
    }
  };

  // Export results list to XLSX sheet
  const handleExportResults = () => {
    if (!selectedExam || studentResults.length === 0) return;
    exportOMRResultsToExcel(studentResults, selectedExam.testName);
    toast({
      title: 'Excel Download Started',
    });
  };

  // Calculate results metrics
  const totalSheets = studentResults.length;
  const avgScore = totalSheets > 0 ? (studentResults.reduce((acc, curr) => acc + curr.score, 0) / totalSheets).toFixed(1) : '0';
  const highestScore = totalSheets > 0 ? Math.max(...studentResults.map((r) => r.score)) : 0;
  const lowestScore = totalSheets > 0 ? Math.min(...studentResults.map((r) => r.score)) : 0;

  const filteredResults = studentResults.filter(
    (r) =>
      r.studentName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.rollNumber?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.studentClass?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight text-primary flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-accent" />
            OMR Sheets Workspace
          </h1>
          <p className="text-muted-foreground">
            Generate printable OMR templates and grade scanned sheets using Local AI Vision Engine.
          </p>
        </div>
        
        {/* Load indicators */}
        <div className="flex items-center gap-2 text-xs bg-muted px-3 py-1.5 rounded-full text-muted-foreground border">
          <div className={`h-2.5 w-2.5 rounded-full ${pdfJsLoaded ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          {pdfJsLoaded ? 'PDF Vision Engine Ready' : 'Initializing Vision Engine...'}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md bg-muted/80 backdrop-blur border">
          <TabsTrigger value="generate" className="font-semibold">OMR Generator</TabsTrigger>
          <TabsTrigger value="valuate" className="font-semibold">OMR Valuation</TabsTrigger>
        </TabsList>

        {/* ==================================== */}
        {/* TAB 1: GENERATE OMR SHEET           */}
        {/* ==================================== */}
        <TabsContent value="generate" className="mt-4">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Left Options Panel (30% width) */}
            <div className="w-full lg:w-[32%] flex flex-col gap-4">
              <Card className="shadow-lg border-primary/20">
                <CardHeader className="bg-primary/5 pb-4 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    OMR Parameters
                  </CardTitle>
                  <CardDescription>Configure the exam structure and layout options.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  
                  {/* Test Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="testName" className="text-xs font-semibold">Test Name / Title</Label>
                    <Input
                      id="testName"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      placeholder="e.g. NEET Mock Test 2025"
                      className="h-9"
                    />
                  </div>

                  {/* Roll Number Size */}
                  <div className="space-y-1.5">
                    <Label htmlFor="rollLen" className="text-xs font-semibold">Roll Number Size (Digits)</Label>
                    <Input
                      id="rollLen"
                      type="number"
                      min={0}
                      max={12}
                      value={rollNumberLength}
                      onChange={(e) => setRollNumberLength(Number(e.target.value))}
                      className="h-9"
                    />
                  </div>

                  {/* Answer Options */}
                  <div className="space-y-1.5">
                    <Label htmlFor="options" className="text-xs font-semibold">Answer Option Letters</Label>
                    <Input
                      id="options"
                      value={answerOptions}
                      onChange={(e) => setAnswerOptions(e.target.value)}
                      placeholder="A,B,C,D"
                      className="h-9"
                    />
                    <span className="text-[10px] text-muted-foreground block">Comma separated, e.g. A,B,C,D or A,B,C,D,E</span>
                  </div>

                  {/* Number of Subjects */}
                  <div className="space-y-1.5 border-t pt-3">
                    <Label htmlFor="numSub" className="text-xs font-semibold">Number of Subjects</Label>
                    <Input
                      id="numSub"
                      type="number"
                      min={1}
                      max={6}
                      value={numSubjects}
                      onChange={(e) => setNumSubjects(Math.max(1, Number(e.target.value)))}
                      className="h-9"
                    />
                  </div>

                  {/* Dynamic Subjects List */}
                  <div className="space-y-3 max-h-56 overflow-y-auto border p-2.5 rounded bg-muted/40">
                    <Label className="text-xs font-bold text-primary block">Subject Question Splits</Label>
                    {subjectsConfig.map((sub, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-background p-1.5 border rounded">
                        <Input
                          value={sub.name}
                          onChange={(e) => {
                            const clone = [...subjectsConfig];
                            clone[idx].name = e.target.value;
                            setSubjectsConfig(clone);
                          }}
                          placeholder={`Sub ${idx+1}`}
                          className="h-8 text-xs flex-1"
                        />
                        <Input
                          type="number"
                          value={sub.questionCount}
                          onChange={(e) => {
                            const clone = [...subjectsConfig];
                            clone[idx].questionCount = Math.max(1, Number(e.target.value));
                            setSubjectsConfig(clone);
                          }}
                          placeholder="Questions"
                          className="h-8 text-xs w-20"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Checkbox Layout Toggles */}
                  <div className="space-y-2 border-t pt-3">
                    <Label className="text-xs font-semibold block mb-1">Sheet Sections</Label>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="details"
                        checked={includeDetails}
                        onCheckedChange={(checked) => setIncludeDetails(!!checked)}
                      />
                      <label htmlFor="details" className="text-xs cursor-pointer select-none">
                        Student Details Card (Name, Class, Section)
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="instructions"
                        checked={includeInstructions}
                        onCheckedChange={(checked) => setIncludeInstructions(!!checked)}
                      />
                      <label htmlFor="instructions" className="text-xs cursor-pointer select-none">
                        Filling Instructions & Marking Methods
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="signatures"
                        checked={includeSignatures}
                        onCheckedChange={(checked) => setIncludeSignatures(!!checked)}
                      />
                      <label htmlFor="signatures" className="text-xs cursor-pointer select-none">
                        Candidate & Invigilator Sign Lines
                      </label>
                    </div>
                  </div>

                  {/* Additional Instruction */}
                  <div className="space-y-1.5 border-t pt-3">
                    <Label htmlFor="addInst" className="text-xs font-semibold">Additional Instruction (Optional)</Label>
                    <Textarea
                      id="addInst"
                      value={additionalInstructions}
                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                      placeholder="e.g. Each correct answer carries 4 marks."
                      className="text-xs min-h-[50px]"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <Button onClick={handlePreviewPdf} className="w-full h-9 bg-accent hover:bg-accent/90">
                      <Eye className="mr-2 h-4 w-4" /> Preview OMR Sheet
                    </Button>
                    <Button onClick={handleSaveFromGenerator} className="w-full h-9 bg-primary hover:bg-primary/90">
                      <Save className="mr-2 h-4 w-4" /> Save OMR Template
                    </Button>
                  </div>

                </CardContent>
              </Card>
            </div>

            {/* Right Live Preview Panel (70% width) */}
            <div className="w-full lg:w-[68%] flex flex-col gap-4">
              <Card className="shadow-lg border-primary/20 h-[650px] flex flex-col">
                <CardHeader className="bg-primary/5 pb-2 border-b flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Live Sheet Preview</CardTitle>
                    <CardDescription>A4 Printout representation of the OMR template.</CardDescription>
                  </div>
                  {pdfBlobUrl && (
                    <Button onClick={handleDownloadPdf} variant="outline" className="h-8 border-primary text-primary hover:bg-primary hover:text-white">
                      <Download className="mr-2 h-4 w-4" /> Generate Final (Download)
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="flex-1 p-4 bg-muted/30 flex items-center justify-center relative">
                  {pdfBlobUrl ? (
                    <iframe
                      src={`${pdfBlobUrl}#toolbar=0&navpanes=0`}
                      className="w-full h-full border rounded-lg bg-white shadow"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground max-w-sm flex flex-col items-center gap-3">
                      <div className="h-16 w-16 bg-muted border rounded-full flex items-center justify-center mb-2">
                        <FileText className="h-8 w-8 text-muted-foreground/60" />
                      </div>
                      <h3 className="font-semibold text-foreground">No Preview Loaded</h3>
                      <p className="text-xs">
                        Configure the exam parameters on the left and click <strong>Preview OMR Sheet</strong> to render the template.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>

        {/* ==================================== */}
        {/* TAB 2: OMR SHEET VALUATION          */}
        {/* ==================================== */}
        <TabsContent value="valuate" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* VALUATION PIPELINE CONTROLS (Left 1/3) */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              
              {/* Exam Selection card */}
              <Card className="shadow-lg">
                <CardHeader className="bg-primary/5 border-b pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    OMR Exam Setup
                  </CardTitle>
                  <CardDescription>Select an existing config or save current generation parameters.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  
                  {/* Select Exam */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Select Target Exam</Label>
                    <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                      <SelectTrigger>
                        <SelectValue placeholder="-- Choose Exam --" />
                      </SelectTrigger>
                      <SelectContent>
                        {exams.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.testName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Save current generator settings as an exam */}
                  {!selectedExamId && (
                    <Button onClick={handleSaveExamKey} variant="outline" className="w-full text-xs h-8 border-dashed">
                      <Plus className="mr-1 h-3.5 w-3.5" /> Initialize Exam Key from Generator
                    </Button>
                  )}

                  {selectedExam && (
                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => handleDeleteExam(selectedExam.id)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Configuration
                      </Button>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* Step 1: Upload Answer Key */}
              {selectedExam && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-primary/5 border-b pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      1. Upload Key Sheet
                    </CardTitle>
                    <CardDescription>Upload a completed PDF or image showing the correct answers key.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/40 transition relative">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleKeySheetUpload}
                        disabled={keyUploadLoading}
                      />
                      {keyUploadLoading ? (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <Loader2 className="h-8 w-8 animate-spin text-accent" />
                          <span className="text-xs text-muted-foreground">Scanned page processing...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground/60" />
                          <span className="text-xs font-semibold">Select Key Answer Sheet</span>
                          <span className="text-[10px] text-muted-foreground">PDF page 1 or image file</span>
                        </div>
                      )}
                    </div>

                    {Object.keys(detectedKeyAnswers).length > 0 && (
                      <div className="space-y-2 w-full">
                        <div className="bg-green-500/10 border border-green-500/30 text-green-700 p-2.5 rounded text-xs flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span>Key Answers Loaded. {keyEditMode ? 'Editing answers' : 'Scan results saved.'}</span>
                        </div>
                        {uploadedKeySheetUrl && (
                          <Button
                            onClick={() => setViewUploadedSheetOpen(true)}
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 border-primary text-primary hover:bg-primary hover:text-white"
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View Scanned Key Image
                          </Button>
                        )}
                        <Button
                          onClick={() => setViewKeyAnswersOpen(true)}
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 border-accent text-accent hover:bg-accent hover:text-white"
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" /> View Answer Key
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Scoring Configuration Card */}
              {selectedExam && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-primary/5 border-b pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      Scoring Metrics
                    </CardTitle>
                    <CardDescription>Configure scoring weightage rules. Student lookup is automatically performed by matching scanned roll numbers against the `students` collection in Firestore (checking both `usn` and `studentId` fields for resolution).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="corrM" className="text-xs font-semibold">Correct Answer</Label>
                        <Input
                          id="corrM"
                          type="number"
                          min={1}
                          value={correctMarks}
                          onChange={(e) => setCorrectMarks(Number(e.target.value))}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="negM" className="text-xs font-semibold">Negative Marking</Label>
                        <Input
                          id="negM"
                          type="number"
                          min={0}
                          value={negativeMarks}
                          onChange={(e) => setNegativeMarks(Number(e.target.value))}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <Button onClick={handleSaveExamKey} className="w-full h-8 text-xs">
                      Update Marking Rules
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Upload Student Scans */}
              {selectedExam && Object.keys(detectedKeyAnswers).length > 0 && (
                <Card className="shadow-lg border-accent/20">
                  <CardHeader className="bg-accent/5 border-b pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4 text-accent" />
                      2. Valuate Student Sheets
                    </CardTitle>
                    <CardDescription>Upload scanner export PDF containing filled student sheets.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="border-2 border-dashed border-accent/40 rounded-lg p-4 text-center cursor-pointer hover:bg-accent/5 transition relative">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleStudentsPdfUpload}
                        disabled={studentValuationLoading}
                      />
                      {studentValuationLoading ? (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <Loader2 className="h-8 w-8 animate-spin text-accent" />
                          <span className="text-xs text-muted-foreground font-semibold">
                            Processing sheet {currentProcessingPage} of {totalProcessingPages}...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-accent/60" />
                          <span className="text-xs font-semibold text-accent">Select Scanned Students PDF</span>
                          <span className="text-[10px] text-muted-foreground">Will process multiple pages in batch</span>
                        </div>
                      )}
                    </div>

                    {studentValuationLoading && (
                      <div className="space-y-1">
                        <Progress value={valuationProgress} className="h-2" />
                        <span className="text-[10px] text-muted-foreground float-right">{valuationProgress}% Completed</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            </div>

            {/* RESULTS VIEWPORT & KEY VIEWER (Right 2/3) */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Key Editor Panel (If Key has been processed and is being reviewed) */}
              {selectedExam && keyEditMode && (
                <Card className="shadow-lg border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader className="pb-3 border-b border-yellow-500/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-base text-yellow-800">Review Answer Key</CardTitle>
                        <CardDescription>Confirm correct options. Edit boxes to manually override scan values.</CardDescription>
                      </div>
                      <Button size="sm" onClick={handleSaveExamKey} className="h-8 bg-yellow-600 hover:bg-yellow-700">
                        Verify & Commit Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 max-h-[300px] overflow-y-auto">
                    <div className="space-y-4">
                      {selectedExam.subjects.map((sub) => {
                        const subKey = detectedKeyAnswers[sub.name] || {};
                        return (
                          <div key={sub.name} className="space-y-2 border-b pb-3">
                            <h3 className="text-xs font-bold text-primary">{sub.name.toUpperCase()}</h3>
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                              {Array.from({ length: sub.questionCount }, (_, i) => i + 1).map((q) => {
                                const val = subKey[String(q)] || '';
                                return (
                                  <div key={q} className="flex flex-col items-center gap-1 bg-background border p-1 rounded">
                                    <span className="text-[9px] text-muted-foreground">Q{q}</span>
                                    <select
                                      value={val}
                                      onChange={(e) => {
                                        const clone = { ...detectedKeyAnswers };
                                        if (!clone[sub.name]) clone[sub.name] = {};
                                        clone[sub.name][String(q)] = e.target.value;
                                        setDetectedKeyAnswers(clone);
                                      }}
                                      className="text-xs font-bold w-10 text-center border-none p-0 bg-transparent focus:ring-0"
                                    >
                                      <option value="">—</option>
                                      {selectedExam.options.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                      <option value="MULTIPLE">MULTIPLE</option>
                                      <option value="INVALID">INVALID</option>
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Valuation Dashboard Statistics */}
              {selectedExam && studentResults.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  
                  <Card className="shadow border-primary/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground font-semibold">Sheets Evaluated</span>
                      <span className="text-2xl font-bold font-headline text-primary mt-1">{totalSheets}</span>
                    </CardContent>
                  </Card>

                  <Card className="shadow border-primary/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground font-semibold">Class Average</span>
                      <span className="text-2xl font-bold font-headline text-accent mt-1">{avgScore}</span>
                    </CardContent>
                  </Card>

                  <Card className="shadow border-primary/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground font-semibold">Highest Mark</span>
                      <span className="text-2xl font-bold font-headline text-green-600 mt-1">{highestScore}</span>
                    </CardContent>
                  </Card>

                  <Card className="shadow border-primary/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground font-semibold">Lowest Mark</span>
                      <span className="text-2xl font-bold font-headline text-red-500 mt-1">{lowestScore}</span>
                    </CardContent>
                  </Card>

                </div>
              )}

              {/* Results Records List */}
              {selectedExam && (
                <Card className="shadow-lg flex-1">
                  <CardHeader className="bg-primary/5 border-b pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <CardTitle className="text-base">Valuation Records</CardTitle>
                      <CardDescription>Evaluation results database for {selectedExam.testName}.</CardDescription>
                    </div>
                    {studentResults.length > 0 && (
                      <Button onClick={handleExportResults} size="sm" variant="outline" className="h-8 text-xs border-accent text-accent hover:bg-accent hover:text-white">
                        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Export results (Excel)
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4">
                    
                    {studentResults.length > 0 ? (
                      <div className="space-y-4">
                        <Input
                          placeholder="Search records by name, roll number, or class..."
                          value={searchFilter}
                          onChange={(e) => setSearchFilter(e.target.value)}
                          className="h-9 text-xs"
                        />

                        <div className="border rounded-md overflow-x-auto max-h-[360px] overflow-y-auto">
                          <Table>
                            <TableHeader className="bg-muted/40 sticky top-0 z-10">
                              <TableRow>
                                <TableHead className="w-24">Roll No</TableHead>
                                <TableHead>Candidate Name</TableHead>
                                <TableHead className="w-20">Class</TableHead>
                                <TableHead className="w-16">Sec</TableHead>
                                <TableHead className="w-24 text-right">Score</TableHead>
                                <TableHead className="w-24 text-right">Accuracy</TableHead>
                                <TableHead className="w-20 text-center">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredResults.map((res) => {
                                const totalQ = selectedExam.subjects.reduce((a, s) => a + s.questionCount, 0);
                                const percentage = ((res.correctCount / totalQ) * 100).toFixed(1) + '%';
                                return (
                                  <TableRow key={res.id} className="hover:bg-muted/30">
                                    <TableCell className="font-semibold text-xs">{res.rollNumber}</TableCell>
                                    <TableCell className="text-xs font-medium">{res.studentName}</TableCell>
                                    <TableCell className="text-xs">{res.studentClass || '—'}</TableCell>
                                    <TableCell className="text-xs">{res.studentSection || '—'}</TableCell>
                                    <TableCell className="text-right text-xs font-bold text-primary">
                                      {res.score} / {res.maxScore}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">{percentage}</TableCell>
                                    <TableCell className="text-center">
                                      <div className="flex justify-center items-center gap-1.5">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-primary hover:bg-primary/10"
                                          onClick={() => setSelectedResult(res)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-red-500 hover:bg-red-500/10"
                                          onClick={() => handleDeleteResult(res.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
                        <div className="h-14 w-14 bg-muted border rounded-full flex items-center justify-center">
                          <Info className="h-7 w-7 text-muted-foreground/60" />
                        </div>
                        <h3 className="font-semibold text-foreground text-sm">No Results Evaluated</h3>
                        <p className="text-xs max-w-sm">
                          Select an exam key, configuration option, then upload a scanned students PDF file in the left panel to begin sheet valuation.
                        </p>
                      </div>
                    )}

                  </CardContent>
                </Card>
              )}

              {/* No exam config selection warning */}
              {!selectedExam && (
                <Card className="shadow border bg-muted/20">
                  <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
                    <Settings2 className="h-8 w-8 text-primary/40 animate-spin" style={{ animationDuration: '3s' }} />
                    <h3 className="font-medium text-foreground text-sm">Awaiting Exam Selection</h3>
                    <p className="text-xs max-w-md">
                      Please select an exam from the OMR Exam Setup card, or click &quot;Initialize Exam Key from Generator&quot; to build a new config.
                    </p>
                  </CardContent>
                </Card>
              )}

            </div>

          </div>
        </TabsContent>
      </Tabs>

      {/* STUDENT RESULT BREAKDOWN DIALOG DETAIL DRILLDOWN */}
      <Dialog open={!!selectedResult} onOpenChange={(open) => { if (!open) { setSelectedResult(null); setModalTab('ledger'); } }}>
        {selectedResult && selectedExam && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-primary/20">
            <DialogHeader className="bg-primary/5 p-4 -mx-6 -mt-6 border-b">
              <DialogTitle className="text-lg font-headline font-bold text-primary flex items-center gap-2">
                <User className="h-5 w-5 text-accent" />
                Student Valuation Details
              </DialogTitle>
              <DialogDescription>Detailed question-wise performance logs for {selectedResult.studentName}.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {/* Tabs header */}
              <div className="flex border-b bg-muted/20 p-1 rounded-md gap-1">
                <button
                  onClick={() => setModalTab('ledger')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    modalTab === 'ledger'
                      ? 'bg-white shadow text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Response Ledger
                </button>
                <button
                  onClick={() => setModalTab('scanner')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                    modalTab === 'scanner'
                      ? 'bg-white shadow text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Scanner Analysis
                </button>
                {selectedResult.scannedImage && (
                  <button
                    onClick={() => setModalTab('image')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${
                      modalTab === 'image'
                        ? 'bg-white shadow text-primary font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Scanned OMR Sheet Image
                  </button>
                )}
              </div>

              {modalTab === 'image' && selectedResult.scannedImage ? (
                <div className="flex flex-col items-center justify-center p-4 bg-muted/20 border border-dashed rounded-lg gap-2">
                  <img
                    src={selectedResult.scannedImage}
                    alt="Scanned Student OMR Sheet"
                    className="max-h-[50vh] object-contain shadow border rounded"
                  />
                  <span className="text-[10px] text-muted-foreground">Original scanned student page used for grading.</span>
                </div>
              ) : modalTab === 'scanner' ? (
                <div className="space-y-6">
                  <div className="bg-primary/5 border border-primary/10 p-3 rounded-lg text-xs text-primary/80">
                    <strong>OMR Scanning Analysis:</strong> This grid shows the raw output of the local PyTorch/OpenCV bubble classifier for each question on the student's sheet.
                  </div>
                  {selectedExam.subjects.map((sub) => {
                    const studMap = selectedResult.answers[sub.name] || {};
                    return (
                      <div key={sub.name} className="space-y-3">
                        <h3 className="text-xs font-bold text-primary border-b pb-1 uppercase">{sub.name}</h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {Array.from({ length: sub.questionCount }, (_, i) => i + 1).map((q) => {
                            const studentVal = studMap[String(q)] || '';
                            return (
                              <div key={q} className="flex items-center justify-between bg-muted/40 border p-2 rounded text-xs font-medium min-h-[38px]">
                                <span className="text-muted-foreground">Q{q}</span>
                                {studentVal ? (
                                  studentVal.length > 1 ? (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border shadow-sm ${
                                      studentVal === 'INVALID'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}>
                                      {studentVal}
                                    </span>
                                  ) : (
                                    <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                                      {studentVal}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground font-normal text-[11px]">—</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Metadata details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/40 p-3 border rounded-lg text-xs">
                    <div>
                      <span className="text-muted-foreground block font-medium">Candidate Name</span>
                      <span className="font-bold text-foreground text-sm">{selectedResult.studentName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">Roll Number</span>
                      <span className="font-bold text-foreground text-sm">{selectedResult.rollNumber}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">Class / Section</span>
                      <span className="font-bold text-foreground text-sm">
                        {selectedResult.studentClass || '—'} {selectedResult.studentSection ? `(${selectedResult.studentSection})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-medium">Final Score</span>
                      <span className="font-bold text-primary text-sm">{selectedResult.score} / {selectedResult.maxScore}</span>
                    </div>
                  </div>

                  {/* Stats overview */}
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="border p-2 rounded-lg bg-green-500/5 border-green-500/20 text-green-700">
                      <span className="font-bold text-base block">{selectedResult.correctCount}</span>
                      Correct Answers
                    </div>
                    <div className="border p-2 rounded-lg bg-red-500/5 border-red-500/20 text-red-600">
                      <span className="font-bold text-base block">{selectedResult.incorrectCount}</span>
                      Incorrect Answers
                    </div>
                    <div className="border p-2 rounded-lg bg-slate-500/5 border-slate-500/20 text-slate-600">
                      <span className="font-bold text-base block">{selectedResult.unattemptedCount}</span>
                      Unattempted
                    </div>
                  </div>

                  {/* Subject breakdowns list */}
                  <div className="space-y-4">
                    {selectedExam.subjects.map((sub) => {
                      const keyMap = selectedExam.keyAnswers[sub.name] || {};
                      const studMap = selectedResult.answers[sub.name] || {};

                      return (
                        <div key={sub.name} className="border rounded-lg overflow-hidden">
                          <div className="bg-primary/10 px-3 py-2 text-xs font-bold text-primary border-b uppercase">
                            {sub.name} Response Ledger
                          </div>
                          <div className="max-h-[220px] overflow-y-auto">
                            <Table>
                              <TableHeader className="bg-muted/40 text-xs">
                                <TableRow>
                                  <TableHead className="w-16">Q.No</TableHead>
                                  <TableHead className="w-24 text-center">Correct Key</TableHead>
                                  <TableHead className="w-24 text-center">Student Option</TableHead>
                                  <TableHead className="text-right">Grading Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Array.from({ length: sub.questionCount }, (_, i) => i + 1).map((q) => {
                                  const correctVal = keyMap[String(q)] || '';
                                  const studentVal = studMap[String(q)] || '';

                                  const isCorrect = studentVal && correctVal && studentVal === correctVal;
                                  const isUnattempted = !studentVal;
                                  const hasKey = !!correctVal;

                                  return (
                                    <TableRow key={q} className="hover:bg-muted/10 text-xs py-1">
                                      <TableCell className="font-semibold text-xs">Q{q}</TableCell>
                                      <TableCell className="text-center font-bold text-primary">
                                        {hasKey ? correctVal : <span className="text-muted-foreground font-normal text-[11px]">—</span>}
                                      </TableCell>
                                      <TableCell className="text-center font-bold">
                                        {isUnattempted ? <span className="text-muted-foreground font-normal text-[11px]">—</span> : studentVal}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {!hasKey ? (
                                          <span className="text-slate-400 font-medium">Unevaluated</span>
                                        ) : isUnattempted ? (
                                          <span className="text-slate-500 font-medium">Unattempted</span>
                                        ) : isCorrect ? (
                                          <span className="text-green-600 font-bold flex items-center justify-end gap-1">
                                            <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Correct
                                          </span>
                                        ) : (
                                          <span className="text-red-500 font-bold flex items-center justify-end gap-1">
                                            <XCircle className="h-3.5 w-3.5 text-red-500" /> Incorrect
                                          </span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* VIEW SCANNED KEY IMAGE DIALOG */}
      <Dialog open={viewUploadedSheetOpen} onOpenChange={setViewUploadedSheetOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border-primary/20">
          <DialogHeader className="bg-primary/5 p-4 -mx-6 -mt-6 border-b">
            <DialogTitle className="text-lg font-headline font-bold text-primary flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent" />
              Scanned Key Answer Sheet
            </DialogTitle>
            <DialogDescription>This is the image processed by the AI Vision Engine for answer key extraction.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 bg-muted/20 flex items-center justify-center rounded-lg mt-4 border border-dashed">
            {uploadedKeySheetUrl && (
              <img 
                src={uploadedKeySheetUrl} 
                alt="Scanned Key Answer Sheet" 
                className="max-h-[60vh] object-contain shadow border rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW ANSWER KEY DIALOG */}
      <Dialog open={viewKeyAnswersOpen} onOpenChange={setViewKeyAnswersOpen}>
        {selectedExam && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border-primary/20">
            <DialogHeader className="bg-primary/5 p-4 -mx-6 -mt-6 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-headline font-bold text-primary flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Answer Key Details - {selectedExam.testName}
                </DialogTitle>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleClearAnswerKey}
                  className="mr-8 font-bold"
                >
                  Clear Server Key
                </Button>
              </div>
              <DialogDescription>Stored correct options for this exam configuration.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              {selectedExam.subjects.map((sub) => {
                const subKey = (detectedKeyAnswers[sub.name] && Object.keys(detectedKeyAnswers[sub.name]).length > 0)
                  ? detectedKeyAnswers[sub.name]
                  : (selectedExam.keyAnswers[sub.name] || {});
                return (
                  <div key={sub.name} className="space-y-3">
                    <h3 className="text-sm font-bold text-primary border-b pb-1">{sub.name.toUpperCase()}</h3>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {Array.from({ length: sub.questionCount }, (_, i) => i + 1).map((q) => {
                        const correctOpt = subKey[String(q)] || '';
                        return (
                          <div key={q} className="flex items-center justify-between bg-muted/40 border p-2 rounded text-xs font-medium min-h-[38px]">
                            <span className="text-muted-foreground">Q{q}</span>
                            {correctOpt ? (
                              correctOpt.length > 1 ? (
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border shadow-sm ${
                                  correctOpt === 'INVALID'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                }`}>
                                  {correctOpt}
                                </span>
                              ) : (
                                <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                                  {correctOpt}
                                </span>
                              )
                            ) : (
                              <span className="text-muted-foreground font-normal text-[11px]">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        )}
      </Dialog>

    </div>
  );
}
