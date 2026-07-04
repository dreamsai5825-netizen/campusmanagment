'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash2, CalendarPlus, Upload, Settings2, Pencil, Merge, SplitSquareVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, setDoc, deleteDoc, doc, updateDoc, writeBatch, query, where } from 'firebase/firestore';
import { generateTimetableId } from '@/lib/id-utils';
import { parseTimetableFile } from '@/lib/parse-timetable-excel';
import { formatSlot12h, formatTime24to12 } from '@/lib/time-utils';
import type { Timetable, TimetableEvent, Class } from '@/lib/types';
import { useCurrentPrincipal } from '@/hooks/use-current-user';

const DEFAULT_TIME_SLOTS = ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '14:00 - 15:00', '15:00 - 16:00'];
const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSlotStartEnd(slot: string) {
  const [start = '', end = ''] = slot.split(' - ');
  return { start: start.trim(), end: end.trim() };
}

/** Parse "HH:mm" to minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h = '0', m = '0'] = t.trim().split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/** Format minutes since midnight to "HH:mm". */
function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Split a slot into 1-hour chunks. Returns null if slot is 1 hour or less. */
function splitSlotIntoHours(slot: string): string[] | null {
  const { start, end } = getSlotStartEnd(slot);
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const durationMin = endMin - startMin;
  if (durationMin <= 60) return null;
  const chunks: string[] = [];
  let cur = startMin;
  while (cur + 60 <= endMin) {
    chunks.push(`${minutesToTime(cur)} - ${minutesToTime(cur + 60)}`);
    cur += 60;
  }
  if (cur < endMin) chunks.push(`${minutesToTime(cur)} - ${minutesToTime(endMin)}`);
  return chunks.length > 1 ? chunks : null;
}

/** How many consecutive columns (time slots) this event spans. */
function getEventSpanInSlots(event: TimetableEvent, timeSlots: string[]): number {
  const slotStarts = timeSlots.map((s) => getSlotStartEnd(s).start);
  const idx = slotStarts.indexOf(event.startTime);
  if (idx === -1) return 1;
  let span = 0;
  let cur = event.startTime;
  const eventEnd = event.endTime;
  for (let i = idx; i < timeSlots.length; i++) {
    const { start, end: slotEnd } = getSlotStartEnd(timeSlots[i]);
    if (start !== cur) break;
    span++;
    cur = slotEnd;
    if (cur >= eventEnd) break;
  }
  return span || 1;
}


const EditSlotDialog = ({
  day,
  timeSlot,
  event,
  onSave,
  onRemove,
  classes,
}: {
  day: string;
  timeSlot: string;
  event: TimetableEvent | undefined;
  onSave: (text: string) => void;
  onRemove: () => void;
  classes: Class[];
}) => {
  const getInitialText = () => {
    if (!event) return '';
    if (event.customText) {
      return event.customText;
    }
    if (event.classId) {
      const eventClass = classes.find((c) => c.id === event.classId);
      return eventClass ? `${eventClass.subject} - ${eventClass.name}` : '';
    }
    return '';
  };
  const [text, setText] = useState(getInitialText());

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Edit Timetable Slot</DialogTitle>
        <DialogDescription>
          {day}, {formatSlot12h(timeSlot)}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="class-edit" className="text-right">
            Content
          </Label>
          <Input
            id="class-edit"
            className="col-span-3"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter class, subject, or event..."
          />
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        <div>
          {event && (
            <DialogClose asChild>
              <Button type="button" variant="destructive" onClick={onRemove}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </DialogClose>
          )}
        </div>
        <div className="flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="submit" onClick={() => onSave(text)}>
              Save changes
            </Button>
          </DialogClose>
        </div>
      </DialogFooter>
    </DialogContent>
  );
};

