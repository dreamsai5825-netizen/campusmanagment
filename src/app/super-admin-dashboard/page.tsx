'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { College } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { School, Search, Building2, Calendar, ArrowRight, LifeBuoy } from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketCount, setTicketCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubColleges = onSnapshot(collection(db, 'colleges'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as College));
      setColleges(list);
      setLoading(false);
    });

    const unsubTickets = onSnapshot(collection(db, 'tickets'), (snap) => {
      setTicketCount(snap.size);
    });

    return () => {
      unsubColleges();
      unsubTickets();
    };
  }, []);

  const filteredColleges = colleges.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Colleges Directory
        </h1>
        <p className="text-muted-foreground">
          View and manage all registered colleges, their billing modules, students, and teachers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registered Colleges</CardTitle>
            <School className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '...' : colleges.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active institutions in the network</p>
          </CardContent>
        </Card>

        <Link href="/super-admin-dashboard/tickets">
          <Card className="bg-gradient-to-br from-violet-500/5 to-violet-500/10 border-violet-500/20 hover:border-violet-500/40 hover:shadow-md transition-all duration-300 group cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium group-hover:text-violet-600 transition-colors">Tickets</CardTitle>
              <LifeBuoy className="h-5 w-5 text-violet-500 group-hover:animate-spin" style={{ animationDuration: '3s' }} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{ticketCount}</div>
              <p className="text-xs text-muted-foreground mt-1">College queries requiring attention</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="flex items-center gap-2 max-w-md w-full bg-card rounded-lg border px-3 py-1">
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <Input
          type="text"
          placeholder="Search by name or college code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-1"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredColleges.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredColleges.map((college) => (
            <Link key={college.id} href={`/super-admin-dashboard/colleges/${college.id}`}>
              <Card className="h-full hover:border-primary/50 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col justify-between">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-mono font-semibold uppercase px-2.5 py-1 rounded-full bg-muted text-muted-foreground border">
                      {college.code}
                    </span>
                  </div>
                  <CardTitle className="text-xl font-bold mt-4 line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                    {college.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">
                    {college.address || 'No address provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 border-t mt-4 flex items-center justify-between py-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>Registered: {college.createdAt ? new Date(college.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-xl bg-card">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-semibold text-lg text-foreground">No Colleges Found</h3>
          <p className="text-muted-foreground mt-1">Try refining your search query or check back later.</p>
        </div>
      )}
    </div>
  );
}
