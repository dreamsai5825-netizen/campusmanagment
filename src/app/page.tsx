'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  GraduationCap, 
  ArrowRight, 
  Download, 
  LogIn, 
  School, 
  Users, 
  BookOpen, 
  Landmark, 
  CheckCircle, 
  AlertOctagon,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  BadgePercent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LandingPage() {
  const router = useRouter();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownload = () => {
    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
    }, 3000);
    // Trigger download of a mock PDF brochure
    const link = document.createElement('a');
    link.href = '#';
    // link.download = 'CMS_Portal_Brochure.pdf'; // simulation
    toastDownload();
  };

  const toastDownload = () => {
    alert('Thank you! Campus Management System Product Brochure is being downloaded to your device.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-violet-500 selection:text-white font-sans overflow-x-hidden">
      {/* CSS Keyframe Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.03); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 8s ease-in-out infinite;
          animation-delay: 2s;
        }
        .pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }
      `}</style>

      {/* Grid background decorative */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 py-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <GraduationCap className="h-5.5 w-5.5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-violet-400 bg-clip-text text-transparent">
              Campus Management System
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-slate-300 hover:text-white hover:bg-slate-900 gap-1.5"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download brochure</span>
            </Button>
            <Button 
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20 gap-1.5"
              onClick={() => router.push('/login')}
            >
              <LogIn className="h-4 w-4" />
              <span>Login</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          
          {/* Left Column: Copy */}
          <div className="lg:col-span-6 space-y-6 text-left relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-semibold text-violet-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Modern College Management Suite</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              One Portal. <br />
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
                Infinite Control.
              </span>
            </h1>

            <p className="text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
              Campus Management System streamlines academic schedules, student tracking, communication nodes, financial records, and operational workflows into a single unified workspace.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button 
                size="lg" 
                className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/30 px-6 gap-2"
                onClick={() => router.push('/login')}
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-slate-800 hover:bg-slate-900/60 px-6"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore Features
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-900/80">
              <div>
                <p className="text-2xl font-bold text-white">100%</p>
                <p className="text-xs text-slate-500 mt-0.5">Secure Firestore Database</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">Real-time</p>
                <p className="text-xs text-slate-500 mt-0.5">Push Notifications</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">0-config</p>
                <p className="text-xs text-slate-500 mt-0.5">PWA Installation</p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive CSS UI Preview */}
          <div className="lg:col-span-6 relative flex justify-center">
            {/* Ambient background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-600/10 blur-[80px] pointer-events-none pulse-glow" />

            {/* Simulated Desktop App frame */}
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5 shadow-2xl shadow-black/80 animate-float">
              {/* Window Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/60" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <span className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <span className="text-[10px] text-slate-500 font-mono">cms-portal.edu</span>
                <div className="w-12" />
              </div>

              {/* Mock Dashboard Dashboard screen */}
              <div className="bg-slate-950 p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500">Overview</span>
                    <h4 className="text-sm font-bold text-white">Annapurna Institute</h4>
                  </div>
                  <BadgePercent className="h-4 w-4 text-violet-400" />
                </div>

                {/* Dashboard grid mock widgets */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="text-[10px] text-slate-500 font-medium">Students Enrolled</span>
                    <div className="text-lg font-bold text-white mt-0.5">82</div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full" style={{ width: '75%' }} />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="text-[10px] text-slate-500 font-medium">Faculty Members</span>
                    <div className="text-lg font-bold text-white mt-0.5">7</div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full" style={{ width: '45%' }} />
                    </div>
                  </div>
                </div>

                {/* Live transaction bar chart SVG mock */}
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-medium">Fee Book Metrics (₹)</span>
                    <span className="text-[10px] text-emerald-400 font-bold">Collected: 85%</span>
                  </div>
                  <div className="h-16 flex items-end justify-between px-2 pt-2 gap-1.5">
                    <div className="bg-slate-800 hover:bg-violet-600/30 rounded-t w-full h-8 transition-colors" />
                    <div className="bg-slate-800 hover:bg-violet-600/30 rounded-t w-full h-12 transition-colors" />
                    <div className="bg-slate-800 hover:bg-violet-600/30 rounded-t w-full h-10 transition-colors" />
                    <div className="bg-violet-600 rounded-t w-full h-14" />
                    <div className="bg-slate-800 hover:bg-violet-600/30 rounded-t w-full h-6 transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative second card floating behind */}
            <div className="absolute -bottom-6 -right-4 w-48 rounded-xl border border-slate-800 bg-slate-950/90 p-3 shadow-lg shadow-black/50 animate-float-delayed hidden sm:block">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded bg-amber-500/20 text-amber-500">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">License Status</span>
              </div>
              <p className="text-[11px] font-semibold text-white">Expiry: 245 Days left</p>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-2">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '65%' }} />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Feature Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-900 bg-slate-950/40 relative">
        {/* Grid background decorative */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1.5px,transparent_1.5px),linear-gradient(to_bottom,#0f172a_1.5px,transparent_1.5px)] bg-[size:6rem_6rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-16 relative z-10">
          
          {/* Section heading */}
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-xs font-semibold text-emerald-400">
              <span>All-In-One Unified Platform</span>
            </div>
            <h2 className="text-3xl font-extrabold font-headline tracking-tight sm:text-4xl">
              Role-Scoped Dashboard Features
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Campus Management System provides custom interfaces tailored specifically for the key stakeholders of your college.
            </p>
          </div>

          {/* 3 Floating Cards Grid */}
          <div className="grid gap-8 md:grid-cols-3">
            
            {/* Principal Card */}
            <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6 sm:p-8 hover:bg-slate-900/50 hover:border-violet-500/30 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-600/5">
              <div className="space-y-6">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                  <School className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-violet-400 transition-colors">
                    Principal Control Suite
                  </h3>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Executive Administration
                  </p>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    A comprehensive cockpit designed for executive management to oversee the entire ecosystem.
                  </p>
                </div>
                <ul className="space-y-3.5 pt-2">
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Manage the system with features like finance, student & teacher details</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Generate & print receipts complete with custom college branding</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8 mt-auto border-t border-slate-900/60">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Institution Stats</span>
                <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Enrolled Students:</span>
                    <span className="font-bold text-white">1,200+</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Active Faculty Members:</span>
                    <span className="font-bold text-white">60+</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Teacher Card */}
            <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6 sm:p-8 hover:bg-slate-900/50 hover:border-violet-500/30 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-600/5">
              <div className="space-y-6">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300">
                  <Users className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-violet-400 transition-colors">
                    Faculty Planner Console
                  </h3>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Academic Planning
                  </p>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Dedicated console enabling teachers to organize lectures, communicate, and grade students.
                  </p>
                </div>
                <ul className="space-y-3.5 pt-2">
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Direct communication channels with parents, teachers, and students</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Log classroom attendance records and daily checklists</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Manage assignments, detailed assessments, and announcements</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8 mt-auto border-t border-slate-900/60">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Class Schedule & Grading</span>
                <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Class Attendance:</span>
                    <span className="font-semibold text-emerald-400">92%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Submissions:</span>
                    <span className="font-semibold text-violet-400">18 / 20 Students</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Card */}
            <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6 sm:p-8 hover:bg-slate-900/50 hover:border-violet-500/30 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-violet-600/5">
              <div className="space-y-6">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-violet-400 transition-colors">
                    Student Portal
                  </h3>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Personalized Workspace
                  </p>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Interactive dashboard for students to interact with their classes and track academic history.
                  </p>
                </div>
                <ul className="space-y-3.5 pt-2">
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Communicate directly with your teachers in personal chat rooms</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Submit assignments digitally and review teacher comments</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-slate-300 text-sm">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Track your class attendance records and check assessment marks</span>
                  </li>
                </ul>
              </div>
              <div className="pt-8 mt-auto border-t border-slate-900/60">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">My Fee Account Summary</span>
                <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/60 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Paid:</span>
                    <span className="font-extrabold text-emerald-400">₹ 24,000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Outstanding:</span>
                    <span className="font-extrabold text-amber-500">₹ 4,000</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Feature Grid / Quality metrics */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900 bg-slate-950/80">
        <div className="max-w-7xl mx-auto space-y-12 text-center">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-headline">Engineered for Academic Excellence</h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">
              Campus Management System integrates state-of-the-art technologies to ensure stability, performance, and security.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-slate-900/30 border-slate-800/80 hover:border-slate-800 transition-colors">
              <CardContent className="pt-6 space-y-3 text-left">
                <div className="p-2.5 rounded-lg bg-violet-600/10 text-violet-400 w-fit">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-white text-base">Complete Data Integrity</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Utilizes fine-grained Firebase Security Rules to restrict document read/write processes based strictly on user roles and college parameters.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 border-slate-800/80 hover:border-slate-800 transition-colors">
              <CardContent className="pt-6 space-y-3 text-left">
                <div className="p-2.5 rounded-lg bg-emerald-600/10 text-emerald-400 w-fit">
                  <Zap className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-white text-base">Instant Sync (Real-time)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Built-in reactive listeners query updates instantly. Whenever a principal broadcasts announcements or deactivates a login, dashboards switch immediately.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/30 border-slate-800/80 hover:border-slate-800 transition-colors">
              <CardContent className="pt-6 space-y-3 text-left">
                <div className="p-2.5 rounded-lg bg-blue-600/10 text-blue-400 w-fit">
                  <Globe className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-white text-base">Offline Capabilities (PWA)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Supports progressive web app features, enabling students to access class timetables, calendar schedules, and contact sheets offline.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-900 bg-slate-950/20 relative">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-extrabold font-headline sm:text-4xl text-white">
            Ready to Streamline Your College Administration?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Get started today. Sign up your college portal or request a product demo to explore our full-scale features.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Button 
              size="lg" 
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/25 px-8 gap-2"
              onClick={() => router.push('/login')}
            >
              Sign In Now
              <LogIn className="h-4 w-4" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-slate-800 hover:bg-slate-900/60 px-8"
              onClick={handleDownload}
            >
              Download Brochure
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-900 bg-slate-950 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-600 space-y-2">
        <div className="flex justify-center items-center gap-2 mb-2">
          <div className="h-6 w-6 rounded bg-violet-600 flex items-center justify-center">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">
            Campus Management System
          </span>
        </div>
        <p>&copy; {new Date().getFullYear()} Campus Management System. All rights reserved.</p>
        <p>Built with Next.js, Firebase Firestore, and Tailwind CSS.</p>
      </footer>
    </div>
  );
}