export default function TimetablePage() {
  const principal = useCurrentPrincipal();
  const { toast } = useToast();
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState('');
  const [isAddSlotDialogOpen, setAddSlotDialogOpen] = useState(false);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isManageSlotsOpen, setIsManageSlotsOpen] = useState(false);
  const [isManageDaysOpen, setIsManageDaysOpen] = useState(false);
  const [newTimetableName, setNewTimetableName] = useState('');
  const [newSlotStart, setNewSlotStart] = useState('');
  const [newSlotEnd, setNewSlotEnd] = useState('');
  const [newDayName, setNewDayName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTimetableName, setUploadTimetableName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [editSlotStart, setEditSlotStart] = useState('');
  const [editSlotEnd, setEditSlotEnd] = useState('');

  useEffect(() => {
    if (!principal?.collegeId) {
      setTimetables([]);
      setClasses([]);
      setSelectedTimetableId('');
      return;
    }
    const qTt = query(collection(db, 'timetables'), where('collegeId', '==', principal.collegeId));
    const unsubTimetables = onSnapshot(qTt, (snap) => {
      const ttData = snap.docs.map(doc => ({...doc.data(), id: doc.id} as Timetable));
      setTimetables(ttData);
      if (!selectedTimetableId && ttData.length > 0) {
        setSelectedTimetableId(ttData[0].id);
      }
    });
    const qClasses = query(collection(db, 'classes'), where('collegeId', '==', principal.collegeId));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      setClasses(snap.docs.map(doc => ({...doc.data(), id: doc.id} as Class)));
    });

    return () => {
      unsubTimetables();
      unsubClasses();
    };
  }, [principal?.collegeId, selectedTimetableId]);
  
  const selectedTimetable = useMemo(() => {
    return timetables.find((t) => t.id === selectedTimetableId);
  }, [timetables, selectedTimetableId]);

  const days = useMemo(() => {
    if (!selectedTimetable?.days?.length) return DEFAULT_DAYS;
    return selectedTimetable.days;
  }, [selectedTimetable]);

  const timeSlots = useMemo(() => {
    if (!selectedTimetable?.timeSlots?.length) return DEFAULT_TIME_SLOTS;
    return [...selectedTimetable.timeSlots].sort((a, b) =>
      getSlotStartEnd(a).start.localeCompare(getSlotStartEnd(b).start)
    );
  }, [selectedTimetable]);

  const getEventForSlot = (day: string, timeSlot: string) => {
    if (!selectedTimetable) return undefined;
    const { start: slotStart } = getSlotStartEnd(timeSlot);
    const exact = selectedTimetable.events.find(
      (e) => e.day === day && e.startTime === slotStart && e.endTime === getSlotStartEnd(timeSlot).end
    );
    if (exact) return exact;
    return selectedTimetable.events.find(
      (e) => e.day === day && e.startTime === slotStart
    );
  };

  const handleSlotUpdate = async (day: string, timeSlot: string, customText: string) => {
    if (!selectedTimetable) return;
    const [startTime, endTime] = timeSlot.split(' - ');
    
    const ttRef = doc(db, 'timetables', selectedTimetableId);
    const updatedEvents = selectedTimetable.events.filter(
        (e) => !(e.day === day && e.startTime === startTime && e.endTime === endTime)
    );

    if (customText) {
        const originalEvent = selectedTimetable.events.find(e => e.day === day && e.startTime === startTime && e.endTime === endTime);
        updatedEvents.push({
            id: originalEvent?.id || `tt-${Date.now()}`,
            day,
            startTime,
            endTime: endTime || '',
            customText: customText,
        });
    }

    try {
      await updateDoc(ttRef, { events: updatedEvents });
      toast({ title: 'Slot Updated' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update slot.'});
    }
  };
  
  const handleAddNewSlot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTimetable) return;

    const formData = new FormData(e.currentTarget);
    const customText = formData.get('custom-text') as string;
    const day = formData.get('day') as string;
    const startTime = formData.get('start-time') as string;
    const endTime = formData.get('end-time') as string;

    if (customText && day && startTime && endTime && startTime < endTime) {
      const newEvent: TimetableEvent = {
        id: `tt-${Date.now()}`,
        day,
        startTime,
        endTime,
        customText: customText,
      };
      const newSlotStr = `${startTime} - ${endTime}`;
      const currentSlots = selectedTimetable.timeSlots ?? DEFAULT_TIME_SLOTS;
      const hasSlot = currentSlots.some((s) => getSlotStartEnd(s).start === startTime && getSlotStartEnd(s).end === endTime);
      const mergedSlots = hasSlot ? currentSlots : [...currentSlots, newSlotStr].sort((a, b) =>
        getSlotStartEnd(a).start.localeCompare(getSlotStartEnd(b).start)
      );

      const ttRef = doc(db, 'timetables', selectedTimetableId);
      try {
        await updateDoc(ttRef, {
          events: [...selectedTimetable.events, newEvent],
          timeSlots: mergedSlots,
        });
        setAddSlotDialogOpen(false);
        toast({ title: 'Slot Added' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please fill all fields correctly.' });
      }
    } else {
      toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please fill all fields correctly.' });
    }
  };

  const handleCreateNewTimetable = async () => {
    if (!newTimetableName.trim() || !principal?.collegeId) return;
    const name = newTimetableName.trim();
    const newTimetable = {
      name,
      collegeId: principal.collegeId,
      events: [],
      timeSlots: DEFAULT_TIME_SLOTS,
      days: DEFAULT_DAYS,
    };
    const timetableId = generateTimetableId(name);
    try {
      await setDoc(doc(db, 'timetables', timetableId), newTimetable);
      setSelectedTimetableId(timetableId);
      setNewTimetableName('');
      toast({ title: 'Timetable Created', description: `"${name}" is ready to be configured.`});
    } catch(e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create timetable.'});
    }
  };

  const handleDeleteTimetable = async (timetableId: string) => {
    try {
      await deleteDoc(doc(db, 'timetables', timetableId));
      toast({ variant: 'destructive', title: 'Timetable Deleted' });
    } catch(e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete timetable.'});
    }
  };

  const handleSaveTimeSlots = async (slots: string[]) => {
    if (!selectedTimetableId) return;
    const sorted = [...slots].sort((a, b) => getSlotStartEnd(a).start.localeCompare(getSlotStartEnd(b).start));
    try {
      await updateDoc(doc(db, 'timetables', selectedTimetableId), { timeSlots: sorted });
      setIsManageSlotsOpen(false);
      toast({ title: 'Time slots updated' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update time slots.' });
    }
  };

  const handleStartEditSlot = (index: number) => {
    const slot = timeSlots[index];
    const { start, end } = getSlotStartEnd(slot);
    setEditingSlotIndex(index);
    setEditSlotStart(start);
    setEditSlotEnd(end);
  };

  const handleCancelEditSlot = () => {
    setEditingSlotIndex(null);
    setEditSlotStart('');
    setEditSlotEnd('');
  };

  const handleSaveEditSlot = async () => {
    if (editingSlotIndex == null || !selectedTimetable) return;
    if (!editSlotStart.trim() || !editSlotEnd.trim() || editSlotStart >= editSlotEnd) {
      toast({ variant: 'destructive', title: 'Invalid times', description: 'Start must be before end.' });
      return;
    }
    const oldSlot = timeSlots[editingSlotIndex];
    const { start: oldStart, end: oldEnd } = getSlotStartEnd(oldSlot);
    const newSlot = `${editSlotStart.trim()} - ${editSlotEnd.trim()}`;
    const newTimeSlots = [...timeSlots.slice(0, editingSlotIndex), newSlot, ...timeSlots.slice(editingSlotIndex + 1)];
    const sorted = [...newTimeSlots].sort((a, b) => getSlotStartEnd(a).start.localeCompare(getSlotStartEnd(b).start));
    const updatedEvents = selectedTimetable.events.map((e) =>
      e.startTime === oldStart && e.endTime === oldEnd
        ? { ...e, startTime: editSlotStart.trim(), endTime: editSlotEnd.trim() }
        : e
    );
    try {
      await updateDoc(doc(db, 'timetables', selectedTimetableId), { timeSlots: sorted, events: updatedEvents });
      handleCancelEditSlot();
      toast({ title: 'Time slot updated' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update time slot.' });
    }
  };

  const handleSaveDays = async (newDays: string[]) => {
    if (!selectedTimetableId) return;
    try {
      await updateDoc(doc(db, 'timetables', selectedTimetableId), { days: newDays });
      setIsManageDaysOpen(false);
      toast({ title: 'Days updated' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update days.' });
    }
  };

  const handleUploadTimetable = async () => {
    if (!uploadFile || !principal?.collegeId) {
      if (!uploadFile) toast({ variant: 'destructive', title: 'No file', description: 'Please select an Excel file.' });
      return;
    }
    const name = uploadTimetableName.trim() || uploadFile.name.replace(/\.(xlsx|xls)$/i, '') || 'Imported Timetable';
    setIsUploading(true);
    try {
      const parsed = await parseTimetableFile(uploadFile);
      const timetableId = generateTimetableId(name);
      await setDoc(doc(db, 'timetables', timetableId), {
        name,
        collegeId: principal.collegeId,
        timeSlots: parsed.timeSlots,
        days: parsed.days,
        events: parsed.events,
      });
      setSelectedTimetableId(timetableId);
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadTimetableName('');
      toast({ title: 'Timetable imported', description: `"${name}" created with ${parsed.events.length} events.` });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: e instanceof Error ? e.message : 'Could not parse the Excel file.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  /** Build cell configs for a row (day): colSpan, event, and slot string (event range or single slot) for each visible cell. */
  const getCellConfigsForDay = (day: string): { colSpan: number; event: TimetableEvent | undefined; slot: string }[] => {
    const configs: { colSpan: number; event: TimetableEvent | undefined; slot: string }[] = [];
    let slotIndex = 0;
    while (slotIndex < timeSlots.length) {
      const slot = timeSlots[slotIndex];
      const event = getEventForSlot(day, slot);
      if (event && getSlotStartEnd(slot).start === event.startTime) {
        const span = getEventSpanInSlots(event, timeSlots);
        configs.push({ colSpan: span, event, slot: `${event.startTime} - ${event.endTime}` });
        slotIndex += span;
      } else {
        configs.push({ colSpan: 1, event, slot });
        slotIndex++;
      }
    }
    return configs;
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Manage Timetables
          </h1>
          <p className="text-muted-foreground">
            Create, view, and manage weekly class schedules for the school.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isManageSlotsOpen} onOpenChange={(open) => { setIsManageSlotsOpen(open); if (!open) handleCancelEditSlot(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedTimetable}>
                <Settings2 className="mr-2 h-4 w-4" /> Edit time slots
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Manage time slots</DialogTitle>
                <DialogDescription>
                  Add, edit, remove, merge or split columns. Merging/splitting columns affects all days. To have one long block on a single day only, keep separate columns and add an event on that day with a longer time range (e.g. 10:00–12:00).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
                  {timeSlots.map((slot, i) => {
                    const { start: slotStart, end: slotEnd } = getSlotStartEnd(slot);
                    const hasNext = i < timeSlots.length - 1;
                    const nextSlot = hasNext ? timeSlots[i + 1] : null;
                    const nextEnd = nextSlot ? getSlotStartEnd(nextSlot).end : null;
                    const canMerge = hasNext && nextSlot !== null && nextEnd !== null && slotEnd === getSlotStartEnd(nextSlot).start;
                    const splitChunks = splitSlotIntoHours(slot);
                    const canSplit = splitChunks !== null && splitChunks.length > 1;
                    const isEditing = editingSlotIndex === i;
                    return (
                      <div key={slot} className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                              <Input
                                type="time"
                                value={editSlotStart}
                                onChange={(e) => setEditSlotStart(e.target.value)}
                                className="h-8 w-[7rem] font-mono text-sm"
                              />
                              <span className="text-muted-foreground">–</span>
                              <Input
                                type="time"
                                value={editSlotEnd}
                                onChange={(e) => setEditSlotEnd(e.target.value)}
                                className="h-8 w-[7rem] font-mono text-sm"
                              />
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={handleSaveEditSlot} title="Save">
                              Save
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={handleCancelEditSlot} title="Cancel">
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 font-mono text-sm">{formatSlot12h(slot)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Edit time slot"
                              onClick={() => handleStartEditSlot(i)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Merge with next slot (column applies to all days)"
                              onClick={() => {
                                if (!canMerge) return;
                                const merged = `${slotStart} - ${nextEnd}`;
                                const next = [...timeSlots.slice(0, i), merged, ...timeSlots.slice(i + 2)];
                                handleSaveTimeSlots(next);
                              }}
                              disabled={!canMerge}
                            >
                              <Merge className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Split into 1-hour columns"
                              onClick={() => {
                                if (!splitChunks || splitChunks.length < 2) return;
                                const next = [...timeSlots.slice(0, i), ...splitChunks, ...timeSlots.slice(i + 1)];
                                handleSaveTimeSlots(next);
                              }}
                              disabled={!canSplit}
                            >
                              <SplitSquareVertical className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = timeSlots.filter((_, j) => j !== i);
                                if (next.length > 0) handleSaveTimeSlots(next);
                              }}
                              disabled={timeSlots.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 items-end">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <div>
                      <Label className="text-xs">Start</Label>
                      <Input
                        type="time"
                        value={newSlotStart}
                        onChange={(e) => setNewSlotStart(e.target.value)}
                        className="mt-0.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End</Label>
                      <Input
                        type="time"
                        value={newSlotEnd}
                        onChange={(e) => setNewSlotEnd(e.target.value)}
                        className="mt-0.5"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      if (newSlotStart && newSlotEnd && newSlotStart < newSlotEnd) {
                        const newSlot = `${newSlotStart} - ${newSlotEnd}`;
                        if (!timeSlots.includes(newSlot)) {
                          handleSaveTimeSlots([...timeSlots, newSlot]);
                          setNewSlotStart('');
                          setNewSlotEnd('');
                        }
                      }
                    }}
                    disabled={!newSlotStart || !newSlotEnd || newSlotStart >= newSlotEnd}
                  >
                    Add slot
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isManageDaysOpen} onOpenChange={setIsManageDaysOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!selectedTimetable}>
                <Pencil className="mr-2 h-4 w-4" /> Edit days
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Manage days</DialogTitle>
                <DialogDescription>
                  Add or remove rows (days). Changes apply to this timetable.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
                  {days.map((day, i) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="flex-1 font-medium">{day}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = days.filter((_, j) => j !== i);
                          if (next.length > 0) handleSaveDays(next);
                        }}
                        disabled={days.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="New day name"
                    value={newDayName}
                    onChange={(e) => setNewDayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newDayName.trim()) {
                        handleSaveDays([...days, newDayName.trim()]);
                        setNewDayName('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newDayName.trim() && !days.includes(newDayName.trim())) {
                        handleSaveDays([...days, newDayName.trim()]);
                        setNewDayName('');
                      }
                    }}
                    disabled={!newDayName.trim() || days.includes(newDayName.trim())}
                  >
                    Add day
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
           <Dialog open={isUploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) setUploadFile(null); setUploadTimetableName(''); }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Upload Timetable
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Upload Timetable from Excel</DialogTitle>
                <DialogDescription>
                  Use an Excel (.xlsx or .xls) file. Row 1: first cell &quot;Day&quot;, then time slots (e.g. 09:00 - 10:00 or 9:00 AM - 10:00 AM). Row 2+: first column = day name, other columns = event label per slot.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="timetable-file" className="text-right">
                    Excel File
                  </Label>
                  <Input
                    id="timetable-file"
                    type="file"
                    className="col-span-3"
                    accept=".xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="upload-timetable-name" className="text-right">
                    Timetable name
                  </Label>
                  <Input
                    id="upload-timetable-name"
                    value={uploadTimetableName}
                    onChange={(e) => setUploadTimetableName(e.target.value)}
                    placeholder="e.g. Grade 8 Schedule"
                    className="col-span-3"
                  />
                </div>
                {uploadFile && (
                  <p className="text-sm text-muted-foreground col-span-4">
                    Selected: {uploadFile.name}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleUploadTimetable} disabled={!uploadFile || isUploading}>
                  {isUploading ? 'Importing…' : 'Import Timetable'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddSlotDialogOpen} onOpenChange={setAddSlotDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedTimetable}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Event Slot
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddNewSlot}>
                <DialogHeader>
                  <DialogTitle>Add New Event Slot</DialogTitle>
                  <DialogDescription>
                    Schedule a new event in the timetable.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="custom-text" className="text-right">
                      Event
                    </Label>
                    <Input name="custom-text" id="custom-text" className="col-span-3" required placeholder="e.g., Science - Grade 8" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="day" className="text-right">
                      Day
                    </Label>
                    <Select name="day" required>
                      <SelectTrigger id="day" className="col-span-3">
                        <SelectValue placeholder="Select a day" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="start-time" className="text-right">
                      Start Time
                    </Label>
                    <Input name="start-time" id="start-time" type="time" className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="end-time" className="text-right">
                      End Time
                    </Label>
                    <Input name="end-time" id="end-time" type="time" className="col-span-3" required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Add to Schedule</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-t border-b py-4 my-6 gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="timetable-select" className="text-sm font-medium whitespace-nowrap">Current Timetable:</Label>
            <Select value={selectedTimetableId} onValueChange={setSelectedTimetableId}>
              <SelectTrigger id="timetable-select" className="w-full md:w-[280px]">
                <SelectValue placeholder="Select a timetable" />
              </SelectTrigger>
              <SelectContent>
                {timetables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input 
                    id="timetable-name"
                    value={newTimetableName}
                    onChange={(e) => setNewTimetableName(e.target.value)}
                    placeholder="New timetable name..."
                    className="flex-grow"
                  />
                  <Button onClick={handleCreateNewTimetable} className="whitespace-nowrap">
                    <PlusCircle className="mr-2 h-4 w-4" /> Create
                  </Button>
              </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!selectedTimetable} className="w-full sm:w-auto whitespace-nowrap">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the "{selectedTimetable?.name}" timetable. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteTimetable(selectedTimetableId)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
      </div>
      
      {selectedTimetable ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28 border-r">Day</TableHead>
                    {timeSlots.map((slot) => (
                      <TableHead key={slot} className="border-r text-center min-w-[120px]">
                        {formatSlot12h(slot)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((day) => (
                    <TableRow key={day}>
                      <TableCell className="font-medium border-r">{day}</TableCell>
                      {getCellConfigsForDay(day).map(({ colSpan, event, slot }, idx) => {
                        let contentNode: React.ReactNode = null;
                        if (event) {
                          if (event.customText) {
                            contentNode = (
                              <div className="bg-primary/10 p-2 rounded-lg h-full flex flex-col justify-between">
                                <div>
                                  <p className="font-semibold text-primary">{event.customText}</p>
                                </div>
                                <Badge variant="secondary" className="mt-2 w-fit">
                                  {formatTime24to12(event.startTime)} - {formatTime24to12(event.endTime)}
                                </Badge>
                              </div>
                            );
                          } else if (event.classId) {
                            const eventClass = classes.find((c) => c.id === event.classId);
                            if (eventClass) {
                              contentNode = (
                                <div className="bg-primary/10 p-2 rounded-lg h-full flex flex-col justify-between">
                                  <div>
                                    <p className="font-semibold text-primary">{eventClass.subject}</p>
                                    <p className="text-xs text-muted-foreground">{eventClass.name}</p>
                                  </div>
                                  <Badge variant="secondary" className="mt-2 w-fit">
                                    {formatTime24to12(event.startTime)} - {formatTime24to12(event.endTime)}
                                  </Badge>
                                </div>
                              );
                            }
                          }
                        }
                        return (
                          <TableCell key={`${day}-${slot}-${idx}`} colSpan={colSpan} className="p-0 border-r align-top h-24">
                            <Dialog>
                              <DialogTrigger asChild>
                                <div className="w-full h-full min-h-[6rem] text-left p-2 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col justify-between">
                                  {contentNode || <div className="min-h-[4rem]" />}
                                </div>
                              </DialogTrigger>
                              <EditSlotDialog
                                day={day}
                                timeSlot={slot}
                                event={event}
                                onSave={(text) => handleSlotUpdate(day, slot, text)}
                                onRemove={() => handleSlotUpdate(day, slot, '')}
                                classes={classes}
                              />
                            </Dialog>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No Timetable Created</CardTitle>
            <CardDescription>Use the input above to create your first timetable to get started.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-10">
            <CalendarPlus className="w-16 h-16 text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
