'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Lock, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type Assessment = {
  subject: string;
  marks: number;
};

export default function AssessmentForm({
  initialAssessments,
  teacherSubject,
  availableSubjectNames = [],
  studentId,
  showAddButton = true,
}: {
  initialAssessments?: Assessment[] | null;
  teacherSubject: string;
  /** Subject names the teacher can add (e.g. from assigned subjects). Enables "Add assessment" flow. */
  availableSubjectNames?: string[];
  /** When set, Save Marks persists to Firestore students/{studentId}. */
  studentId?: string;
  /** When false, only show list and Save Marks (update only). Add assessment is on dashboard. */
  showAddButton?: boolean;
}) {
  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments ?? []);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMarks, setNewMarks] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setAssessments(initialAssessments ?? []);
  }, [initialAssessments]);

  const existingSubjects = (assessments ?? []).map((a) => a.subject);
  const subjectsToPick = availableSubjectNames.filter((s) => !existingSubjects.includes(s));
  const canAddFromList = subjectsToPick.length > 0;
  const canAddCustom = availableSubjectNames.length === 0;

  const handleMarksChange = (subject: string, value: string) => {
    const newAssessments = (assessments ?? []).map((a) => {
      if (a.subject === subject) {
        const newMarks = value === '' ? 0 : parseInt(value, 10);
        return { ...a, marks: isNaN(newMarks) ? 0 : newMarks };
      }
      return a;
    });
    setAssessments(newAssessments);
  };

  const handleAddAssessment = () => {
    const subject = canAddFromList ? newSubject : newSubject.trim();
    if (!subject) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select or enter a subject.' });
      return;
    }
    const marks = newMarks === '' ? 0 : parseInt(newMarks, 10);
    if (isNaN(marks) || marks < 0 || marks > 100) {
      toast({ variant: 'destructive', title: 'Error', description: 'Marks must be between 0 and 100.' });
      return;
    }
    if (existingSubjects.includes(subject)) {
      toast({ variant: 'destructive', title: 'Error', description: 'This subject already has an entry.' });
      return;
    }
    setAssessments((prev) => [...prev, { subject, marks }]);
    setNewSubject('');
    setNewMarks('');
    setAddDialogOpen(false);
    toast({ title: 'Assessment added', description: `Added ${subject} — ${marks} marks. Save to persist.` });
  };

  const handleSaveChanges = async () => {
    try {
      if (studentId) {
        await updateDoc(doc(db, 'students', studentId), { assessments: assessments ?? [] });
        toast({
          title: 'Marks Saved',
          description: "The student's assessment marks have been updated.",
        });
      } else {
        toast({
          title: 'Marks Saved',
          description: "The student's assessment marks have been updated.",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save assessment marks.',
      });
    }
  };

  const isEditable = (subject: string) => subject === teacherSubject;

  return (
    <div className="space-y-4">
      {(assessments ?? []).map((assessment) => (
        <div
          key={assessment.subject}
          className="grid grid-cols-3 items-center gap-4"
        >
          <Label htmlFor={assessment.subject} className="col-span-1 text-sm">
            {assessment.subject}
          </Label>
          <div className="col-span-2 relative">
            <Input
              id={assessment.subject}
              type="number"
              value={assessment.marks}
              onChange={(e) =>
                handleMarksChange(assessment.subject, e.target.value)
              }
              min="0"
              max="100"
              placeholder="0-100"
              disabled={!isEditable(assessment.subject)}
            />
            {!isEditable(assessment.subject) && (
              <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        {showAddButton && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add assessment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add internal marks</DialogTitle>
              <DialogDescription>
                Choose a subject and enter marks (0–100). Save marks after adding to persist.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {canAddFromList ? (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select value={newSubject} onValueChange={setNewSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectsToPick.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : canAddCustom ? (
                <div className="space-y-2">
                  <Label htmlFor="new-subject">Subject name</Label>
                  <Input
                    id="new-subject"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="e.g. Mathematics"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No more subjects available to add. All assigned subjects already have entries.
                </p>
              )}
              {(canAddFromList || canAddCustom) && (
                <div className="space-y-2">
                  <Label htmlFor="new-marks">Marks (0–100)</Label>
                  <Input
                    id="new-marks"
                    type="number"
                    min={0}
                    max={100}
                    value={newMarks}
                    onChange={(e) => setNewMarks(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddAssessment}
                disabled={
                  (!canAddFromList && !canAddCustom) ||
                  (canAddFromList && !newSubject) ||
                  (canAddCustom && !newSubject.trim())
                }
              >
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}

        <Button onClick={handleSaveChanges} className="gap-2">
          <Save className="h-4 w-4" />
          Save Marks
        </Button>
      </div>
    </div>
  );
}
