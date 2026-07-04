'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generatePlan } from '@/ai/flows/planning-flow';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { ReportDialog } from '@/components/report-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Class, Subject } from '@/lib/types';
import { getTeacherSubjectNames } from '@/lib/subject-utils';

type ReportFormData = {
  subject: string;
  grade: string;
  topic: string;
  courseCode?: string;
};

const extractCourseCode = (text?: string | null): string | undefined => {
  if (!text) return undefined;

  // Try explicit "Course Code: XXXX" pattern first
  const labeledMatch = text.match(/course\s*code\s*[:\-]?\s*([A-Za-z0-9\-]+)/i);
  if (labeledMatch?.[1]) {
    return labeledMatch[1].trim();
  }

  // Fallback: look for codes like "22MBAMM404" (2 digits + letters + digits)
  const genericMatch = text.match(/\b\d{2}[A-Za-z]{2,}[A-Za-z0-9]{2,}\b/);
  return genericMatch?.[0];
};

export default function CalendarPage() {
  const teacher = useCurrentTeacher();
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [semesterRange, setSemesterRange] = useState<DateRange | undefined>();
  const [semesterPlan, setSemesterPlan] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [formDataForReport, setFormDataForReport] = useState<ReportFormData>({
    subject: '',
    grade: '',
    topic: '',
    courseCode: undefined,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (!teacher?.collegeId) {
      setClasses([]);
      setSubjects([]);
      return;
    }

    const classesQuery = query(
      collection(db, 'classes'),
      where('collegeId', '==', teacher.collegeId)
    );
    const subjectsQuery = query(
      collection(db, 'subjects'),
      where('collegeId', '==', teacher.collegeId)
    );

    const unsubClasses = onSnapshot(classesQuery, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });
    const unsubSubjects = onSnapshot(subjectsQuery, (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject)));
    });

    return () => {
      unsubClasses();
      unsubSubjects();
    };
  }, [teacher?.collegeId]);

  const handleSave = () => {
    // In a real app, you'd save this to a database.
    console.log('Saving LDPR...');
    toast({
      title: 'Plan Saved',
      description: 'Your LDPR has been saved.',
    });
  };

  const handleGeneratePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGenerating(true);
    const formData = new FormData(e.currentTarget);
    const topic = formData.get('topic') as string;
    const subject = formData.get('subject') as string;
    const grade = formData.get('grade') as string;
    const customPrompt = formData.get('customPrompt') as string;
    const syllabusFile = formData.get('syllabus') as File;

    let syllabusContent: string | undefined = undefined;

    if (syllabusFile && syllabusFile.size > 0) {
      try {
        syllabusContent = await syllabusFile.text();
      } catch (error) {
        console.error('Error reading syllabus file:', error);
        toast({
          variant: 'destructive',
          title: 'File Read Error',
          description: 'Could not read the syllabus file. Please ensure it is a valid text file.',
        });
        setIsGenerating(false);
        return;
      }
    }

    const courseCode = extractCourseCode(syllabusContent);
    setFormDataForReport({ subject, grade, topic, courseCode });

    try {
      const result = await generatePlan({
        planType: 'semester-plan',
        topic,
        subject,
        grade,
        syllabusContent,
        customPrompt,
      });
      setSemesterPlan(result.plan);
      toast({
        title: 'Plan Generated',
        description: 'The AI has generated your plan.',
      });
    } catch (error) {
      console.error('Error generating plan:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: 'The AI failed to generate a plan. Please try again.',
      });
    } finally {
      setIsGenerating(false);
      // In a real app you might want to close the dialog here.
      // For this demo, we'll let the user close it manually.
      document
        .querySelector('[data-state="open"] [aria-label="Close"]')
        ?.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        );
    }
  };

  const AiGeneratorDialog = () => (
    <DialogContent>
      <form onSubmit={handleGeneratePlan}>
        <DialogHeader>
          <DialogTitle>Generate Plan with AI</DialogTitle>
          <DialogDescription>
            Provide some details for the AI to generate your LDPR.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <input type="hidden" name="planType" value="semester-plan" />
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              name="subject"
              placeholder="e.g., Mathematics"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">Grade</Label>
            <Input id="grade" name="grade" placeholder="e.g., Grade 8" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic">Topic / Focus</Label>
            <Input
              id="topic"
              name="topic"
              placeholder="e.g., Introduction to Algebra"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="syllabus">Syllabus (optional)</Label>
            <Input
              id="syllabus"
              name="syllabus"
              type="file"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customPrompt">Additional Instructions (optional)</Label>
            <Textarea
              id="customPrompt"
              name="customPrompt"
              placeholder="e.g., Focus on project-based learning activities."
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Plan'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );

  const currentYear = new Date().getFullYear();
  const academicYears = Array.from(
    { length: 5 },
    (_, i) => `${currentYear - 2 + i}-${(currentYear - 2 + i + 1).toString().slice(-2)}`
  );
  const hours = Array.from({ length: 100 }, (_, i) => i + 1);
  const teacherSubjectNames = teacher ? getTeacherSubjectNames(teacher, subjects) : [];
  const allocatedSubjects =
    teacherSubjectNames.length > 0
      ? teacherSubjectNames
      : [...new Set(classes.map((c) => c.subject).filter((s): s is string => Boolean(s)))];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Calendar &amp; Planner
        </h1>
        <p className="text-muted-foreground">
          Manage your schedule and long-duration plans.
        </p>
      </div>

      <div>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>LDPR</CardTitle>
                <CardDescription>
                  Structure your long-duration plan/report.
                </CardDescription>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'w-[300px] justify-start text-left font-normal',
                      !semesterRange && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {semesterRange?.from ? (
                      semesterRange.to ? (
                        <>
                          {format(semesterRange.from, 'LLL dd, y')} -{' '}
                          {format(semesterRange.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(semesterRange.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={semesterRange?.from}
                    selected={semesterRange}
                    onSelect={setSemesterRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="academic-year">Academic Year</Label>
                <Select>
                  <SelectTrigger id="academic-year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="semester">Semester</Label>
                <Select>
                  <SelectTrigger id="semester">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => i + 1).map((sem) => (
                      <SelectItem key={sem} value={String(sem)}>
                        {sem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-name">Name of the Staff</Label>
                <Input id="staff-name" value={teacher?.name ?? ''} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject-name">Subject Name</Label>
                <Select>
                  <SelectTrigger id="subject-name">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {allocatedSubjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-code">Course Code</Label>
                <Input id="course-code" placeholder="e.g., CS101" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hrs-syllabus">
                  Hrs. required as per Syllabus
                </Label>
                <Select>
                  <SelectTrigger id="hrs-syllabus">
                    <SelectValue placeholder="Select hours" />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hrs-coe">Hrs. available as per COE</Label>
                <Select>
                  <SelectTrigger id="hrs-coe">
                    <SelectValue placeholder="Select hours" />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="additional-classes">
                  Additional Classes required
                </Label>
                <Input id="additional-classes" placeholder="e.g., 5" />
              </div>
            </div>
            <Textarea
              placeholder="Lay out the LDPR..."
              rows={10}
              value={semesterPlan}
              onChange={(e) => setSemesterPlan(e.target.value)}
            />
          </CardContent>
          <CardFooter className="justify-between">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </Button>
              </DialogTrigger>
              <AiGeneratorDialog />
            </Dialog>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsReportDialogOpen(true)} disabled={!semesterPlan.trim()}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
              <Button onClick={handleSave}>Save LDPR</Button>
            </div>
          </CardFooter>
        </Card>
      </div>
      {isReportDialogOpen && (
        <ReportDialog
          isOpen={isReportDialogOpen}
          onOpenChange={setIsReportDialogOpen}
          planContent={semesterPlan}
          dateRange={semesterRange}
          subject={formDataForReport.subject}
          grade={formDataForReport.grade}
          topic={formDataForReport.topic}
          teacherName={teacher?.name ?? 'Teacher'}
          courseCode={formDataForReport.courseCode}
        />
      )}
    </div>
  );
}
