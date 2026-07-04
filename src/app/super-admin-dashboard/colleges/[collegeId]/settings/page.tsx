'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { College } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Save, ShieldAlert, Users, Landmark, BadgePercent, HelpCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CollegeSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const collegeId = params.collegeId as string;
  const { toast } = useToast();

  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Billing Module States
  const [module, setModule] = useState<'full-scale' | 'per-head'>('full-scale');
  const [oneTimeFee, setOneTimeFee] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0); // maintenance for full-scale, price per head for per-head

  // License & Payment States
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  // Counters for calculation
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [principalCount, setPrincipalCount] = useState(0);

  // Status states
  const [deactivationReasonInput, setDeactivationReasonInput] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!collegeId) return;

    const fetchData = async () => {
      try {
        // Fetch college
        const collegeSnap = await getDoc(doc(db, 'colleges', collegeId));
        if (collegeSnap.exists()) {
          const data = collegeSnap.data();
          setCollege({ ...data, id: collegeSnap.id } as College);
          
          const billing = (data as any).billing;
          if (billing) {
            setModule(billing.module || 'full-scale');
            setOneTimeFee(billing.oneTimeFee || 0);
            setAmount(billing.amount || 0);
            setPurchaseDate(billing.purchaseDate || '');
            setExpiryDate(billing.expiryDate || '');
            setPaymentLink(billing.paymentLink || '');
          }
        }

        // Fetch counts
        const studentQuery = query(collection(db, 'students'), where('collegeId', '==', collegeId));
        const studentSnap = await getDocs(studentQuery);
        setStudentCount(studentSnap.size);

        const teacherQuery = query(collection(db, 'teachers'), where('collegeId', '==', collegeId));
        const teacherSnap = await getDocs(teacherQuery);
        setTeacherCount(teacherSnap.size);

        const principalQuery = query(collection(db, 'principals'), where('collegeId', '==', collegeId));
        const principalSnap = await getDocs(principalQuery);
        setPrincipalCount(principalSnap.size);

      } catch (error) {
        console.error('Error fetching billing settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [collegeId]);

  const totalUsers = studentCount + teacherCount + principalCount;
  const calculatedAnnualBill = module === 'per-head' ? amount * totalUsers : amount;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'colleges', collegeId), {
        billing: {
          module,
          amount: Number(amount),
          oneTimeFee: module === 'full-scale' ? Number(oneTimeFee) : 0,
          purchaseDate,
          expiryDate,
          paymentLink,
          updatedAt: new Date().toISOString()
        }
      });

      toast({
        title: 'Settings Saved',
        description: 'Billing configuration has been successfully updated.'
      });
      router.push(`/super-admin-dashboard/colleges/${collegeId}`);
    } catch (error) {
      console.error('Error saving billing configuration:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Could not save configurations. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'colleges', collegeId), {
        status: 'active',
        deactivationReason: ''
      });
      setCollege(prev => prev ? { ...prev, status: 'active', deactivationReason: '' } as any : null);
      toast({
        title: 'College Activated',
        description: 'The college has been successfully activated. All users can now access their dashboards.'
      });
    } catch (err) {
      console.error('Error activating college:', err);
      toast({
        variant: 'destructive',
        title: 'Activation Failed',
        description: 'Could not activate college. Please try again.'
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivationReasonInput.trim()) return;
    setUpdatingStatus(true);
    try {
      await updateDoc(doc(db, 'colleges', collegeId), {
        status: 'deactivated',
        deactivationReason: deactivationReasonInput.trim()
      });
      setCollege(prev => prev ? { ...prev, status: 'deactivated', deactivationReason: deactivationReasonInput.trim() } as any : null);
      setDeactivationReasonInput('');
      toast({
        title: 'College Deactivated',
        description: 'The college has been deactivated. Users will see the deactivation page upon logging in.'
      });
    } catch (err) {
      console.error('Error deactivating college:', err);
      toast({
        variant: 'destructive',
        title: 'Deactivation Failed',
        description: 'Could not deactivate college. Please try again.'
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="text-center py-12">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-bold">College Not Found</h3>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/super-admin-dashboard')}>
          Back to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/super-admin-dashboard/colleges/${collegeId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground">{college.name} / Settings</div>
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight">Billing Configuration</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Sales Module</CardTitle>
            <CardDescription>
              Choose the appropriate licensing/pricing model for this institution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={module}
              onValueChange={(val) => setModule(val as 'full-scale' | 'per-head')}
              className="grid gap-6 md:grid-cols-2"
            >
              <div>
                <Label
                  htmlFor="full-scale"
                  className={`flex flex-col justify-between h-full border rounded-xl p-5 cursor-pointer hover:border-primary/50 transition-all ${
                    module === 'full-scale' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <RadioGroupItem value="full-scale" id="full-scale" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Full Scale Module</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Designed for colleges paying a flat, upfront cost for the system, accompanied by an annual maintenance fee.
                    </p>
                  </div>
                </Label>
              </div>

              <div>
                <Label
                  htmlFor="per-head"
                  className={`flex flex-col justify-between h-full border rounded-xl p-5 cursor-pointer hover:border-primary/50 transition-all ${
                    module === 'per-head' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                      <Users className="h-5 w-5" />
                    </div>
                    <RadioGroupItem value="per-head" id="per-head" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">Per Head Scale Module</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Subscription-based charging calculated annually based on the total number of registered active users.
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* License & Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              License Period & Payments
            </CardTitle>
            <CardDescription>
              Configure the license period and paste the payment link for billing renewal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase-date">Purchase Date</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry-date">Expiry Date / Renewal Due</Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-link">Renewal Payment Link (Stripe/Razorpay/UPI Checkout)</Label>
              <Input
                id="payment-link"
                type="url"
                placeholder="https://checkout.stripe.com/... or upi link"
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Billing Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Parameters</CardTitle>
            <CardDescription>
              Set the currency amounts and view calculations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {module === 'full-scale' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="one-time-fee">One-Time Setup Fee (₹)</Label>
                  <Input
                    id="one-time-fee"
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={oneTimeFee}
                    onChange={(e) => setOneTimeFee(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annual-maintenance">Annual Maintenance Fee (₹)</Label>
                  <Input
                    id="annual-maintenance"
                    type="number"
                    min="0"
                    placeholder="e.g. 10000"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-6">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="amount-per-head">Amount Per Head (₹ / user / year)</Label>
                  <Input
                    id="amount-per-head"
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="border rounded-xl p-4 bg-muted/40 space-y-3">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <BadgePercent className="h-4 w-4 text-emerald-600" />
                    Billing Estimate Breakdown
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>Students Registered:</div>
                    <div className="text-right font-medium text-foreground">{studentCount}</div>
                    <div>Teachers Registered:</div>
                    <div className="text-right font-medium text-foreground">{teacherCount}</div>
                    <div>Principals Registered:</div>
                    <div className="text-right font-medium text-foreground">{principalCount}</div>
                    <div className="border-t pt-2 font-semibold text-foreground">Total Users:</div>
                    <div className="border-t pt-2 text-right font-bold text-foreground">{totalUsers}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/30 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-b-xl">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Calculated Annual Bill:</div>
              <div className="text-2xl font-extrabold text-foreground">
                ₹ {calculatedAnnualBill.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ year</span>
              </div>
            </div>
            <Button type="submit" disabled={saving} className="gap-2 shrink-0">
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Activation & Deactivation Section */}
      <Card className="border-destructive/30">
        <CardHeader className="bg-destructive/5 border-b pb-4 rounded-t-xl">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <CardTitle className="text-lg">College Activation Status</CardTitle>
          </div>
          <CardDescription className="text-destructive/80 mt-1">
            Deactivating a college will immediately restrict access for all principals, teachers, and students to their dashboards. They will only see a deactivation notice with the reason provided below.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {college.status === 'deactivated' ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl space-y-2">
                <p className="font-bold text-sm flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  College is Deactivated
                </p>
                <p className="text-xs">
                  <strong>Reason:</strong> {(college as any).deactivationReason || 'No reason specified'}
                </p>
              </div>
              <Button 
                type="button" 
                variant="default"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleActivate}
                disabled={updatingStatus}
              >
                Activate College
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deactivation-reason">Reason for Deactivation</Label>
                <Input
                  id="deactivation-reason"
                  placeholder="Enter the reason for deactivating this college (e.g. unpaid fees, license expired)..."
                  value={deactivationReasonInput}
                  onChange={(e) => setDeactivationReasonInput(e.target.value)}
                  disabled={updatingStatus}
                />
              </div>
              <Button 
                type="button" 
                variant="destructive"
                onClick={handleDeactivate}
                disabled={updatingStatus || !deactivationReasonInput.trim()}
              >
                Deactivate College
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
