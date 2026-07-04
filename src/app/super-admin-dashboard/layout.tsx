'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  GraduationCap,
} from 'lucide-react';

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
import { useAuth } from '@/contexts/auth-context';

const navItems = [
  { href: '/super-admin-dashboard', icon: LayoutDashboard, label: 'Colleges' },
];

export default function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, superAdmin } = useAuth();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <GraduationCap className="size-6 text-primary" />
            <h1 className="text-lg font-semibold font-headline">
              CMS Portal
            </h1>
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
              <div className="px-3 py-2 flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {superAdmin?.name ?? 'Super Admin'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {superAdmin?.email ?? '—'}
                </span>
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                className="justify-start gap-3 w-full cursor-pointer" 
                onClick={async () => { 
                  await signOut(); 
                  router.push('/'); 
                }}
              >
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
                CMS Portal
              </h1>
            </div>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Super Admin Console
            </span>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
