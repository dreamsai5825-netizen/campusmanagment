'use client';

import React, { useState, useEffect } from 'react';
import { useCurrentTeacher, useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAuth } from '@/contexts/auth-context';
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
import type { OMRValuationOutput } from '@/ai/flows/omr-valuation-flow';
import type { OMRExam, OMRStudentResult } from '@/lib/types';
import { generateOMRPdf, exportOMRResultsToExcel, normalizeAnswersCasing } from '@/lib/omr-pdf-generator';
import { useToast } from '@/hooks/use-toast';

// Client API fetch wrappers (replaces Server Actions to prevent dynamic build-hash 404 errors on deployed sites)
async function valuateOMRSheet(input: {
  base64Image?: string;
  base64Pdf?: string;
  pageNumber?: number;
  subjects: { name: string; questionCount: number }[];
  options: string[];
  rollNumberLength: number;
  rotationAngle?: number;
}): Promise<OMRValuationOutput> {
  const res = await fetch('/api/omr/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `OMR valuation failed (HTTP ${res.status})`);
  }
  return await res.json();
}

async function getOMRMLStatus() {
  const res = await fetch('/api/omr/ml/status');
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || 'Failed to fetch ML status');
  }
  return await res.json();
}

async function trainOMRMLModel(epochs = 5, lr = 0.001) {
  const res = await fetch('/api/omr/ml/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epochs, lr }),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || 'ML training failed');
  }
  return await res.json();
}

async function submitOMRMLFeedback(base64Image: string, label: string, sampleName?: string) {
  const res = await fetch('/api/omr/ml/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, label, sampleName }),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || 'ML feedback submission failed');
  }
  return await res.json();
}

async function getOMRMLDatasetSamples(limit = 60, offset = 0, category = 'all') {
  const res = await fetch(`/api/omr/ml/samples?limit=${limit}&offset=${offset}&category=${category}`);
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || 'Failed to fetch dataset samples');
  }
  return await res.json();
}

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
  BrainCircuit,
  Cpu,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Camera,
  Flame,
} from 'lucide-react';

async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  if (typeof window === 'undefined' || !imageUrl) return null;
  if (imageUrl.startsWith('data:image/')) return imageUrl;

  // Strategy 1: Fetch binary blob directly and encode via FileReader (avoids canvas CORS tainting)
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const b64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(typeof reader.result === 'string' ? reader.result : null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (b64) return b64;
    }
  } catch (fetchErr) {
    // If fetch failed, fallback to canvas strategy below
  }

  // Strategy 2: Image + Canvas fallback
  return new Promise((resolve) => {
    const img = new window.Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
          return;
        }
      } catch (e) {
        console.warn('Canvas conversion failed for OMR logo:', e);
      }
      resolve(null);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = imageUrl;
  });
}

