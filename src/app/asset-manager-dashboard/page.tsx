'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCurrentPrincipal } from '@/hooks/use-current-user';
import { 
  Boxes, 
  Wrench, 
  ClipboardCheck, 
  FileSpreadsheet, 
  PlusCircle, 
  Clock, 
  Activity, 
  AlertTriangle,
  History,
  ClipboardList,
  MessageSquare,
  Send
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function AssetManagerDashboardPage() {
  const principal = useCurrentPrincipal(); // Resolves the current Asset Manager user

  const [loading, setLoading] = useState(true);
  const [totalAssets, setTotalAssets] = useState(0);
  const [allocatedCount, setAllocatedCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [procurementCount, setProcurementCount] = useState(0);
  
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [activeMaintenance, setActiveMaintenance] = useState<any[]>([]);

  useEffect(() => {
    if (!principal?.collegeId) return;

    // 1. Listen to assets to compute Total Cataloged Assets
    const unsubAssets = onSnapshot(
      query(collection(db, 'assets'), where('collegeId', '==', principal.collegeId)),
      (snapshot) => {
        let total = 0;
        snapshot.docs.forEach(doc => {
          const qty = doc.data().quantity || 0;
          total += qty;
        });
        setTotalAssets(total);
      }
    );

    // 2. Listen to asset_requests to compute Currently Allocated & recent activities
    const unsubRequests = onSnapshot(
      query(collection(db, 'asset_requests'), where('collegeId', '==', principal.collegeId)),
      (snapshot) => {
        let allocated = 0;
        const reqList: any[] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.status === 'accepted') {
            allocated += (data.quantity || 1);
          }
          reqList.push({
            id: doc.id,
            action: data.assetName,
            details: `Requested by ${data.requestedBy} (${data.department || 'Dept'})`,
            date: data.requestedAt || new Date().toISOString(),
            status: data.status === 'accepted' ? 'allocated' : data.status === 'rejected' ? 'returned' : 'pending'
          });
        });
        setAllocatedCount(allocated);

        // Update recent activities merged with transfers
        updateRecentActivities(reqList, null);
      }
    );

    // 3. Listen to asset_transfers for recent activities
    const unsubTransfers = onSnapshot(
      query(collection(db, 'asset_transfers'), where('collegeId', '==', principal.collegeId)),
      (snapshot) => {
        const transferList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            action: data.assetName,
            details: `Transferred from ${data.fromDept} to ${data.toDept}`,
            date: data.transferredAt || new Date().toISOString(),
            status: 'added' // custom class style
          };
        });

        updateRecentActivities(null, transferList);
      }
    );

    // 4. Listen to management_requests to compute maintenance & procurement counts and fill Maintenance Queue
    const unsubMgtRequests = onSnapshot(
      query(collection(db, 'management_requests'), where('collegeId', '==', principal.collegeId)),
      (snapshot) => {
        let maint = 0;
        let procur = 0;
        const maintQueue: any[] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'maintenance') {
            if (data.status === 'pending' || data.status === 'approved') {
              maint++;
            }
            if (data.status === 'pending') {
              maintQueue.push({
                item: data.assetName,
                issue: data.description || 'Inspection scheduled',
                priority: data.priority || 'Medium',
                scheduled: data.requestedAt ? new Date(data.requestedAt).toLocaleDateString() : 'Pending Schedule'
              });
            }
          } else if (data.type === 'procurement' && data.status === 'pending') {
            procur++;
          }
        });
        setMaintenanceCount(maint);
        setProcurementCount(procur);
        setActiveMaintenance(maintQueue.slice(0, 5)); // show top 5 maintenance items
      }
    );

    let cachedReqs: any[] = [];
    let cachedTransfers: any[] = [];

    function updateRecentActivities(reqs: any[] | null, transfers: any[] | null) {
      if (reqs) cachedReqs = reqs;
      if (transfers) cachedTransfers = transfers;

      const merged = [...cachedReqs, ...cachedTransfers];
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Map formatting for display
      const formatted = merged.map(item => {
        const timeDiff = Date.now() - new Date(item.date).getTime();
        const mins = Math.floor(timeDiff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        
        let timeStr = 'Just now';
        if (days > 0) timeStr = `${days} day${days > 1 ? 's' : ''} ago`;
        else if (hours > 0) timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        else if (mins > 0) timeStr = `${mins} min${mins > 1 ? 's' : ''} ago`;

        return {
          ...item,
          time: timeStr
        };
      });

      setRecentActivities(formatted.slice(0, 5));
      setLoading(false);
    }

    return () => {
      unsubAssets();
      unsubRequests();
      unsubTransfers();
      unsubMgtRequests();
    };
  }, [principal?.collegeId]);

  const stats = [
    { title: 'Total Cataloged Assets', value: totalAssets.toLocaleString(), change: 'Real-time count', icon: Boxes, color: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400' },
    { title: 'Currently Allocated', value: allocatedCount.toLocaleString(), change: 'Active rentals', icon: ClipboardCheck, color: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400' },
    { title: 'Under Maintenance', value: maintenanceCount.toLocaleString(), change: 'Repairs registered', icon: Wrench, color: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400' },
    { title: 'Pending Procurement', value: procurementCount.toLocaleString(), change: 'Awaiting admin approval', icon: FileSpreadsheet, color: 'from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            Asset Manager Dashboard
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Welcome back, {principal?.name ?? 'Asset Manager'}! Here is your facility equipment snapshot.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/asset-manager-dashboard/inventory">
            <Button className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-md">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="overflow-hidden border-border/80 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-500" />
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Operations */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Quick Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/asset-manager-dashboard/requests">
            <Card className="cursor-pointer border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-blue-500/50 hover:bg-blue-500/5 group relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-blue-500/15 to-indigo-500/15 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-lg font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Requests</CardTitle>
                  <CardDescription className="text-xs">Manage asset requests from departments</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex-grow">
                <p className="text-sm text-muted-foreground">
                  Review, accept, or reject incoming departmental requests. Allocate tenure details and record remarks.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/asset-manager-dashboard/inventory">
            <Card className="cursor-pointer border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-emerald-500/50 hover:bg-emerald-500/5 group relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                  <Boxes className="h-6 w-6" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-lg font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Inventory</CardTitle>
                  <CardDescription className="text-xs">Manage departments & asset catalog</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex-grow">
                <p className="text-sm text-muted-foreground">
                  Organize assets by department. Register items with name, type, serial number, condition, and quantities.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/asset-manager-dashboard/request-management">
            <Card className="cursor-pointer border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-purple-500/50 hover:bg-purple-500/5 group relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-lg font-bold group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Request Management</CardTitle>
                  <CardDescription className="text-xs">Request admin maintenance or procurement</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex-grow">
                <p className="text-sm text-muted-foreground">
                  Send requests to College Admin for repair work, maintenance schedules, or procurement of new assets.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/asset-manager-dashboard/send-asset">
            <Card className="cursor-pointer border border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-amber-500/50 hover:bg-amber-500/5 group relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-amber-500/15 to-orange-500/15 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
                  <Send className="h-6 w-6" />
                </div>
                <div className="space-y-0.5">
                  <CardTitle className="text-lg font-bold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Send Asset</CardTitle>
                  <CardDescription className="text-xs">Transfer equipment between departments</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-2 flex-grow">
                <p className="text-sm text-muted-foreground">
                  Transfer assets by cataloging source department, target destination, condition, and quantities.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Recent Allocations & Returns</CardTitle>
              <CardDescription>Real-time updates of asset movement across the campus.</CardDescription>
            </div>
            <History className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-muted/40">
                  <tr>
                    <th scope="col" className="px-4 py-3">Asset</th>
                    <th scope="col" className="px-4 py-3">Details</th>
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentActivities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{activity.action}</td>
                      <td className="px-4 py-3 text-muted-foreground">{activity.details}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{activity.time}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          activity.status === 'allocated' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/35 dark:text-blue-300' :
                          activity.status === 'returned' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-300' :
                          activity.status === 'maintenance' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-300' :
                          'bg-purple-100 text-purple-800 dark:bg-purple-900/35 dark:text-purple-300'
                        }`}>
                          {activity.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recentActivities.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        No recent asset activities recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Queue */}
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Maintenance Queue</CardTitle>
              <CardDescription>Scheduled inspections and updates.</CardDescription>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {activeMaintenance.map((m, idx) => (
              <div key={idx} className="flex flex-col gap-1 p-3 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm line-clamp-1">{m.item}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    m.priority === 'High' ? 'bg-red-500/10 text-red-500' :
                    m.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-slate-500/10 text-slate-500'
                  }`}>
                    {m.priority}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-1">{m.issue}</span>
                <span className="text-[10px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Scheduled: {m.scheduled}
                </span>
              </div>
            ))}
            {activeMaintenance.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No active maintenance logs.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
