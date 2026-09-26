'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  Search, 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  ArrowUpDown
} from 'lucide-react';

interface DemoBooking {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  institution: string;
  role: string;
  preferredDate: string;
  message: string;
  status: 'pending' | 'contacted' | 'completed';
  createdAt: string;
}

export default function DemoBookingsPage() {
  const [bookings, setBookings] = useState<DemoBooking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'contacted' | 'completed'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'demo_bookings'), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as DemoBooking[];
      
      // Sort by createdAt descending (newest first)
      list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
      
      setBookings(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'contacted' | 'completed') => {
    try {
      const docRef = doc(db, 'demo_bookings', id);
      await updateDoc(docRef, { status: newStatus });
    } catch (err) {
      console.error('Error updating status: ', err);
      alert('Failed to update status.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this booking request?')) return;
    try {
      const docRef = doc(db, 'demo_bookings', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting: ', err);
      alert('Failed to delete booking request.');
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch = 
      b.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="h-3 w-3" /> Contacted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Demo Booking Sessions
        </h1>
        <p className="text-muted-foreground">
          Review and manage all incoming public requests for portal demonstration tours.
        </p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 max-w-md w-full bg-background rounded-lg border px-3 py-1.5">
          <Search className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            placeholder="Search name, institution, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-1 h-7"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
              statusFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted text-muted-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-background hover:bg-muted text-muted-foreground'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('contacted')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
              statusFilter === 'contacted'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-background hover:bg-muted text-muted-foreground'
            }`}
          >
            Contacted
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-background hover:bg-muted text-muted-foreground'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredBookings.length > 0 ? (
        <div className="grid gap-6">
          {filteredBookings.map((b) => (
            <Card key={b.id} className="hover:shadow-md transition-all duration-300 border-l-4" style={{
              borderLeftColor: b.status === 'completed' ? '#10b981' : b.status === 'contacted' ? '#2563eb' : '#f59e0b'
            }}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground" /> {b.fullName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-1 font-medium text-primary">
                      <Building2 className="h-4 w-4" /> {b.institution} ({b.role})
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(b.status)}
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/15 rounded-lg border transition-colors"
                      title="Delete request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Information grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-muted/40 rounded-xl p-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${b.email}`} className="text-primary hover:underline">{b.email}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${b.phone}`} className="hover:underline">{b.phone}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Preferred: <strong>{new Date(b.preferredDate).toLocaleDateString()}</strong></span>
                  </div>
                </div>

                {/* Requirements / message */}
                {b.message && (
                  <div className="bg-card border rounded-lg p-3 text-sm relative">
                    <div className="absolute -top-2 left-3 px-1.5 bg-card text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" /> Message / Notes
                    </div>
                    <p className="text-foreground leading-relaxed mt-1 whitespace-pre-line">{b.message}</p>
                  </div>
                )}

                {/* Submited timestamp and action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t text-xs text-muted-foreground">
                  <span>Received: {b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}</span>
                  
                  <div className="flex gap-2">
                    {b.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(b.id, 'contacted')}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        Mark Contacted
                      </button>
                    )}
                    {b.status !== 'completed' && (
                      <button
                        onClick={() => handleUpdateStatus(b.id, 'completed')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-xl bg-card">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-semibold text-lg text-foreground">No Booking Requests</h3>
          <p className="text-muted-foreground mt-1">
            {statusFilter === 'all'
              ? 'There are no demo bookings in the database.'
              : `There are no booking requests marked as "${statusFilter}".`}
          </p>
        </div>
      )}
    </div>
  );
}
