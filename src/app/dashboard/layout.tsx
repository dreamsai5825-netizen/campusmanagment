'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BookUser,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  User,
  Users,
  GraduationCap,
  Calendar,
  CalendarDays,
  AlertCircle,
  FileSpreadsheet,
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
import { useCurrentTeacher } from '@/hooks/use-current-user';
import { useAuth } from '@/contexts/auth-context';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/students', icon: Users, label: 'Students' },
  { href: '/dashboard/my-classes', icon: BookUser, label: 'My Classes' },
  { href: '/dashboard/assignments', icon: ClipboardList, label: 'Assignments' },
  { href: '/dashboard/attendance', icon: CheckSquare, label: 'Attendance' },
  { href: '/dashboard/timetable', icon: Calendar, label: 'Timetable' },
  { href: '/dashboard/calendar', icon: CalendarDays, label: 'Calendar' },
  {
    href: '/dashboard/parent-communication',
    icon: MessageSquare,
    label: 'Communication',
  },
  { href: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
  { href: '/dashboard/complaints/coordinator', icon: AlertCircle, label: 'Complaints' },
  { href: '/dashboard/omr', icon: FileSpreadsheet, label: 'OMR Sheets' },
  { href: '/dashboard/asset-requests', icon: ClipboardList, label: 'Asset Requests' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const teacher = useCurrentTeacher();

  const [collegeStatus, setCollegeStatus] = useState<string | null>(null);
  const [deactivationReason, setDeactivationReason] = useState<string>('');

  useEffect(() => {
    if (!teacher?.collegeId) return;

    const unsub = onSnapshot(doc(db, 'colleges', teacher.collegeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCollegeStatus(data.status || 'active');
        setDeactivationReason(data.deactivationReason || '');
      } else {
        setCollegeStatus('active');
      }
    }, (err) => {
      console.error('Error listening to college status:', err);
    });

    return () => unsub();
  }, [teacher?.collegeId]);

  useEffect(() => {
    if (collegeStatus === 'deactivated') {
      router.push(`/college-deactivated?reason=${encodeURIComponent(deactivationReason)}&collegeId=${teacher?.collegeId}`);
    }
  }, [collegeStatus, deactivationReason, router, teacher?.collegeId]);
  const profilePlaceholder = PlaceHolderImages.find((img) => img.id === 'teacher-profile');
  const profileAvatarUrl = teacher?.photoUrl ?? profilePlaceholder?.imageUrl;

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <GraduationCap className="size-6 text-primary" />
            <h1 className="text-lg font-semibold font-headline">CMS Portal</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    className={cn(
                      'justify-start gap-3',
                      pathname === item.href && 'font-bold'
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
            <SidebarMenuItem>
              <Link href="/dashboard/profile">
                <SidebarMenuButton className="justify-start gap-3" isActive={pathname === '/dashboard/profile'}>
                  {profileAvatarUrl && (
                     <Image
                        src={profileAvatarUrl}
                        alt={teacher?.name ?? 'Teacher'}
                        width={28}
                        height={28}
                        style={{ width: 'auto', height: 'auto' }}
                        className="rounded-full object-cover animate-fade-in"
                        unoptimized={!!teacher?.photoUrl}
                      />
                  )}
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{teacher?.name ?? 'Teacher'}</span>
                    <span className="text-xs text-muted-foreground">{teacher?.email ?? '—'}</span>
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="justify-start gap-3 w-full cursor-pointer" onClick={handleLogout}>
                <LogOut className="size-5" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 min-w-0 flex-shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-sm sm:h-16 sm:gap-4 sm:px-6 md:hidden">
          <SidebarTrigger />
          <div className="flex min-w-0 items-center gap-2">
            <GraduationCap className="size-6 text-primary" />
            <h1 className="text-lg font-semibold font-headline">CMS Portal</h1>
          </div>
        </header>
        <main className="flex flex-1 flex-col overflow-x-auto overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8" style={{ minWidth: 0 }}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