export default function OMRWorkspacePage() {
  const teacher = useCurrentTeacher();
  const principal = useCurrentPrincipal();
  const { selectedCollegeId } = useAuth();
  const { toast } = useToast();

  const effectiveCollegeId = teacher?.collegeId || principal?.collegeId || selectedCollegeId || '';

  const [collegeInfo, setCollegeInfo] = useState<{
    name: string;
    logoUrl?: string;
    logo2Url?: string;
    code?: string;
    address?: string;
  } | null>(null);
  const [collegeLogoBase64, setCollegeLogoBase64] = useState<string | null>(null);
  const [collegeLogo2Base64, setCollegeLogo2Base64] = useState<string | null>(null);

  // Sync logged-in institution's college info
  useEffect(() => {
    if (!effectiveCollegeId) return;

    const unsub = onSnapshot(
      doc(db, 'colleges', effectiveCollegeId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCollegeInfo({
            name: data.name || '',
            logoUrl: data.logoUrl || data.logo || undefined,
            logo2Url: data.logo2Url || undefined,
            code: data.code || undefined,
            address: data.address || undefined,
          });
        }
      },
      (err) => {
        console.error('Error fetching college info for OMR:', err);
      }
    );

    return () => unsub();
  }, [effectiveCollegeId]);

  // Convert college logo 1 to base64
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

  // Convert college logo 2 to base64
  useEffect(() => {
    if (!collegeInfo?.logo2Url) {
      setCollegeLogo2Base64(null);
      return;
    }

    let active = true;
    const convert = async () => {
      const b64 = await getBase64ImageFromUrl(collegeInfo.logo2Url!);
      if (active) {
        setCollegeLogo2Base64(b64);
      }
    };
    convert();
    return () => {
      active = false;
    };
  }, [collegeInfo?.logo2Url]);

  // Tab state
  const [activeTab, setActiveTab] = useState('generate');

  // PDF JS Loader state
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);

  // --- GENERATOR STATE ---
  const [testName, setTestName] = useState('Surprise Test');
  const [rollNumberLength, setRollNumberLength] = useState(7);
  const [numSubjects, setNumSubjects] = useState(1);
  const [subjectsConfig, setSubjectsConfig] = useState([
    { name: 'Subject 1', questionCount: 25 },
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
  const [updatingMarkingRules, setUpdatingMarkingRules] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState(false);

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
  const [imageSubTab, setImageSubTab] = useState<'parsed' | 'original'>('original');

  // ML Trainer & Active Learning Evaluator States
  const [mlStatus, setMlStatus] = useState<{
    model_loaded: boolean;
    total_labeled_samples: number;
    unlabelled_samples: number;
    last_trained: string;
    training_accuracy: number;
    loss: number;
  } | null>(null);
  const [isMLTraining, setIsMLTraining] = useState(false);
  const [isMLScanning, setIsMLScanning] = useState(false);
  const [mlEvaluatorFile, setMlEvaluatorFile] = useState<File | null>(null);
  const [mlEvaluatorResults, setMlEvaluatorResults] = useState<any | null>(null);
  const [mlUserCorrections, setMlUserCorrections] = useState<Record<string, string>>({});
  const [mlSubmittingFeedback, setMlSubmittingFeedback] = useState(false);
  const [isFetchingMLStatus, setIsFetchingMLStatus] = useState(false);
  const [manualRotation, setManualRotation] = useState(0); // degrees, -45 to +45
  const [appliedRotation, setAppliedRotation] = useState(0); // angle applied in current result
  const [showVirtualCorners, setShowVirtualCorners] = useState(true); // virtual corner guide boxes
  const [cornerInsetX, setCornerInsetX] = useState(-1.5); // Outward X offset for corner boxes
  const [cornerInsetY, setCornerInsetY] = useState(-1.0); // Outward Y offset for corner boxes
  const [cornerBoxSize, setCornerBoxSize] = useState(53); // Target box size in px (default 53px)

  // Dataset Samples Viewer state
  const [isDatasetViewerOpen, setIsDatasetViewerOpen] = useState(false);
  const [datasetData, setDatasetData] = useState<{
    total: number;
    filled_count: number;
    unfilled_count: number;
    samples: Array<{ name: string; label: 'filled' | 'unfilled'; base64Image: string }>;
  } | null>(null);
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [datasetCategory, setDatasetCategory] = useState<'all' | 'filled' | 'unfilled'>('all');
  const [datasetOffset, setDatasetOffset] = useState(0);

  const fetchDatasetSamples = async (category = datasetCategory, offset = datasetOffset) => {
    try {
      setIsLoadingDataset(true);
      const data = await getOMRMLDatasetSamples(60, offset, category);
      setDatasetData(data);
    } catch (err: any) {
      console.error("Failed to fetch dataset samples:", err);
      toast({
        title: "Failed to load samples",
        description: err.message || "Error reading dataset samples",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const handleOpenDatasetViewer = () => {
    setIsDatasetViewerOpen(true);
    setDatasetOffset(0);
    setDatasetCategory('all');
    fetchDatasetSamples('all', 0);
  };

  const fetchMLStatus = async (showToast = false) => {
    try {
      setIsFetchingMLStatus(true);
      const status = await getOMRMLStatus();
      setMlStatus(status);
      if (showToast) {
        toast({
          title: "Metrics Refreshed",
          description: `Total Samples: ${status.total_labeled_samples}, Accuracy: ${status.training_accuracy}%`,
        });
      }
    } catch (err: any) {
      console.error("Failed to fetch ML status:", err);
      if (showToast) {
        toast({
          title: "Refresh Failed",
          description: err.message || "Could not fetch ML status.",
          variant: "destructive",
        });
      }
    } finally {
      setIsFetchingMLStatus(false);
    }
  };

  useEffect(() => {
    fetchMLStatus();
  }, []);

  const handleTrainMLModelAction = async () => {
    try {
      setIsMLTraining(true);
      toast({
        title: "Fine-Tuning PyTorch ML Model...",
        description: "Training neural network weights on active OMR dataset samples.",
      });
      const res = await trainOMRMLModel(5, 0.001);
      toast({
        title: "ML Model Fine-Tuned!",
        description: `Training completed. Accuracy: ${res.metrics.training_accuracy}%, Total Samples: ${res.metrics.total_samples}`,
      });
      await fetchMLStatus();
    } catch (err: any) {
      toast({
        title: "Training Failed",
        description: err.message || "Could not fine-tune PyTorch model.",
        variant: "destructive",
      });
    } finally {
      setIsMLTraining(false);
    }
  };

  const handleScanMLSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMlEvaluatorFile(file);
    setIsMLScanning(true);
    setMlUserCorrections({});
    setManualRotation(0);
    setAppliedRotation(0);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = reader.result as string;
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');

        const subList = selectedExam
          ? selectedExam.subjects
          : subjectsConfig.map((s: { name: string; questionCount: number }) => ({ name: s.name, questionCount: s.questionCount }));
        const optList = selectedExam ? selectedExam.options : answerOptions.split(',').map(s => s.trim());
        const rLen = rollNumberLength;

        const valRes = await valuateOMRSheet({
          base64Pdf: isPdf ? b64 : undefined,
          base64Image: !isPdf ? b64 : undefined,
          pageNumber: 1,
          subjects: subList,
          options: optList,
          rollNumberLength: rLen,
        });

        setMlEvaluatorResults(valRes);
        setIsMLScanning(false);
        toast({
          title: "OMR Sheet Parsed via PyTorch Engine",
          description: "Inspect the detected answers below and correct any misclassified bubbles.",
        });
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsMLScanning(false);
      toast({
        title: "Parsing Failed",
        description: err.message || "Failed to scan sheet.",
        variant: "destructive",
      });
    }
  };

  const handleReparseWithRotation = async () => {
    if (!mlEvaluatorFile) return;

    // Capture angle to apply immediately
    const angleToApply = manualRotation;

    setIsMLScanning(true);
    setMlUserCorrections({});
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = reader.result as string;
        const isPdf = mlEvaluatorFile.name.toLowerCase().endsWith('.pdf') || mlEvaluatorFile.type.includes('pdf');
        const subList = selectedExam
          ? selectedExam.subjects
          : subjectsConfig.map((s: { name: string; questionCount: number }) => ({ name: s.name, questionCount: s.questionCount }));
        const optList = selectedExam ? selectedExam.options : answerOptions.split(',').map(s => s.trim());
        const rLen = rollNumberLength;
        const valRes = await valuateOMRSheet({
          base64Pdf: isPdf ? b64 : undefined,
          base64Image: !isPdf ? b64 : undefined,
          pageNumber: 1,
          subjects: subList,
          options: optList,
          rollNumberLength: rLen,
          rotationAngle: angleToApply,
        });
        setMlEvaluatorResults(valRes);
        setAppliedRotation(angleToApply);
        setIsMLScanning(false);
        toast({ title: 'Re-parsed with rotation', description: `Applied ${angleToApply > 0 ? '+' : ''}${angleToApply}° manual rotation.` });
      };
      reader.readAsDataURL(mlEvaluatorFile);
    } catch (err: any) {
      setIsMLScanning(false);
      toast({ title: 'Re-parse Failed', description: err.message || 'Failed to re-scan sheet.', variant: 'destructive' });
    }
  };


  const handleCorrectOption = (key: string, newOption: string) => {
    setMlUserCorrections(prev => ({ ...prev, [key]: newOption }));
  };

  const handleSubmitMLCorrections = async () => {
    if (Object.keys(mlUserCorrections).length === 0) {
      toast({
        title: "No Corrections Selected",
        description: "Click on any question option below to modify and flag hard-negative mistake samples.",
      });
      return;
    }

    try {
      setMlSubmittingFeedback(true);
      toast({
        title: "Submitting Feedback & Training...",
        description: `Submitting ${Object.keys(mlUserCorrections).length} mistake correction samples to PyTorch pipeline.`,
      });

      for (const [key, correctedVal] of Object.entries(mlUserCorrections)) {
        if (mlEvaluatorResults?.scannedImage) {
          await submitOMRMLFeedback(
            mlEvaluatorResults.scannedImage,
            correctedVal === 'EMPTY' ? 'unfilled' : 'filled',
            `correction_${key}_${Date.now()}.png`
          );
        }
      }

      await trainOMRMLModel(5, 0.001);
      await fetchMLStatus();
      setMlSubmittingFeedback(false);

      toast({
        title: "Regression Learning Complete!",
        description: `PyTorch model successfully learned from ${Object.keys(mlUserCorrections).length} mistake samples. Model retrained!`,
      });
    } catch (err: any) {
      setMlSubmittingFeedback(false);
      toast({
        title: "Feedback Submission Failed",
        description: err.message || "Error submitting feedback",
        variant: "destructive",
      });
    }
  };

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
    if (!effectiveCollegeId) return;

    const qExams = query(
      collection(db, 'omr_exams'),
      where('collegeId', '==', effectiveCollegeId)
    );

    const unsub = onSnapshot(qExams, (snap) => {
      const examsList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OMRExam));
      setExams(examsList);
    });

    return () => unsub();
  }, [effectiveCollegeId]);

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
      if (exam.subjects && exam.subjects.length > 0) {
        setNumSubjects(exam.subjects.length);
        setSubjectsConfig(exam.subjects.map((s) => ({ name: s.name, questionCount: s.questionCount })));
      }
      if (exam.options && exam.options.length > 0) {
        setAnswerOptions(exam.options.join(','));
      }
      if (exam.rollNumberLength) {
        setRollNumberLength(exam.rollNumberLength);
      }
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
        collegeLogo2Base64: collegeLogo2Base64 || undefined,
        collegeCode: collegeInfo?.code,
        collegeAddress: collegeInfo?.address,
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
  }, [pdfJsLoaded, collegeLogoBase64, collegeLogo2Base64, collegeInfo?.name]);

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
        collegeLogo2Base64: collegeLogo2Base64 || undefined,
        collegeCode: collegeInfo?.code,
        collegeAddress: collegeInfo?.address,
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

  // Helper to extract page from PDF as Base64 Image (crisp 2.0 scale for high text legibility)
  const convertPdfPageToImage = async (file: File, pageNum: number): Promise<string> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF viewer engine not loaded yet. Please wait a few seconds and try again.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);

    const viewport = page.getViewport({ scale: 2.0 }); // Crisp ~150-200 DPI resolution for sharp text & handwriting
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to create canvas context.');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  // Helper to compress base64 image strings to stay safely under Firestore 1MB document limit while keeping 1200px sharpness
  const compressBase64Image = (base64Str: string, maxWidth = 1200, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
      img.src = base64Str;
    });
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
        // Read the raw PDF bytes for high-quality 300 DPI server-side processing
        base64Pdf = await convertImageToBase64(file);
        // Also render a client-side preview (lower quality, for fallback display only)
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

      // BUG FIX: Always pass base64Pdf when the file is a PDF (same as ML Trainer section).
      // Previously, if client-side preview rendered successfully, base64Pdf was never sent —
      // the adapter would receive only a degraded ~87 DPI JPEG instead of the full-quality
      // 300 DPI server-side render, causing inaccurate bubble detection on the key sheet.
      const parsed = await valuateOMRSheet({
        base64Pdf: isPdf ? base64Pdf : undefined,
        base64Image: !isPdf ? base64Image : undefined,
        pageNumber: isPdf ? 1 : undefined,
        subjects: subjectsObj,
        options,
        rollNumberLength: rNumLen,
      });

      const normalized = normalizeAnswersCasing(parsed.answers, subjectsObj);
      setDetectedKeyAnswers(normalized);
      // BUG FIX: Show the processed/annotated image returned by the Python adapter
      // (deskewed + corner-warped) instead of the raw client-side preview image.
      // Fall back to client preview only if the adapter didn't return a scanned image.
      setUploadedKeySheetUrl(parsed.scannedImage || base64Image || null);
      setKeyEditMode(true);

      // Dynamically update active exam object so UI immediately renders custom scanned subjects
      setSelectedExam((prev) => {
        const baseExam = prev || {
          id: selectedExamId || 'draft',
          testName,
          subjects: subjectsObj,
          options,
          rollNumberLength: rNumLen,
          keyAnswers: normalized,
          correctMarks,
          negativeMarks,
          teacherId: teacher?.id || 'unknown',
          collegeId: teacher?.collegeId || 'unknown',
          createdAt: new Date().toISOString(),
        };
        return {
          ...baseExam,
          subjects: subjectsObj,
          keyAnswers: normalized,
        };
      });

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

  // Case-insensitive & whitespace-agnostic subject map lookup helper
  const getKeyForSubject = (answersMap: Record<string, Record<string, string>> | undefined, targetName: string) => {
    if (!answersMap || typeof answersMap !== 'object') return {};
    if (answersMap[targetName]) return answersMap[targetName];
    const targetClean = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const foundKey = Object.keys(answersMap).find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === targetClean
    );
    return foundKey ? answersMap[foundKey] : {};
  };

  // Valuation calculation for single student response against exam key
  const scoreStudentSheet = (studentAnswers: Record<string, Record<string, string>>, customExam?: OMRExam | null) => {
    const examToUse = customExam || selectedExam;
    if (!examToUse || !examToUse.keyAnswers) return { score: 0, correct: 0, incorrect: 0, unattempted: 0, maxScore: 0 };

    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let maxScore = 0;

    const corrM = customExam?.correctMarks ?? examToUse.correctMarks ?? correctMarks ?? 1;
    const negM = customExam?.negativeMarks ?? examToUse.negativeMarks ?? negativeMarks ?? 0;

    (examToUse.subjects || []).forEach((subj) => {
      const keyObj = getKeyForSubject(examToUse.keyAnswers, subj.name);
      const studObj = getKeyForSubject(studentAnswers, subj.name);

      for (let q = 1; q <= subj.questionCount; q++) {
        const correctOpt = (keyObj[String(q)] || keyObj[String(q).padStart(3, '0')] || '').trim().toUpperCase();
        const studentOpt = (studObj[String(q)] || studObj[String(q).padStart(3, '0')] || '').trim().toUpperCase();

        // If key answer is not filled, it doesn't count towards marks
        if (!correctOpt) continue;

        maxScore += corrM;

        if (!studentOpt) {
          unattempted++;
        } else if (studentOpt === correctOpt) {
          correct++;
        } else {
          incorrect++;
        }
      }
    });

    const score = (correct * corrM) - (incorrect * negM);
    return { score, correct, incorrect, unattempted, maxScore };
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
      setSelectedExam(examData);
      setKeyEditMode(false);

      // Recalculate existing student results if key/marks were changed and saved
      if (studentResults.length > 0) {
        const updatePromises = studentResults.map(async (res) => {
          const { score, correct, incorrect, unattempted, maxScore } = scoreStudentSheet(res.answers, examData);
          await updateDoc(doc(db, 'omr_results', res.id), {
            score,
            correctCount: correct,
            incorrectCount: incorrect,
            unattemptedCount: unattempted,
            maxScore,
          });
        });
        await Promise.all(updatePromises);
      }

      toast({
        title: 'Exam Key Saved',
        description: studentResults.length > 0
          ? `Answer key & configuration saved. Recalculated scores for ${studentResults.length} student result(s).`
          : 'Answer key and configuration saved to the cloud successfully.',
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

  // Dedicated update handler for Scoring Metrics / Marking Rules
  const handleUpdateMarkingRules = async () => {
    if (!selectedExamId || !selectedExam) {
      toast({
        variant: 'destructive',
        title: 'No Exam Selected',
        description: 'Please select an exam first to update marking rules.',
      });
      return;
    }

    try {
      setUpdatingMarkingRules(true);

      const updatedExam: OMRExam = {
        ...selectedExam,
        correctMarks,
        negativeMarks,
        rollNumberLength,
      };

      // 1. Update marking rules and roll number length in Firestore omr_exams document
      await updateDoc(doc(db, 'omr_exams', selectedExamId), {
        correctMarks,
        negativeMarks,
        rollNumberLength,
      });

      setSelectedExam(updatedExam);

      // 2. Recalculate scores for all existing student results for this exam
      let updatedCount = 0;
      if (studentResults.length > 0) {
        const updatePromises = studentResults.map(async (res) => {
          const { score, correct, incorrect, unattempted, maxScore } = scoreStudentSheet(res.answers, updatedExam);
          await updateDoc(doc(db, 'omr_results', res.id), {
            score,
            correctCount: correct,
            incorrectCount: incorrect,
            unattemptedCount: unattempted,
            maxScore,
          });
          updatedCount++;
        });

        await Promise.all(updatePromises);
      }

      toast({
        title: 'Marking Rules Updated',
        description: studentResults.length > 0
          ? `Updated marking rules (+${correctMarks} / -${negativeMarks}). Recalculated scores for ${updatedCount} student record(s).`
          : `Updated marking rules (+${correctMarks} / -${negativeMarks}) successfully.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: e.message || 'Failed to update marking rules.',
      });
    } finally {
      setUpdatingMarkingRules(false);
    }
  };

  // Explicit Re-evaluate All Results handler for student sheets
  const handleReevaluateAllResults = async () => {
    if (!selectedExamId || !selectedExam) {
      toast({
        variant: 'destructive',
        title: 'No Exam Selected',
        description: 'Please select an exam first to re-evaluate sheets.',
      });
      return;
    }

    if (studentResults.length === 0) {
      toast({
        title: 'No Records Found',
        description: 'There are currently no evaluated student sheets to re-evaluate.',
      });
      return;
    }

    try {
      setIsReevaluating(true);
      toast({
        title: 'Re-evaluation Started',
        description: `Re-grading ${studentResults.length} student sheet(s) against active key & scoring rules...`,
      });

      const activeExam: OMRExam = {
        ...selectedExam,
        keyAnswers: Object.keys(detectedKeyAnswers).length > 0 ? detectedKeyAnswers : (selectedExam.keyAnswers || {}),
        correctMarks,
        negativeMarks,
      };

      const updatePromises = studentResults.map(async (res) => {
        const { score, correct, incorrect, unattempted, maxScore } = scoreStudentSheet(res.answers, activeExam);
        await updateDoc(doc(db, 'omr_results', res.id), {
          score,
          correctCount: correct,
          incorrectCount: incorrect,
          unattemptedCount: unattempted,
          maxScore,
          evaluatedAt: new Date().toISOString(),
        });
      });

      await Promise.all(updatePromises);

      toast({
        title: 'Re-evaluation Complete',
        description: `Successfully re-graded ${studentResults.length} student sheet(s) with updated key answers and marking rules.`,
      });
    } catch (err: any) {
      console.error('Re-evaluation error:', err);
      toast({
        variant: 'destructive',
        title: 'Re-evaluation Failed',
        description: err.message || 'An error occurred during re-evaluation.',
      });
    } finally {
      setIsReevaluating(false);
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
      const rollLen = rollNumberLength > 0 ? rollNumberLength : (selectedExam.rollNumberLength || 2);

      // Cache the full class list once before the loop to avoid re-fetching on every page.
      // This also significantly reduces Firestore read pressure during batch valuation.
      let classCache: Record<string, { className: string }> = {};
      try {
        const qClasses = query(
          collection(db, 'classes'),
          where('collegeId', '==', selectedExam.collegeId)
        );
        const classSnap = await getDocs(qClasses);
        classSnap.docs.forEach(d => {
          classCache[d.id] = { className: d.data().name || '' };
        });
      } catch (err) {
        console.warn('Could not pre-fetch class list:', err);
      }

      // Helper: write a Firestore document with exponential backoff retry.
      // Prevents "Write stream exhausted" errors when Firestore throttles rapid writes.
      const setDocWithRetry = async (ref: any, data: any, maxRetries = 4) => {
        let delay = 600; // ms — start conservative
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            await setDoc(ref, data);
            return;
          } catch (err: any) {
            const isExhausted =
              err?.message?.includes('resource-exhausted') ||
              err?.message?.includes('Write stream exhausted') ||
              err?.code === 'resource-exhausted';
            if (isExhausted && attempt < maxRetries) {
              console.warn(`Firestore write throttled (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
              delay = Math.min(delay * 2, 8000); // exponential backoff, cap at 8s
            } else {
              throw err; // re-throw non-retriable or final attempt
            }
          }
        }
      };

      for (let p = 1; p <= pageCount; p++) {
        setCurrentProcessingPage(p);
        setValuationProgress(Math.round(((p - 1) / pageCount) * 100));

        // Render page to image (kept for Firestore student preview display)
        const pageImage = await convertPdfPageToImage(file, p);

        // Pass the raw PDF + page number so the Python adapter renders at 300 DPI server-side.
        const result = await valuateOMRSheet({
          base64Pdf: base64Pdf,
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

              if (studentData.classId && classCache[studentData.classId]) {
                // Use cached class data — no extra Firestore read needed
                const className = classCache[studentData.classId].className;
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
          } catch (err) {
            console.error('Error resolving student database info:', err);
          }
        }

        // Compress images at high crispness (1200px / 82%) to retain full legibility within Firestore limits.
        const compressedPageImage = await compressBase64Image(pageImage, 1200, 0.82);
        const compressedAnnotatedImage = result.scannedImage
          ? await compressBase64Image(result.scannedImage, 1200, 0.82)
          : undefined;

        // Save result doc to Firestore with retry backoff
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
          scannedImage: compressedPageImage,
          parsedAnnotatedImage: compressedAnnotatedImage,
        };

        await setDocWithRetry(doc(db, 'omr_results', resultId), resultDoc);

        // Inter-page cooldown: give Firestore write stream time to flush between pages.
        // Without this, rapid sequential writes overwhelm the queue on large PDFs.
        if (p < pageCount) {
          await new Promise(r => setTimeout(r, 400));
        }
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
    exportOMRResultsToExcel(filteredResults, selectedExam.testName, selectedExam);
    toast({
      title: 'Excel Download Started',
    });
  };

  // Calculate results metrics
  const totalSheets = studentResults.length;
  const avgScore = totalSheets > 0 ? (studentResults.reduce((acc, curr) => acc + curr.score, 0) / totalSheets).toFixed(1) : '0';
  const highestScore = totalSheets > 0 ? Math.max(...studentResults.map((r) => r.score)) : 0;
  const lowestScore = totalSheets > 0 ? Math.min(...studentResults.map((r) => r.score)) : 0;

  const topStudent = totalSheets > 0 ? studentResults.find((r) => r.score === highestScore) : null;
  const lowStudent = totalSheets > 0 ? studentResults.find((r) => r.score === lowestScore) : null;

  // Filter and sort valuation records by roll number (numerical & alphanumeric)
  const filteredResults = studentResults
    .filter(
      (r) =>
        r.studentName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.rollNumber?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        r.studentClass?.toLowerCase().includes(searchFilter.toLowerCase())
    )
    .sort((a, b) => {
      const rollA = (a.rollNumber || '').trim();
      const rollB = (b.rollNumber || '').trim();
      const numA = parseInt(rollA, 10);
      const numB = parseInt(rollB, 10);
      if (!isNaN(numA) && !isNaN(numB) && String(numA) === rollA && String(numB) === rollB) {
        return numA - numB;
      }
      return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
    });

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
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 max-w-2xl bg-muted/80 backdrop-blur border">
          <TabsTrigger value="generate" className="font-semibold">OMR Generator</TabsTrigger>
          <TabsTrigger value="valuate" className="font-semibold">OMR Valuation</TabsTrigger>
          <TabsTrigger value="ml-trainer" className="font-semibold flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
            <BrainCircuit className="w-3.5 h-3.5" /> ML Trainer & Evaluator
          </TabsTrigger>
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
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setRollNumberLength(val);
                        if (selectedExam) {
                          setSelectedExam((prev) => (prev ? { ...prev, rollNumberLength: val } : prev));
                        }
                      }}
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
                          placeholder={`Sub ${idx + 1}`}
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

                    <div className="space-y-1.5">
                      <Label htmlFor="valRollLen" className="text-xs font-semibold">Roll Number Size (Digits to Check)</Label>
                      <Input
                        id="valRollLen"
                        type="number"
                        min={0}
                        max={12}
                        value={rollNumberLength}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setRollNumberLength(val);
                          if (selectedExam) {
                            setSelectedExam((prev) => (prev ? { ...prev, rollNumberLength: val } : prev));
                          }
                        }}
                        className="h-9"
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        Set to <strong>2</strong> for 2-digit roll numbers (stops before Name/Subject fields), or <strong>6</strong> for 6-digit roll numbers.
                      </span>
                    </div>

                    <Button 
                      onClick={handleUpdateMarkingRules} 
                      disabled={updatingMarkingRules}
                      className="w-full h-8 text-xs bg-primary hover:bg-primary/90"
                    >
                      {updatingMarkingRules ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Updating & Recalculating...
                        </>
                      ) : (
                        'Save Configuration & Recalculate'
                      )}
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
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base text-yellow-800">Review Answer Key</CardTitle>
                        <CardDescription>Confirm correct options. Edit boxes to manually override scan values.</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {studentResults.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isReevaluating}
                            onClick={handleReevaluateAllResults}
                            className="h-8 text-xs border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white flex items-center gap-1.5"
                          >
                            <RotateCcw className={`h-3.5 w-3.5 ${isReevaluating ? 'animate-spin' : ''}`} />
                            {isReevaluating ? 'Re-evaluating...' : `Re-evaluate (${studentResults.length})`}
                          </Button>
                        )}
                        <Button size="sm" onClick={handleSaveExamKey} className="h-8 bg-yellow-600 hover:bg-yellow-700">
                          Verify & Commit Key
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 max-h-[300px] overflow-y-auto">
                    <div className="space-y-4">
                      {selectedExam.subjects.map((sub, subIndex) => {
                        const subKey = detectedKeyAnswers[sub.name] || {};
                        return (
                          <div key={sub.name} className="space-y-2 border-b pb-3">
                            <h3 className="text-xs font-bold text-primary">SUBJECT {subIndex + 1}</h3>
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
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-xs text-muted-foreground font-semibold">Highest Mark</span>
                      <span className="text-2xl font-bold font-headline text-green-600 mt-1">{highestScore}</span>
                      {topStudent && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px] mt-0.5" title={topStudent.studentName}>
                          {topStudent.studentName}
                        </span>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow border-primary/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <span className="text-xs text-muted-foreground font-semibold">Lowest Mark</span>
                      <span className="text-2xl font-bold font-headline text-red-500 mt-1">{lowestScore}</span>
                      {lowStudent && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px] mt-0.5" title={lowStudent.studentName}>
                          {lowStudent.studentName}
                        </span>
                      )}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={handleReevaluateAllResults}
                          disabled={isReevaluating}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-primary text-primary hover:bg-primary hover:text-white flex items-center gap-1.5"
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${isReevaluating ? 'animate-spin' : ''}`} />
                          {isReevaluating ? 'Re-evaluating...' : 'Re-evaluate All Sheets'}
                        </Button>
                        <Button onClick={handleExportResults} size="sm" variant="outline" className="h-8 text-xs border-accent text-accent hover:bg-accent hover:text-white">
                          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Export results (Excel)
                        </Button>
                      </div>
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

        {/* ==================================== */}
        {/* TAB 3: ML MODEL TRAINER & EVALUATOR  */}
        {/* ==================================== */}
        <TabsContent value="ml-trainer" className="mt-4 space-y-6">

          {/* Top Regression & Active Learning Dashboard Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-500/5 via-background to-background shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Model Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-foreground">PyTorch CNN Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-500/5 via-background to-background shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Accuracy (Regression)</span>
                  <p className="text-base font-bold text-foreground mt-0.5">
                    {mlStatus ? `${mlStatus.training_accuracy}%` : '—'}
                    <span className="text-[10px] font-normal text-muted-foreground ml-1.5">Loss: {mlStatus ? mlStatus.loss : '0.0'}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-500/5 via-background to-background shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dataset Samples</span>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {mlStatus ? mlStatus.total_labeled_samples : 0} <span className="text-[10px] font-normal text-muted-foreground">patches</span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenDatasetViewer}
                  className="text-xs gap-1 border-amber-300 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 h-8"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </Button>
              </CardContent>
            </Card>

            <Card className="border-rose-200 dark:border-rose-900/50 bg-gradient-to-br from-rose-500/5 via-background to-background shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Corrections Logged</span>
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    {Object.keys(mlUserCorrections).length} <span className="text-[10px] font-normal text-muted-foreground">flagged</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/40 p-4 border rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-purple-600" />
                Active Learning & Continuous Model Fine-Tuning
              </h3>
              <p className="text-xs text-muted-foreground">
                Upload OMR sheets to visually verify predictions. Any manual correction you make is logged as a hard-negative sample to train the neural network to avoid repeating mistakes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMLStatus(true)}
                disabled={isFetchingMLStatus}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingMLStatus ? 'animate-spin' : ''}`} /> Refresh Metrics
              </Button>
              <Button
                size="sm"
                onClick={handleTrainMLModelAction}
                disabled={isMLTraining}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 shadow-sm"
              >
                {isMLTraining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                Fine-Tune PyTorch Model
              </Button>
            </div>
          </div>

          {/* Main Workspace: Left Upload & Image Viewer | Right Correction & Evaluator Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Column: Upload & Image Display (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="shadow-md border-purple-500/20">
                <CardHeader className="bg-purple-500/5 border-b pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Upload className="w-4 h-4" />
                    1. Upload OMR Sheet for Evaluation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Select a scanned PNG, JPG, or PDF sheet to parse and evaluate.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 bg-purple-50 dark:bg-purple-950/30 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="space-y-0.5">
                      <Label htmlFor="mlRollLen" className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                        Roll Number Size (Digits to Check)
                      </Label>
                      <span className="text-[10px] text-muted-foreground block">
                        Set to <strong>2</strong> for 2-digit roll numbers (skips name field), or <strong>6</strong> for 6-digit roll numbers
                      </span>
                    </div>
                    <Input
                      id="mlRollLen"
                      type="number"
                      min={0}
                      max={12}
                      value={rollNumberLength}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setRollNumberLength(val);
                        if (selectedExam) {
                          setSelectedExam((prev) => (prev ? { ...prev, rollNumberLength: val } : prev));
                        }
                      }}
                      className="w-20 h-8 text-xs text-center font-bold"
                    />
                  </div>

                  <div className="border-2 border-dashed border-purple-300 dark:border-purple-800 rounded-xl p-6 text-center cursor-pointer hover:bg-purple-500/5 transition relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleScanMLSheet}
                      disabled={isMLScanning}
                    />
                    {isMLScanning ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                        <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold">
                          PyTorch Vision Engine parsing sheet & extracting bubbles...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="h-8 w-8 text-purple-500/70" />
                        <span className="text-xs font-semibold text-foreground">
                          {mlEvaluatorFile ? mlEvaluatorFile.name : 'Drop OMR image / PDF or Click to upload'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Supports PNG, JPG, WEBP, and PDF scans
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Manual Rotation Slider — shown once a file is loaded */}
                  {mlEvaluatorFile && (
                    <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>
                          Manual Tilt Correction
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${manualRotation === 0 ? 'bg-muted text-muted-foreground' :
                              manualRotation > 0 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                                'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            }`}>
                            {manualRotation > 0 ? '+' : ''}{manualRotation}°
                          </span>
                          {manualRotation !== 0 && (
                            <button onClick={() => setManualRotation(0)} className="text-[10px] text-muted-foreground hover:text-foreground underline">
                              reset
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-7 text-right">−45°</span>
                        <input
                          type="range"
                          min={-45}
                          max={45}
                          step={0.5}
                          value={manualRotation}
                          onChange={e => setManualRotation(parseFloat(e.target.value))}
                          className="flex-1 h-2 accent-purple-600 cursor-pointer"
                        />
                        <span className="text-[10px] text-muted-foreground w-7">+45°</span>
                      </div>

                      <p className="text-[10px] text-muted-foreground">
                        Drag to preview rotation in the image below. Click <span className="font-semibold text-purple-600">Re-parse</span> to re-scan with this angle applied.
                      </p>

                      {manualRotation !== 0 && (
                        <Button
                          size="sm"
                          onClick={handleReparseWithRotation}
                          disabled={isMLScanning}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
                        >
                          {isMLScanning
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Re-parsing...</>
                            : <>Re-parse with {manualRotation > 0 ? '+' : ''}{manualRotation}° rotation</>
                          }
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Scanned Image Preview with Virtual 4-Corner Target Boxes */}
                  {mlEvaluatorResults?.scannedImage && (
                    <div className="space-y-2 border rounded-lg p-2 bg-muted/20">
                      {/* Header with Toggle & Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          Annotated Scanned Page
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Fine-Tuning Micro-Adjustment Controls */}
                          {showVirtualCorners && (
                            <div className="flex items-center gap-1 bg-background border px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                              <span>Box Inset:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCornerInsetX(prev => parseFloat((prev - 0.5).toFixed(1)));
                                  setCornerInsetY(prev => parseFloat((prev - 0.4).toFixed(1)));
                                }}
                                className="px-1 hover:bg-muted font-bold rounded"
                                title="Expand boxes outward"
                              >
                                ↗ Out
                              </button>
                              <span className="font-mono font-bold text-foreground">
                                {cornerInsetX}% / {cornerInsetY}%
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCornerInsetX(prev => parseFloat((prev + 0.5).toFixed(1)));
                                  setCornerInsetY(prev => parseFloat((prev + 0.4).toFixed(1)));
                                }}
                                className="px-1 hover:bg-muted font-bold rounded"
                                title="Nudge boxes inward"
                              >
                                ↙ In
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCornerInsetX(-1.5);
                                  setCornerInsetY(-1.0);
                                }}
                                className="px-1 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold rounded border border-purple-300 dark:border-purple-800 ml-1"
                                title="Auto-align to paper corner marks"
                              >
                                🎯 Align
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowVirtualCorners(!showVirtualCorners)}
                            className={`text-[10px] px-2 py-0.5 rounded font-mono border transition ${showVirtualCorners
                                ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                                : 'bg-muted text-muted-foreground border-transparent'
                              }`}
                          >
                            {showVirtualCorners ? '🎯 4 Virtual Boxes ON' : '🎯 Virtual Boxes OFF'}
                          </button>
                          {appliedRotation !== 0 && (
                            <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-mono">
                              Parsed Angle: {appliedRotation > 0 ? '+' : ''}{appliedRotation}°
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Alignment Status Banner */}
                      {mlEvaluatorResults.alignmentInfo && (
                        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded p-1.5 text-[11px]">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>
                              {mlEvaluatorResults.alignmentInfo.cornersDetected === 4
                                ? '4/4 Virtual Corner Boxes Matched & Auto-Aligned'
                                : `${mlEvaluatorResults.alignmentInfo.cornersDetected}/4 Corner Boxes Detected`}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-800 dark:text-emerald-200 font-mono">
                            {mlEvaluatorResults.alignmentInfo.warpApplied ? 'Warp Applied' : 'Auto-Deskewed'}
                          </span>
                        </div>
                      )}

                      {/* Scanned Sheet Container with Tight Shrink-Wrap for Exact Virtual 4-Corner Overlay */}
                      <div className="relative border shadow-sm bg-white rounded flex items-center justify-center p-2 min-h-[220px]">
                        <div className="relative inline-block overflow-hidden" style={{ maxHeight: 440 }}>
                          <img
                            src={mlEvaluatorResults.scannedImage}
                            alt="Scanned OMR Page"
                            style={{
                              transform: `rotate(${manualRotation}deg)`,
                              transition: 'transform 0.12s ease',
                              maxHeight: 440,
                              width: 'auto',
                              height: 'auto',
                              display: 'block',
                            }}
                          />

                          {/* Virtual 4-Corner Target Boxes Overlay */}
                          {showVirtualCorners && (
                            <div
                              className="absolute inset-0 pointer-events-none transition-transform duration-150"
                              style={{
                                transform: `rotate(${manualRotation}deg)`,
                                transformOrigin: 'center center',
                              }}
                            >
                              {[
                                { name: 'TL', left: `${(7.64 + cornerInsetX).toFixed(2)}%`, top: `${(5.40 + cornerInsetY).toFixed(2)}%` },
                                { name: 'TR', left: `${(92.36 - cornerInsetX).toFixed(2)}%`, top: `${(5.40 + cornerInsetY).toFixed(2)}%` },
                                { name: 'BL', left: `${(7.64 + cornerInsetX).toFixed(2)}%`, top: `${(94.60 - cornerInsetY).toFixed(2)}%` },
                                { name: 'BR', left: `${(92.36 - cornerInsetX).toFixed(2)}%`, top: `${(94.60 - cornerInsetY).toFixed(2)}%` },
                              ].map((corner) => {
                                const isMatched = (mlEvaluatorResults?.alignmentInfo?.cornersDetected ?? 4) >= 3;
                                return (
                                  <div
                                    key={corner.name}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                                    style={{ left: corner.left, top: corner.top }}
                                  >
                                    {/* Virtual Target Reticle Box */}
                                    <div
                                      className={`w-[55px] h-[55px] rounded-lg border-2 flex items-center justify-center transition-all ${isMatched
                                          ? 'border-emerald-500 bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                                          : 'border-purple-500 bg-purple-500/25 shadow-[0_0_12px_rgba(168,85,247,0.8)] animate-pulse'
                                        }`}
                                    >
                                      <div className={`w-2.5 h-2.5 rounded-full ${isMatched ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                                    </div>

                                    {/* Target Label Tag */}
                                    <span
                                      className={`absolute text-[7px] font-mono font-bold px-1 rounded whitespace-nowrap shadow-sm ${corner.name.startsWith('T') ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
                                        } ${corner.name.endsWith('L') ? 'left-0' : 'right-0'
                                        } ${isMatched
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-purple-600 text-white'
                                        }`}
                                    >
                                      {corner.name} 🎯
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Interactive Answer Evaluator & Correction Grid (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="shadow-md border-purple-500/20">
                <CardHeader className="bg-purple-500/5 border-b pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-300">
                      <CheckCircle className="w-4 h-4" />
                      2. Interactive Evaluator & Correction Grid
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Click option buttons below to correct misclassified bubbles.
                    </CardDescription>
                  </div>
                  {Object.keys(mlUserCorrections).length > 0 && (
                    <span className="text-xs font-bold bg-amber-500 text-white px-2.5 py-1 rounded-full animate-bounce">
                      {Object.keys(mlUserCorrections).length} Corrections Ready
                    </span>
                  )}
                </CardHeader>

                <CardContent className="p-4 space-y-6">
                  {mlEvaluatorResults ? (
                    <>
                      {/* Candidate Roll Number Header */}
                      <div className="flex items-center justify-between p-3 bg-muted/40 border rounded-lg text-xs">
                        <div>
                          <span className="text-muted-foreground block font-medium">Candidate Roll Number</span>
                          <span className="font-bold text-foreground text-sm">
                            {mlEvaluatorResults.rollNumber || 'Not Detected'}
                          </span>
                        </div>
                        {mlEvaluatorResults.mlAnalysis && (
                          <div className="text-right">
                            <span className="text-muted-foreground block font-medium">PyTorch Model Status</span>
                            <span className="font-semibold text-purple-600 dark:text-purple-400">
                              {mlEvaluatorResults.mlAnalysis.status}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Question Answer Correction Grid */}
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {Object.entries(mlEvaluatorResults.answers || {}).map(([subName, qMap]: [string, any], subIndex: number) => (
                          <div key={subName} className="space-y-2 border p-3 rounded-lg bg-background">
                            <div className="flex items-center justify-between border-b pb-1.5">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                {subName}
                              </h4>
                              <span className="text-[10px] text-muted-foreground">
                                Click option to correct misclassifications
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {Object.entries(qMap).map(([qNum, rawVal]: [string, any]) => {
                                const corrKey = `${subName}.${qNum}`;
                                const activeVal = mlUserCorrections[corrKey] !== undefined ? mlUserCorrections[corrKey] : rawVal;
                                const isCorrected = mlUserCorrections[corrKey] !== undefined && mlUserCorrections[corrKey] !== rawVal;

                                return (
                                  <div
                                    key={qNum}
                                    className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${isCorrected
                                        ? 'bg-amber-500/10 border-amber-400 dark:border-amber-700'
                                        : 'bg-muted/30 border-muted'
                                      }`}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-muted-foreground">Q{qNum}:</span>
                                      <span className={`font-extrabold px-1.5 py-0.5 rounded text-[11px] ${isCorrected
                                          ? 'bg-amber-500 text-white'
                                          : activeVal
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {activeVal || 'BLANK'}
                                      </span>
                                      {isCorrected && (
                                        <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                          (Corrected)
                                        </span>
                                      )}
                                    </div>

                                    {/* Option Selector Buttons */}
                                    <div className="flex items-center gap-1">
                                      {['A', 'B', 'C', 'D'].map((opt) => (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => handleCorrectOption(corrKey, opt)}
                                          className={`h-6 w-6 rounded text-[10px] font-bold transition-all ${activeVal === opt
                                              ? 'bg-purple-600 text-white shadow-sm scale-105'
                                              : 'bg-muted/80 text-foreground hover:bg-purple-500/20'
                                            }`}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => handleCorrectOption(corrKey, '')}
                                        className={`px-1.5 h-6 rounded text-[9px] font-semibold transition-all ${!activeVal
                                            ? 'bg-rose-500 text-white'
                                            : 'bg-muted/80 text-muted-foreground hover:bg-rose-500/20'
                                          }`}
                                      >
                                        Blank
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Submit Corrections Action Button */}
                      <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">
                          {Object.keys(mlUserCorrections).length > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {Object.keys(mlUserCorrections).length} mistake samples ready for active learning
                            </span>
                          ) : (
                            <span>All parsed answers match. Click options above to mark any errors.</span>
                          )}
                        </div>

                        <Button
                          onClick={handleSubmitMLCorrections}
                          disabled={mlSubmittingFeedback || Object.keys(mlUserCorrections).length === 0}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 shadow-md ml-auto"
                        >
                          {mlSubmittingFeedback ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <BrainCircuit className="w-3.5 h-3.5" />
                          )}
                          Train Model on Corrections
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
                      <BrainCircuit className="h-10 w-10 text-purple-400/50 animate-pulse" />
                      <h3 className="font-semibold text-foreground text-sm">Awaiting OMR Sheet Upload</h3>
                      <p className="text-xs max-w-sm">
                        Upload an OMR sheet scan in the left panel to display the candidate answer matrix and evaluate bubble classifications.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
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
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${modalTab === 'ledger'
                      ? 'bg-white shadow text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Response Ledger
                </button>
                <button
                  onClick={() => setModalTab('scanner')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${modalTab === 'scanner'
                      ? 'bg-white shadow text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Scanner Analysis
                </button>
                {selectedResult.scannedImage && (
                  <button
                    onClick={() => setModalTab('image')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors ${modalTab === 'image'
                        ? 'bg-white shadow text-primary font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Scanned OMR Sheet Image
                  </button>
                )}
              </div>

              {modalTab === 'image' && (selectedResult.parsedAnnotatedImage || selectedResult.scannedImage) ? (
                <div className="space-y-3">
                  <div className="flex justify-center gap-2 border-b pb-2">
                    {selectedResult.parsedAnnotatedImage && (
                      <Button
                        type="button"
                        size="sm"
                        variant={imageSubTab === 'parsed' ? 'default' : 'outline'}
                        onClick={() => setImageSubTab('parsed')}
                        className="h-7 text-xs font-semibold"
                      >
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                        Annotated Parsed OMR (Checked Bubbles)
                      </Button>
                    )}
                    {selectedResult.scannedImage && (
                      <Button
                        type="button"
                        size="sm"
                        variant={imageSubTab === 'original' || !selectedResult.parsedAnnotatedImage ? 'default' : 'outline'}
                        onClick={() => setImageSubTab('original')}
                        className="h-7 text-xs font-semibold"
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Original Scanned Image
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center p-3 bg-muted/20 border border-dashed rounded-lg gap-2">
                    <img
                      src={imageSubTab === 'parsed' && selectedResult.parsedAnnotatedImage ? selectedResult.parsedAnnotatedImage : selectedResult.scannedImage}
                      alt="Student OMR Sheet"
                      className="max-h-[52vh] object-contain shadow border rounded bg-white"
                    />
                    <span className="text-[10px] text-muted-foreground text-center font-medium">
                      {imageSubTab === 'parsed' && selectedResult.parsedAnnotatedImage
                        ? 'Checked OMR Sheet: Green/red markings drawn by OpenCV scanner engine showing detected bubble locations.'
                        : 'Original uploaded scanned student page used for grading.'}
                    </span>
                  </div>
                </div>
              ) : modalTab === 'scanner' ? (
                <div className="space-y-6">
                  <div className="bg-primary/5 border border-primary/10 p-3 rounded-lg text-xs text-primary/80">
                    <strong>OMR Scanning Analysis:</strong> This grid shows the raw output of the local PyTorch/OpenCV bubble classifier for each question on the student's sheet.
                  </div>
                  {selectedExam.subjects.map((sub, subIndex) => {
                    const studMap = selectedResult.answers[sub.name] || {};
                    return (
                      <div key={sub.name} className="space-y-3">
                        <h3 className="text-xs font-bold text-primary border-b pb-1 uppercase">Subject {subIndex + 1}</h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {Array.from({ length: sub.questionCount }, (_, i) => i + 1).map((q) => {
                            const studentVal = studMap[String(q)] || '';
                            return (
                              <div key={q} className="flex items-center justify-between bg-muted/40 border p-2 rounded text-xs font-medium min-h-[38px]">
                                <span className="text-muted-foreground">Q{q}</span>
                                {studentVal ? (
                                  studentVal.length > 1 ? (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border shadow-sm ${studentVal === 'INVALID'
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
              ) : (() => {
                  const liveScores = scoreStudentSheet(selectedResult.answers, selectedExam);
                  const finalScore = selectedResult.maxScore > 0 ? selectedResult.score : liveScores.score;
                  const finalMaxScore = selectedResult.maxScore > 0 ? selectedResult.maxScore : liveScores.maxScore;
                  const finalCorrectCount = selectedResult.maxScore > 0 ? selectedResult.correctCount : liveScores.correct;
                  const finalIncorrectCount = selectedResult.maxScore > 0 ? selectedResult.incorrectCount : liveScores.incorrect;
                  const finalUnattemptedCount = selectedResult.maxScore > 0 ? selectedResult.unattemptedCount : liveScores.unattempted;

                  return (
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
                          <span className="font-bold text-primary text-sm">{finalScore} / {finalMaxScore}</span>
                        </div>
                      </div>

                      {/* Stats overview */}
                      <div className="grid grid-cols-3 gap-3 text-center text-xs">
                        <div className="border p-2 rounded-lg bg-green-500/5 border-green-500/20 text-green-700">
                          <span className="font-bold text-base block">{finalCorrectCount}</span>
                          Correct Answers
                        </div>
                        <div className="border p-2 rounded-lg bg-red-500/5 border-red-500/20 text-red-600">
                          <span className="font-bold text-base block">{finalIncorrectCount}</span>
                          Incorrect Answers
                        </div>
                        <div className="border p-2 rounded-lg bg-slate-500/5 border-slate-500/20 text-slate-600">
                          <span className="font-bold text-base block">{finalUnattemptedCount}</span>
                          Unattempted
                        </div>
                      </div>

                      {/* Subject breakdowns list */}
                      <div className="space-y-4">
                        {selectedExam.subjects.map((sub, subIndex) => {
                          const keyMap = getKeyForSubject(selectedExam.keyAnswers, sub.name);
                          const studMap = getKeyForSubject(selectedResult.answers, sub.name);

                          return (
                            <div key={sub.name} className="border rounded-lg overflow-hidden">
                              <div className="bg-primary/10 px-3 py-2 text-xs font-bold text-primary border-b uppercase">
                                Subject {subIndex + 1} Response Ledger
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
                                      const correctVal = (keyMap[String(q)] || keyMap[String(q).padStart(3, '0')] || '').trim().toUpperCase();
                                      const studentVal = (studMap[String(q)] || studMap[String(q).padStart(3, '0')] || '').trim().toUpperCase();

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
                  );
                })()}

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
              {selectedExam.subjects.map((sub, subIndex) => {
                const subKey = (detectedKeyAnswers[sub.name] && Object.keys(detectedKeyAnswers[sub.name]).length > 0)
                  ? detectedKeyAnswers[sub.name]
                  : (selectedExam.keyAnswers[sub.name] || {});
                return (
                  <div key={sub.name} className="space-y-3">
                    <h3 className="text-sm font-bold text-primary border-b pb-1">SUBJECT {subIndex + 1}</h3>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {Array.from({ length: sub.questionCount }, (_, i) => i + 1).map((q) => {
                        const correctOpt = subKey[String(q)] || '';
                        return (
                          <div key={q} className="flex items-center justify-between bg-muted/40 border p-2 rounded text-xs font-medium min-h-[38px]">
                            <span className="text-muted-foreground">Q{q}</span>
                            {correctOpt ? (
                              correctOpt.length > 1 ? (
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border shadow-sm ${correctOpt === 'INVALID'
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

      {/* DATASET SAMPLES GALLERY DIALOG */}
      <Dialog open={isDatasetViewerOpen} onOpenChange={setIsDatasetViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl border-purple-500/20">
          <DialogHeader className="bg-purple-500/5 p-4 -mx-6 -mt-6 border-b flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-headline font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <Cpu className="h-5 w-5 text-purple-600" />
                Active Learning Dataset Patches ({datasetData?.total || mlStatus?.total_labeled_samples || 0} Samples)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Cropped 32x32 pixel bubble patches used to train and fine-tune the PyTorch CNN model.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Category Filter Tabs & Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={datasetCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => {
                    setDatasetCategory('all');
                    setDatasetOffset(0);
                    fetchDatasetSamples('all', 0);
                  }}
                  className="text-xs h-8"
                >
                  All ({datasetData ? datasetData.total : mlStatus?.total_labeled_samples || 0})
                </Button>
                <Button
                  size="sm"
                  variant={datasetCategory === 'filled' ? 'default' : 'outline'}
                  onClick={() => {
                    setDatasetCategory('filled');
                    setDatasetOffset(0);
                    fetchDatasetSamples('filled', 0);
                  }}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Filled ({datasetData?.filled_count || 0})
                </Button>
                <Button
                  size="sm"
                  variant={datasetCategory === 'unfilled' ? 'default' : 'outline'}
                  onClick={() => {
                    setDatasetCategory('unfilled');
                    setDatasetOffset(0);
                    fetchDatasetSamples('unfilled', 0);
                  }}
                  className="text-xs h-8"
                >
                  Unfilled ({datasetData?.unfilled_count || 0})
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={datasetOffset === 0 || isLoadingDataset}
                  onClick={() => {
                    const newOffset = Math.max(0, datasetOffset - 60);
                    setDatasetOffset(newOffset);
                    fetchDatasetSamples(datasetCategory, newOffset);
                  }}
                  className="text-xs h-8"
                >
                  Previous Page
                </Button>
                <span className="text-xs text-muted-foreground font-mono">
                  {datasetData?.total ? `${datasetOffset + 1}-${Math.min(datasetOffset + 60, datasetData.total)} of ${datasetData.total}` : '0'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!datasetData || datasetOffset + 60 >= datasetData.total || isLoadingDataset}
                  onClick={() => {
                    const newOffset = datasetOffset + 60;
                    setDatasetOffset(newOffset);
                    fetchDatasetSamples(datasetCategory, newOffset);
                  }}
                  className="text-xs h-8"
                >
                  Next Page
                </Button>
              </div>
            </div>

            {/* Grid of Bubble Image Patches */}
            {isLoadingDataset ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <span className="text-xs text-muted-foreground font-semibold">Loading 32x32 bubble patches from disk...</span>
              </div>
            ) : datasetData && datasetData.samples.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 max-h-[55vh] overflow-y-auto p-1">
                {datasetData.samples.map((s, idx) => (
                  <div key={idx} className="flex flex-col items-center p-2 rounded-lg border bg-card hover:shadow-md transition">
                    <img
                      src={s.base64Image}
                      alt={s.name}
                      className="w-12 h-12 object-contain bg-white rounded border border-slate-300 dark:border-slate-700 shadow-inner"
                    />
                    <span className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded uppercase ${s.label === 'filled'
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Info className="h-8 w-8 text-muted-foreground/60" />
                <span className="text-xs font-semibold">No dataset samples found for this category.</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
