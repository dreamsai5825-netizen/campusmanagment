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
  ClipboardList,
  CheckSquare,
  Calendar,
  Megaphone,
  MessageSquare,
  User,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCurrentStudent } from '@/hooks/use-current-user';
import type { Notification } from '@/lib/types';
import { playNotificationSound } from '@/lib/notification-sound';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function StudentDashboardPage() {
  const student = useCurrentStudent();
  const [classes, setClasses] = useState<{ id: string; name?: string }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const filteredNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.recipientId === student?.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [notifications, student?.id]
  );

  useEffect(() => {
    const unsubC = onSnapshot(collection(db, 'classes'), (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsubN = onSnapshot(collection(db, 'notifications'), (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
    });
    return () => { unsubC(); unsubN(); };
  }, []);

  const studentClass = classes.find((c) => c.id === student?.classId);
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
            Welcome, {student?.name ?? 'Student'}!
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Here's your overview for today. You are in {studentClass?.name ?? '—'}.
          </p>
        </div>
        <div className="flex-shrink-0">{NotificationPopover}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/student-dashboard/assignments">
            <Card className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">My Assignments</CardTitle>
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">View Assignments</div>
                </CardContent>
            </Card>
        </Link>
        <Link href="/student-dashboard/attendance">
            <Card className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">My Attendance</CardTitle>
                    <CheckSquare className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">View Record</div>
                </CardContent>
            </Card>
        </Link>
        <Link href="/student-dashboard/timetable">
            <Card className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">My Timetable</CardTitle>
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">View Schedule</div>
                </CardContent>
            </Card>
        </Link>
        <Link href="/student-dashboard/announcements">
            <Card className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Announcements</CardTitle>
                    <Megaphone className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">View Announcements</div>
                </CardContent>
            </Card>
        </Link>
        <Link href="/student-dashboard/communication">
            <Card className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Communication</CardTitle>
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Connect</div>
                </CardContent>
            </Card>
        </Link>
        <Link href="/student-dashboard/profile">
            <Card className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">My Profile</CardTitle>
                    <User className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">View Profile</div>
                </CardContent>
            </Card>
        </Link>
      </div>

       <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="bg-primary/20 p-2 rounded-full">
                  <Megaphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Mid-term Exam Schedule</p>
                  <p className="text-sm text-muted-foreground">
                    The schedule for the upcoming mid-term exams has been
                    posted.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    2 hours ago
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="bg-primary/20 p-2 rounded-full">
                  <Megaphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Parent-Teacher Meeting</p>
                  <p className="text-sm text-muted-foreground">
                    This Friday, from 4 PM to 6 PM.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    1 day ago
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="bg-accent/30 p-2 rounded-full">
                  <ClipboardList className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-semibold">Math Assignment - Chapter 5</p>
                  <p className="text-sm text-muted-foreground">
                    Class: Grade 8
                  </p>
                  <p className="text-xs text-destructive mt-1">Due Tomorrow</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
