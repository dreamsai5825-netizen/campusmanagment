'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  School,
  Users,
  Calendar,
  Bell,
  Megaphone,
  ClipboardList,
  MessageSquare,
  CheckSquare,
  NotebookText,
} from 'lucide-react';
import Link from 'next/link';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, writeBatch, doc, query, where } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { playNotificationSound } from '@/lib/notification-sound';

export default function DashboardPage() {
  const teacher = useCurrentTeacher();
  const [students, setStudents] = useState<{ id: string; classId?: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string }[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<{ id: string; title?: string; classId?: string; dueDate?: string }[]>([]);
  const [announcements, setAnnouncements] = useState<{ id: string; title?: string; content?: string; date?: string }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const filteredNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.recipientId === teacher?.id && (n.collegeId == null || n.collegeId === teacher?.collegeId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [notifications, teacher?.id, teacher?.collegeId]
  );

  useEffect(() => {
    if (!teacher?.id) return;
    const unsub = onSnapshot(collection(db, 'teachers', teacher.id, 'assignedClasses'), (snap) => {
      setAssignedClassIds(snap.docs.map((d) => d.id));
    });
    return () => unsub();
  }, [teacher?.id]);

  useEffect(() => {
    if (!teacher?.collegeId) {
      setStudents([]);
      setClasses([]);
      setAssignments([]);
      setAnnouncements([]);
      return;
    }
    const qStudents = query(collection(db, 'students'), where('collegeId', '==', teacher.collegeId));
    const qClasses = query(collection(db, 'classes'), where('collegeId', '==', teacher.collegeId));
    const qAssignments = query(collection(db, 'assignments'), where('collegeId', '==', teacher.collegeId));
    const qAnnouncements = query(collection(db, 'announcements'), where('collegeId', '==', teacher.collegeId));
    const unsubS = onSnapshot(qStudents, (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, classId: d.data().classId }))));
    const unsubC = onSnapshot(qClasses, (snap) => setClasses(snap.docs.map((d) => ({ id: d.id }))));
    const unsubA = onSnapshot(qAssignments, (snap) => setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; title?: string; classId?: string; dueDate?: string }))));
    const unsubAn = onSnapshot(qAnnouncements, (snap) => setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; title?: string; content?: string; date?: string })).sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())));
    return () => { unsubS(); unsubC(); unsubA(); unsubAn(); };
  }, [teacher?.collegeId]);

  useEffect(() => {
    const unsubN = onSnapshot(collection(db, 'notifications'), (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
    });
    return () => unsubN();
  }, []);

  const studentsInMyClasses = useMemo(
    () => students.filter((s) => assignedClassIds.includes(s.classId ?? '')),
    [students, assignedClassIds]
  );
  const assignmentsInMyClasses = useMemo(
    () => assignments.filter((a) => assignedClassIds.includes(a.classId ?? '')),
    [assignments, assignedClassIds]
  );
  const sortedAssignmentsByDue = useMemo(
    () => [...assignmentsInMyClasses].sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()),
    [assignmentsInMyClasses]
  );

  const unreadNotifications = filteredNotifications.filter((n) => !n.read).length;
  const prevUnreadCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnreadCountRef.current !== null && unreadNotifications > prevUnreadCountRef.current) {
      playNotificationSound();
    }
    prevUnreadCountRef.current = unreadNotifications;
  }, [unreadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = filteredNotifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      const bat = writeBatch(db);
      unread.forEach((n) => bat.update(doc(db, 'notifications', n.id), { read: true }));
      await bat.commit();
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const dashboardCards = [
    { title: 'Total Students', value: studentsInMyClasses.length, icon: Users, href: '/dashboard/students', color: 'primary' },
    { title: 'Assigned Classes', value: assignedClassIds.length, icon: School, href: '/dashboard/my-classes', color: 'chart-2' },
    { title: 'Assignments', value: `${assignmentsInMyClasses.length} Active`, icon: ClipboardList, href: '/dashboard/assignments', color: 'chart-3' },
    { title: 'Attendance', value: 'Mark Today', icon: CheckSquare, href: '/dashboard/attendance', color: 'chart-5' },
    { title: 'Internal Assessment', value: 'Add assessment', icon: NotebookText, href: '/dashboard/assessments', color: 'chart-4' },
    { title: 'Timetable', value: 'View Schedule', icon: Calendar, href: '/dashboard/timetable', color: 'accent' },
    { title: 'Announcements', value: `${announcements.length} Recent`, icon: Megaphone, href: '/dashboard/announcements', color: 'primary' },
    { title: 'Communication', value: 'Connect', icon: MessageSquare, href: '/dashboard/parent-communication', color: 'chart-2' },
  ];
  
  const NotificationPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-0" align="end">
        <CardHeader className="p-4 border-b">
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            You have {unreadNotifications} unread notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 max-h-96 overflow-y-auto">
          {filteredNotifications.length > 0 ? (
            <div className="divide-y">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleMarkAsRead(notification.id)}
                  className={cn(
                    'p-4 flex items-start gap-4 cursor-pointer hover:bg-muted/50',
                    !notification.read && 'bg-accent/50'
                  )}
                >
                  <div
                    className={cn(
                      'p-2 rounded-full',
                      notification.type === 'announcement'
                        ? 'bg-primary/20'
                        : 'bg-primary/20'
                    )}
                  >
                    {notification.type === 'announcement' ? (
                      <Megaphone className="w-5 h-5 text-primary" />
                    ) : (
                      <MessageSquare className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.date).toLocaleString()} - {notification.sender?.name ?? '—'}{' '}
                      ({notification.sender?.role ?? '—'})
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1.5"></div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              You have no new notifications.
            </div>
          )}
        </CardContent>
        {filteredNotifications.length > 0 && (
          <CardFooter className="p-2 border-t">
            <Button
              size="sm"
              variant="link"
              className="w-full"
              onClick={handleMarkAllAsRead}
              disabled={unreadNotifications === 0}
            >
              Mark all as read
            </Button>
          </CardFooter>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-headline tracking-tight sm:text-3xl">
            Teacher Dashboard
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Welcome back! Here's your overview for today.
          </p>
        </div>
        <div className="flex-shrink-0">{NotificationPopover}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dashboardCards.map((card) => {
          const iconBg = card.color === 'primary' ? 'bg-primary/12 text-primary' : card.color === 'accent' ? 'bg-accent/15 text-accent' : `bg-chart-${card.color === 'chart-2' ? '2' : card.color === 'chart-3' ? '3' : card.color === 'chart-4' ? '4' : '5'}/15 text-chart-${card.color === 'chart-2' ? '2' : card.color === 'chart-3' ? '3' : card.color === 'chart-4' ? '4' : '5'}`;
          const cardComponent = (
            <Card
              key={card.title}
              className="transform transition-all duration-200 hover:scale-[1.02] hover:shadow-md border-border/80"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  {card.title}
                </CardTitle>
                <div className={cn('rounded-lg p-2', card.color === 'primary' && 'bg-primary/12', card.color === 'accent' && 'bg-accent/15 text-accent', card.color === 'chart-2' && 'bg-chart-2/15 text-chart-2', card.color === 'chart-3' && 'bg-chart-3/15 text-chart-3', card.color === 'chart-4' && 'bg-chart-4/15 text-chart-4', card.color === 'chart-5' && 'bg-chart-5/15 text-chart-5')}>
                  <card.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          );
          
          if (card.href) {
            return (
              <Link
                href={card.href}
                key={card.title}
                className="cursor-pointer"
              >
                {cardComponent}
              </Link>
            );
          }

          return cardComponent;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {announcements.slice(0, 3).map((a) => (
                <li key={a.id} className="flex items-start gap-4">
                  <div className="bg-primary/20 p-2 rounded-full">
                    <Megaphone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{a.title ?? 'Announcement'}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{a.content ?? ''}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.date ? new Date(a.date).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </li>
              ))}
              {announcements.length === 0 && (
                <li className="text-sm text-muted-foreground">No announcements yet.</li>
              )}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {sortedAssignmentsByDue.slice(0, 3).map((a) => (
                <li key={a.id} className="flex items-start gap-4">
                  <div className="bg-accent/15 p-2 rounded-full">
                    <ClipboardList className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">{a.title ?? 'Assignment'}</p>
                    <p className="text-sm text-muted-foreground">
                      Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                    </p>
                  </div>
                </li>
              ))}
              {sortedAssignmentsByDue.length === 0 && (
                <li className="text-sm text-muted-foreground">No assignments for your classes yet.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
