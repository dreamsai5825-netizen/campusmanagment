'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Separator } from './ui/separator';

interface ReportDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  planContent: string;
  subject: string;
  grade: string;
  topic: string;
  dateRange?: DateRange;
  teacherName?: string;
  courseCode?: string;
}

// Simple markdown parser to extract per-class breakdown items from the AI-generated plan.
const parsePlan = (content: string) => {
  if (!content) return [];

  // Prefer the "Per-class breakdown" section if present.
  const lower = content.toLowerCase();
  const markerIndex = lower.indexOf('per-class breakdown');
  const relevant = markerIndex >= 0 ? content.slice(markerIndex) : content;

  return relevant
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || /^\d+\.\s/.test(line))
    .map((line) => line.replace(/^(- |\d+\.\s)/, ''));
};

export function ReportDialog({
  isOpen,
  onOpenChange,
  planContent,
  subject,
  grade,
  topic,
  dateRange,
  teacherName = 'Teacher',
  courseCode,
}: ReportDialogProps) {
  const lessons = parsePlan(planContent);

  const handlePrint = () => {
    const printContent = document.getElementById('printable-report');
    if (printContent) {
      const printHtml = printContent.innerHTML;
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>Print Report</title>
              <style>
                body { font-family: sans-serif; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid black; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .header-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid black; padding-bottom: 1rem; }
                .plan-details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
                strong { font-weight: bold; }
              </style>
            </head>
            <body>${printHtml}</body>
          </html>
        `);
        newWindow.document.close();
        newWindow.print();
      }
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Lesson Delivery Plan, Execution Status and Progress Monitoring</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto px-6">
          <div id="printable-report" className="text-sm space-y-4 py-4">
            {/* Header section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 border-b pb-4 header-grid">
                <div><strong>Academic Year:</strong> {new Date().getFullYear()}-{(new Date().getFullYear() + 1).toString().slice(-2)} [Even-Sem]</div>
                <div><strong>Semester:</strong> {grade.replace(/[^0-9]/g, '') || 'IV'}</div>
                <div><strong>Name of the Staff Member:</strong> {teacherName}</div>
                <div><strong>Subject:</strong> {subject}</div>
                <div><strong>Course Code:</strong> {courseCode || '—'}</div>
                <div><strong>Hrs. required as per Syllabus:</strong> 40 hrs</div>
                <div><strong>Hrs. available as per COE:</strong> 50 hrs</div>
                <div className="md:col-span-3"><strong>Additional Classes required:</strong> 00</div>
            </div>

            {/* Main table */}
            <table className="w-full border-collapse border border-foreground">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-foreground p-2 text-center font-bold">Lesson Delivery Plan</th>
                  <th className="border border-foreground p-2 text-center font-bold">Execution Status</th>
                  <th className="border border-foreground p-2 text-center font-bold">Progress Monitoring</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="p-2 border border-foreground">
                    <strong>Module No: I.</strong> {topic}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="p-2 border border-foreground">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 plan-details-grid">
                      <span><strong>Planned Start Date:</strong> {dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : 'N/A'}</span>
                      <span><strong>Planned Completion Date:</strong> {dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : 'N/A'}</span>
                      <span><strong>Planned Hrs.:</strong> {lessons.length > 0 ? String(lessons.length).padStart(2, '0') : '06'}</span>
                      <span><strong>Engaged Hrs.:</strong></span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="p-0">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="border border-foreground p-1 w-[5%] font-bold">Class No.</th>
                          <th className="border border-foreground p-1 w-[35%] font-bold">Portion to be covered per hour</th>
                          <th className="border border-foreground p-1 w-[10%] font-bold">Engaged Date</th>
                          <th className="border border-foreground p-1 w-[10%] font-bold">Extra</th>
                          <th className="border border-foreground p-1 w-[30%] font-bold">Experiences worth noting</th>
                          <th className="border border-foreground p-1 w-[10%] font-bold">HOD Sign.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lessons.map((lesson, index) => (
                          <tr key={index}>
                            <td className="border border-foreground p-1 text-center h-16">{index + 1}</td>
                            <td className="border border-foreground p-1 align-top">{lesson}</td>
                            <td className="border border-foreground p-1"></td>
                            <td className="border border-foreground p-1"></td>
                            <td className="border border-foreground p-1"></td>
                            <td className="border border-foreground p-1"></td>
                          </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 6 - lessons.length) }).map((_, index) => (
                             <tr key={`empty-${index}`}>
                                <td className="border border-foreground p-1 text-center h-16">{lessons.length + index + 1}</td>
                                <td className="border border-foreground p-1"></td>
                                <td className="border border-foreground p-1"></td>
                                <td className="border border-foreground p-1"></td>
                                <td className="border border-foreground p-1"></td>
                                <td className="border border-foreground p-1"></td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <Separator />
        <DialogFooter className="p-6 pt-4">
            <Button variant="outline" onClick={handlePrint}>Print Report</Button>
            <DialogClose asChild>
                <Button>Close</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
