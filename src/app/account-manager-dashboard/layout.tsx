'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Calculator,
  LayoutDashboard,
  FolderTree,
  LogOut,
  Megaphone,
  Bell,
  MessageSquare,
  Clock,
  Landmark,
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  BookOpen,
  FileCode,
  Wallet,
  Users,
  Building2,
  BarChart3,
  ShieldCheck,
  History,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
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
} from 'firebase/firestore';
import type { Notification, College } from '@/lib/types';
import { playNotificationSound } from '@/lib/notification-sound';
import { getCollegeById } from '@/lib/college-service';
import { useToast } from '@/hooks/use-toast';
import { AcademicYearProvider, useAcademicYear } from '@/contexts/academic-year-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

function CollegeSwitcher() {
  const principal = useCurrentPrincipal();
  const [colleges, setColleges] = useState<College[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchColleges = async () => {
      const ids = principal?.collegeIds && principal.collegeIds.length > 0
        ? principal.collegeIds
        : principal?.collegeId
        ? [principal.collegeId]
        : [];
      
      if (ids.length === 0) {
        setColleges([]);
        return;
      }
      
      try {
        const fetched = await Promise.all(
          ids.map(async (id) => {
            try {
              const col = await getCollegeById(id);
              return col;
            } catch (err) {
              console.error(err);
              return null;
            }
          })
        );
        setColleges(fetched.filter((c): c is College => c !== null));
      } catch (err) {
        console.error('Error loading switcher colleges:', err);
      }
    };

    fetchColleges();
  }, [principal?.collegeIds, principal?.collegeId]);

  if (colleges.length <= 1) return null;

  const handleSwitchCollege = async (targetId: string) => {
    if (!principal?.id || !principal.userCollection) return;
    try {
      const userRef = doc(db, principal.userCollection, principal.id);
      await updateDoc(userRef, {
        collegeId: targetId
      });
      toast({
        title: 'Institution Switched',
        description: `Switched context to ${colleges.find(c => c.id === targetId)?.name || 'selected institution'}.`
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Switch failed',
        description: 'Failed to change the active institution.'
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="dashboard-college-select" className="sr-only">
        Active College
      </Label>
      <Select
        value={principal?.collegeId || ''}
        onValueChange={handleSwitchCollege}
      >
        <SelectTrigger id="dashboard-college-select" className="w-[180px] sm:w-[220px] bg-background text-foreground border shadow-sm">
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

function AcademicYearSelect() {
  const { selectedAcademicYear, setSelectedAcademicYear, availableAcademicYears } =
    useAcademicYear();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="account-manager-academic-year" className="sr-only">
        Academic Year
      </Label>
      <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
        <SelectTrigger id="account-manager-academic-year" className="w-[140px] sm:w-[160px]">
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

export interface NavGroup {
  label: string;
  items: {
    id: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }[];
}

export const accountNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', href: '/account-manager-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { id: 'chart-of-accounts', href: '/account-manager-dashboard?tab=chart-of-accounts', icon: FolderTree, label: 'Chart of Accounts' },
    ],
  },
  {
    label: 'Income & Operations',
    items: [
      { id: 'fee-accounting', href: '/account-manager-dashboard?tab=fee-accounting', icon: Receipt, label: 'Fee Accounting' },
      { id: 'income-management', href: '/account-manager-dashboard?tab=income-management', icon: TrendingUp, label: 'Income & Grants' },
      { id: 'expense-management', href: '/account-manager-dashboard?tab=expense-management', icon: TrendingDown, label: 'Expenses' },
      { id: 'vouchers', href: '/account-manager-dashboard?tab=vouchers', icon: FileText, label: 'Vouchers' },
    ],
  },
  {
    label: 'Ledgers & Cash Flow',
    items: [
      { id: 'general-ledger', href: '/account-manager-dashboard?tab=general-ledger', icon: BookOpen, label: 'General Ledger' },
      { id: 'journal-entries', href: '/account-manager-dashboard?tab=journal-entries', icon: FileCode, label: 'Journal Entries' },
      { id: 'cash-management', href: '/account-manager-dashboard?tab=cash-management', icon: Wallet, label: 'Cash Book' },
      { id: 'bank-management', href: '/account-manager-dashboard?tab=bank-management', icon: Landmark, label: 'Bank Accounts' },
    ],
  },
  {
    label: 'Payroll & Vendors',
    items: [
      { id: 'payroll-accounting', href: '/account-manager-dashboard?tab=payroll-accounting', icon: Users, label: 'Payroll' },
      { id: 'vendor-accounting', href: '/account-manager-dashboard?tab=vendor-accounting', icon: Users, label: 'Vendors' },
      { id: 'fixed-assets', href: '/account-manager-dashboard?tab=fixed-assets', icon: Building2, label: 'Fixed Assets' },
    ],
  },
  {
    label: 'Reports & Compliance',
    items: [
      { id: 'financial-reports', href: '/account-manager-dashboard?tab=financial-reports', icon: BarChart3, label: 'Reports' },
      { id: 'tax-management', href: '/account-manager-dashboard?tab=tax-management', icon: ShieldCheck, label: 'Tax' },
      { id: 'audit-logs', href: '/account-manager-dashboard?tab=audit-logs', icon: History, label: 'Audit Logs' },
      { id: 'import-export', href: '/account-manager-dashboard?tab=import-export', icon: FileSpreadsheet, label: 'Import / Export' },
      { id: 'settings', href: '/account-manager-dashboard?tab=settings', icon: Settings, label: 'Settings' },
    ],
  },
];

function AccountManagerSidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get('tab') || 'dashboard';

  return (
    <SidebarContent className="px-2 py-1 space-y-3">
      {accountNavGroups.map((group) => (
        <SidebarGroup key={group.label} className="p-0">
          <SidebarGroupLabel className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase px-2 py-1 select-none">
            {group.label}
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {group.items.map((item) => {
              const isTabActive =
                pathname === '/account-manager-dashboard' && currentTab === item.id;
              return (
                <SidebarMenuItem key={item.id}>
                  <Link href={item.href} className="w-full">
                    <SidebarMenuButton
                      isActive={isTabActive}
                      className={cn(
                        'justify-start gap-2.5 h-8.5 rounded-lg px-2.5 text-xs font-medium transition-all w-full',
                        isTabActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/95 hover:text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'size-4 shrink-0',
                          isTabActive ? 'text-primary-foreground' : 'text-muted-foreground'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}

export default function AccountManagerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const user = useCurrentPrincipal();

  const profilePlaceholder = PlaceHolderImages.find(
    (img) => img.id === 'principal-profile'
  );
  const profileAvatarUrl = user?.photoUrl ?? profilePlaceholder?.imageUrl;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const filteredNotifications = useMemo(
    () =>
      notifications
        .filter((n) => !n.recipientId || n.recipientId === user?.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [notifications, user?.id]
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
    if (!user?.collegeId) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('collegeId', '==', user.collegeId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
      );
    });
    return () => unsub();
  }, [user?.collegeId]);

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
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {notification.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.date).toLocaleString()}
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
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <Calculator className="size-6 text-primary" />
              <div>
                <h1 className="text-sm font-bold font-headline leading-none">
                  Accounting Portal
                </h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Account Manager
                </p>
              </div>
            </div>
          </SidebarHeader>
          <Suspense
            fallback={
              <SidebarContent className="p-4 text-xs text-muted-foreground flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading navigation...
              </SidebarContent>
            }
          >
            <AccountManagerSidebarNav />
          </Suspense>
          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/account-manager-dashboard/profile">
                  <SidebarMenuButton
                    className="justify-start gap-3"
                    isActive={pathname === '/account-manager-dashboard/profile'}
                  >
                    {profileAvatarUrl && (
                      <Image
                        src={profileAvatarUrl}
                        alt={user?.name ?? 'Account Manager'}
                        width={28}
                        height={28}
                        className="rounded-full object-cover"
                        style={{ width: 28, height: 28, objectFit: 'cover' }}
                        unoptimized={!!user?.photoUrl}
                      />
                    )}
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">
                        {user?.name ?? 'Account Manager'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {user?.email ?? '—'}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="justify-start gap-3 w-full cursor-pointer" onClick={async () => { await signOut(); router.push('/login'); }}>
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
                <Calculator className="size-6 text-primary" />
                <h1 className="text-lg font-semibold font-headline">
                  Accounting Department
                </h1>
              </div>
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-2">
              <CollegeSwitcher />
              <AcademicYearSelect />
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
