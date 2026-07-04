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
import { PlusCircle, Trash2, CalendarPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { collection, doc, onSnapshot, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateTimetableId } from '@/lib/id-utils';
import { formatSlot12h, formatTime24to12 } from '@/lib/time-utils';
import type { Class, Timetable as TimetableType, TimetableEvent as TimetableEventType } from '@/lib/types';

type TimetableEvent = TimetableEventType;
type Timetable = TimetableType;

const DEFAULT_TIME_SLOTS = ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '14:00 - 15:00', '15:00 - 16:00'];
const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSlotStartEnd(slot: string) {
  const [start = '', end = ''] = slot.split(' - ');
  return { start: start.trim(), end: end.trim() };
}

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
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState('');
  const [isAddSlotDialogOpen, setAddSlotDialogOpen] = useState(false);
  const [newTimetableName, setNewTimetableName] = useState('');

  useEffect(() => {
    const unsubT = onSnapshot(collection(db, 'timetables'), (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        events: (d.data().events ?? []) as TimetableEvent[],
      } as Timetable));
      setTimetables(data);
      setSelectedTimetableId((current) => {
        if (!current && data[0]) return data[0].id;
        if (current && data.length > 0 && !data.find((t) => t.id === current))
          return data[0].id;
        return current;
      });
    });
    const unsubC = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class)));
    });
    return () => { unsubT(); unsubC(); };
  }, []);
  
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

  const handleSlotUpdate = async (day: string, timeSlot: string, customText: string) => {
    const [startTime, endTime] = timeSlot.split(' - ');
    const selected = timetables.find((t) => t.id === selectedTimetableId);
    if (!selected) return;
    const updatedEvents = selected.events.filter(
      (e) => !(e.day === day && e.startTime === startTime && e.endTime === endTime)
    );
    if (customText) {
      const originalEvent = selected.events.find(
        (e) => e.day === day && e.startTime === startTime && e.endTime === endTime
      );
      updatedEvents.push({
        id: originalEvent?.id || `tt-${Date.now()}`,
        day,
        startTime,
        endTime: endTime || '',
        customText,
      });
    }
    await updateDoc(doc(db, 'timetables', selectedTimetableId), { events: updatedEvents });
  };
  
  const handleAddNewSlot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const classId = formData.get('class') as string;
    const day = formData.get('day') as string;
    const startTime = formData.get('start-time') as string;
    const endTime = formData.get('end-time') as string;
    const cls = classes.find((c) => c.id === classId);
    const selected = timetables.find((t) => t.id === selectedTimetableId);

    if (cls && day && startTime && endTime && startTime < endTime && selected) {
      const newEvent: TimetableEvent = {
        id: `tt-${Date.now()}`,
        day,
        startTime,
        endTime,
        customText: `${cls.subject} - ${cls.name}`,
      };
      const newSlotStr = `${startTime} - ${endTime}`;
      const currentSlots = selected.timeSlots ?? DEFAULT_TIME_SLOTS;
      const hasSlot = currentSlots.some((s) => getSlotStartEnd(s).start === startTime && getSlotStartEnd(s).end === endTime);
      const mergedSlots = hasSlot ? currentSlots : [...currentSlots, newSlotStr].sort((a, b) =>
        getSlotStartEnd(a).start.localeCompare(getSlotStartEnd(b).start)
      );
      const updatedEvents = [...selected.events, newEvent];
      await updateDoc(doc(db, 'timetables', selectedTimetableId), { events: updatedEvents, timeSlots: mergedSlots });
      setAddSlotDialogOpen(false);
    }
  };

  const handleCreateNewTimetable = async () => {
    if (!newTimetableName.trim()) return;
    const name = newTimetableName.trim();
    const timetableId = generateTimetableId(name);
    try {
      await setDoc(doc(db, 'timetables', timetableId), { name, events: [], timeSlots: DEFAULT_TIME_SLOTS, days: DEFAULT_DAYS });
      setSelectedTimetableId(timetableId);
      setNewTimetableName('');
    } catch (e) {
      console.error('Failed to create timetable', e);
    }
  };

  const handleDeleteTimetable = async (timetableId: string) => {
    await deleteDoc(doc(db, 'timetables', timetableId));
    // selectedTimetableId is updated in onSnapshot when the deleted doc is no longer in the list
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">
            Class Timetable
          </h1>
          <p className="text-muted-foreground">
            View, create, and manage your weekly class schedules.
          </p>
        </div>
        <Dialog open={isAddSlotDialogOpen} onOpenChange={setAddSlotDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!selectedTimetable}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Class Slot
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddNewSlot}>
              <DialogHeader>
                <DialogTitle>Add New Class Slot</DialogTitle>
                <DialogDescription>
                  Schedule a new class in your timetable. This will create a new column if the time slot does not exist.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="class" className="text-right">
                    Class
                  </Label>
                  <Select name="class" required>
                    <SelectTrigger id="class" className="col-span-3">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button variant="destructive" disabled={!selectedTimetable || timetables.length <= 1} className="w-full sm:w-auto whitespace-nowrap">
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
