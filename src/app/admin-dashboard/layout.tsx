'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BookUser,
  BookCopy,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Users,
  GraduationCap,
  Calendar,
  Landmark,
  Bell,
  MessageSquare,
  AlertCircle,
  UserPlus,
  LifeBuoy,
  Clock,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { useAuth } from '@/contexts/auth-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import type { Notification, College } from '@/lib/types';
import { playNotificationSound } from '@/lib/notification-sound';
import { AcademicYearProvider, useAcademicYear } from '@/contexts/academic-year-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AcademicYearBackfill } from '@/components/admin/academic-year-backfill';

function AdminAcademicYearSelect() {
  const { selectedAcademicYear, setSelectedAcademicYear, availableAcademicYears } =
    useAcademicYear();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="admin-academic-year" className="sr-only">
        Academic Year
      </Label>
      <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
        <SelectTrigger id="admin-academic-year" className="w-[140px] sm:w-[160px]">
          <SelectValue placeholder="Academic year" />
        </SelectTrigger>
        <SelectContent side="bottom" className="max-h-48 overflow-y-auto">
          {availableAcademicYears.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SuperAdminCollegeSelect() {
  const { selectedCollegeId, setSelectedCollegeId } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);

  useEffect(() => {
    getDocs(collection(db, 'colleges')).then((snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as College));
      setColleges(list);
    });
  }, []);

  if (colleges.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="super-admin-college" className="sr-only">
        Select College
      </Label>
      <Select
        value={selectedCollegeId || ''}
        onValueChange={(val) => setSelectedCollegeId(val || null)}
      >
        <SelectTrigger id="super-admin-college" className="w-[180px] sm:w-[220px]">
          <SelectValue placeholder="Select College" />
        </SelectTrigger>
        <SelectContent side="bottom" className="max-h-48 overflow-y-auto">
          {colleges.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const navItems = [
  { href: '/admin-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin-dashboard/teachers', icon: Users, label: 'Teachers' },
  { href: '/admin-dashboard/students', icon: Users, label: 'Students' },
  { href: '/admin-dashboard/classes', icon: BookUser, label: 'Classes' },
  { href: '/admin-dashboard/subjects', icon: BookCopy, label: 'Subjects' },
  { href: '/admin-dashboard/finances', icon: Landmark, label: 'Fee Book' },
  { href: '/admin-dashboard/reports', icon: BarChart3, label: 'Reports' },
  { href: '/admin-dashboard/asset-requests', icon: ClipboardList, label: 'Asset Requests' },
  { href: '/admin-dashboard/announcements', icon: Megaphone, label: 'Announcements' },
  { href: '/admin-dashboard/communication', icon: MessageSquare, label: 'Communication' },
  { href: '/admin-dashboard/complaints', icon: AlertCircle, label: 'Complaints' },
  { href: '/admin-dashboard/timetable', icon: Calendar, label: 'Timetable' },
];

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const principal = useCurrentPrincipal();

  const [collegeStatus, setCollegeStatus] = useState<string | null>(null);
  const [deactivationReason, setDeactivationReason] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [countdownText, setCountdownText] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  // Helper countdown function
  const getCountdown = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;

    if (diff <= 0) {
      return { expired: true, text: 'Expired' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let text = '';
    if (days > 0) text += `${days}d `;
    if (hours > 0 || days > 0) text += `${hours}h `;
    text += `${minutes}m`;

    return { expired: false, text };
  };

  useEffect(() => {
    if (!principal?.collegeId || principal.isSuperAdmin) {
      setCollegeStatus('active');
      return;
    }

    const unsub = onSnapshot(doc(db, 'colleges', principal.collegeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCollegeStatus(data.status || 'active');
        setDeactivationReason(data.deactivationReason || '');
        
        const billing = data.billing;
        if (billing && billing.expiryDate) {
          setExpiryDate(billing.expiryDate);
        } else {
          setExpiryDate(null);
        }
      } else {
        setCollegeStatus('active');
        setExpiryDate(null);
      }
    }, (err) => {
      console.error('Error listening to college status:', err);
    });

    return () => unsub();
  }, [principal?.collegeId, principal?.isSuperAdmin]);

  useEffect(() => {
    if (collegeStatus === 'deactivated') {
      router.push(`/college-deactivated?reason=${encodeURIComponent(deactivationReason)}&collegeId=${principal?.collegeId}`);
    }
  }, [collegeStatus, deactivationReason, router, principal?.collegeId]);

  useEffect(() => {
    if (!expiryDate) {
      setCountdownText('');
      setIsExpired(false);
      return;
    }

    const update = () => {
      const res = getCountdown(expiryDate);
      setCountdownText(res.text);
      setIsExpired(res.expired);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [expiryDate]);
  const profilePlaceholder = PlaceHolderImages.find(
    (img) => img.id === 'principal-profile'
  );
  const profileAvatarUrl = principal?.photoUrl ?? profilePlaceholder?.imageUrl;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const filteredNotifications = useMemo(
    () =>
      notifications
        .filter((n) => !n.recipientId || n.recipientId === principal?.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [notifications, principal?.id]
  );
  const unreadNotifications = filteredNotifications.filter((n) => !n.read).length;
  const prevUnreadCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnreadCountRef.current !== null && unreadNotifications > prevUnreadCountRef.current) {
      playNotificationSound();
    }
    prevUnreadCountRef.current = unreadNotifications;
  }, [unreadNotifications]);

  useEffect(() => {
    if (!principal?.collegeId) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('collegeId', '==', principal.collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
      );
    });
    return () => unsub();
  }, [principal?.collegeId]);

  const handleMarkAsRead = async (id: string) => {
    const notification = filteredNotifications.find((n) => n.id === id);
    if (notification && !notification.read) {
      try {
        await updateDoc(doc(db, 'notifications', id), { read: true });
      } catch (error) {
        console.error('Error marking notification as read: ', error);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = filteredNotifications.filter((n) => !n.read);
    if (unread.length > 0) {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const docRef = doc(db, 'notifications', n.id);
        batch.update(docRef, { read: true });
      });
      try {
        await batch.commit();
      } catch (error) {
        console.error('Error marking all notifications as read: ', error);
      }
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
                  <div className={cn('p-2 rounded-full', 'bg-primary/20')}>
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
                      {new Date(notification.date).toLocaleString()} -{' '}
                      {notification.sender?.name ?? 'Unknown'} ({notification.sender?.role ?? '—'})
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
    <AcademicYearProvider>
    <AcademicYearBackfill />
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <GraduationCap className="size-6 text-primary" />
            <h1 className="text-lg font-semibold font-headline">
              Campus Management System
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={
                      pathname.startsWith(item.href) &&
                      (pathname.length === item.href.length ||
                        pathname[item.href.length] === '/')
                    }
                    className={cn(
                      'justify-start gap-3',
                      pathname.startsWith(item.href) &&
                        (pathname.length === item.href.length ||
                          pathname[item.href.length] === '/') &&
                        'font-bold'
                    )}
                  >
                    <item.icon className="size-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            {expiryDate && !principal?.isSuperAdmin && (
              <SidebarMenuItem className="px-3 py-2">
                <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                  isExpired 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>System License</span>
                  </div>
                  <div className="text-sm font-extrabold tracking-tight">
                    {isExpired ? 'Expired' : countdownText}
                  </div>
                  <div className="text-[10px] opacity-80">
                    Expiry: {new Date(expiryDate).toLocaleDateString()}
                  </div>
                </div>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <Link href="/admin-dashboard/profile">
                <SidebarMenuButton
                  className="justify-start gap-3"
                  isActive={pathname === '/admin-dashboard/profile'}
                >
                  {profileAvatarUrl && (
                    <Image
                      src={profileAvatarUrl}
                      alt={principal?.name ?? 'Admin'}
                      width={28}
                      height={28}
                      className="rounded-full object-cover"
                      style={{ width: 28, height: 28, objectFit: 'cover' }}
                      unoptimized={!!principal?.photoUrl}
                    />
                  )}
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">
                      {principal?.name ?? 'Loading…'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {principal?.email ?? '—'}
                    </span>
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="justify-start gap-3 w-full cursor-pointer" onClick={async () => { await signOut(); router.push('/'); }}>
                <LogOut className="size-5" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 flex-wrap items-center justify-between gap-2 border-b bg-background/80 px-3 backdrop-blur-sm sm:h-16 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 flex-shrink-0 items-center gap-2 md:gap-4 md:hidden">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <GraduationCap className="size-6 text-primary" />
              <h1 className="text-lg font-semibold font-headline">
                Campus Management System
              </h1>
            </div>
          </div>
          {/* This div is a spacer on desktop */}
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            {principal?.isSuperAdmin && <SuperAdminCollegeSelect />}
            <AdminAcademicYearSelect />
            {NotificationPopover}
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
    </AcademicYearProvider>
  );
}
