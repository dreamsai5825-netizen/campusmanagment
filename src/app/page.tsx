'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { 
  ArrowRight, 
  Menu, 
  X, 
  Layers, 
  Monitor, 
  TrendingUp, 
  BookOpen, 
  Users, 
  Shield, 
  Calendar, 
  Clock, 
  Award, 
  MapPin, 
  Mail, 
  Phone,
  CheckCircle,
  ChevronDown,
  Download
} from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'erp' | 'lms'>('erp');
  const [activeStakeholder, setActiveStakeholder] = useState<'admin' | 'teacher' | 'student' | 'principal'>('admin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [preloaderWord, setPreloaderWord] = useState('Simplify');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Preloader words cycling animation
    const words = ['Simplify', 'Connect', 'Succeed'];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % words.length;
      setPreloaderWord(words[index]);
    }, 600);

    const timer = setTimeout(() => {
      setLoading(false);
      clearInterval(interval);
    }, 2000);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDownloadClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('PWA install prompt error:', err);
      }
    } else {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (!isMobile) {
        // Direct download of desktop shortcut file (.url)
        const origin = window.location.origin;
        const shortcutContent = `[InternetShortcut]\r\nURL=${origin}\r\nIconFile=${origin}/favicon.ico\r\nIconIndex=0\r\n`;
        const blob = new Blob([shortcutContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'CampusConnect.url';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Mobile fallback instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          alert("To install CampusConnect on iOS: Tap the Share button in Safari, then select 'Add to Home Screen'.");
        } else {
          alert("To install CampusConnect on Android: Tap Chrome's menu (three dots), then select 'Install app' or 'Add to Home screen'.");
        }
      }
    }
  };

  const stakeholders = [
    {
      id: 'admin' as const,
      label: 'Smarter Administration',
      title: 'Automated Administrative & Compliance Workflows',
      desc: 'Empower your management team to run the campus effortlessly, save time, and maintain full transparency.',
      points: [
        'Enquiry & lead tracking with automated pipeline stages.',
        'Razorpay, Paytm, and UPI gateway integrations for instant fee collection.',
        'Real-time UDISE+ and CBCS-ready reporting frameworks.',
        'Biometric, RFID, and Wi-Fi IP tracking auto-synced with staff HR.'
      ],
      screenshot: '/images/screenshots/admin/Screenshot 2026-07-08 155201.png'
    },
    {
      id: 'teacher' as const,
      label: 'Teachers',
      title: 'Simplified Lesson Delivery & Assessment Prep',
      desc: 'Free up your faculty from administrative tasks so they can focus on what matters most—teaching.',
      points: [
        'Automated class scheduling and conflict-free timetable generation.',
        'AI-driven report cards and digital marksheet entries.',
        'Blended classroom dashboard to assign tasks and upload lessons.',
        'Instant messaging and announcements to parents and students.'
      ],
      screenshot: '/images/screenshots/teacher/Screenshot 2026-07-08 153952.png'
    },
    {
      id: 'student' as const,
      label: 'Students',
      title: 'Dynamic Portals & Interactive Progress tracking',
      desc: 'Give students an intuitive, all-in-one digital companion for their academic journey.',
      points: [
        'Unified dashboard for schedules, marks, attendance, and fees.',
        'Digital homework submissions and learning resource repositories.',
        'Live engagement trackers and automatic event notifications.',
        'Profile mapping displaying course progress and grade history.'
      ],
      screenshot: '/images/screenshots/student/Screenshot 2026-07-08 154417.png'
    },
    {
      id: 'principal' as const,
      label: 'Principals / Directors',
      title: 'Real-Time Insights & Institutional Governance',
      desc: 'Get complete visual metrics and analytical models to lead your school or college with confidence.',
      points: [
        'High-level dashboards tracking attendance, registration, and finances.',
        'Outcomes-Based Education (OBE) and NBA compliance audit trails.',
        'Resource utilization reports for transport, classrooms, and staff.',
        'Automated notifications to manage parent outreach and campus safety.'
      ],
      screenshot: '/images/screenshots/principal/Screenshot 2026-07-08 152313.png'
    }
  ];

  return (
    <div className="edu-erp-landing">
      {/* CSS Scoped Style Tags */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');

        .edu-erp-landing {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
          background: #03001e;
          background: linear-gradient(to right, #0f0c1b, #24243e, #0f0c1b);
          min-height: 100vh;
          width: 100%;
          color: white;
          position: relative;
          overflow-x: hidden;
        }

        .edu-erp-landing * {
          box-sizing: border-box;
        }

        /* Preloader Animation Styles */
        .preloader {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #050816;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          transition: transform 0.8s cubic-bezier(0.77, 0, 0.175, 1);
        }

        .preloader.fade-out {
          transform: translateY(-100%);
        }

        .preloader-content {
          text-align: center;
        }

        .preloader-word {
          font-size: 4rem;
          font-weight: 800;
          color: #fcb900;
          animation: slideUpWord 0.6s ease infinite alternate;
          background: linear-gradient(to right, #ffffff, #fcb900);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @keyframes slideUpWord {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Navigation Bar */
        .edu-erp-landing nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 8%;
          position: sticky;
          top: 0;
          backdrop-filter: blur(25px);
          background: rgba(5, 8, 22, 0.7);
          border-bottom: 1px solid rgba(255, 255, 255, .08);
          z-index: 500;
        }

        .edu-erp-landing .logo {
          font-size: 30px;
          font-weight: 800;
          background: linear-gradient(to right, #ffffff, #9333ea);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .edu-erp-landing nav .nav-links {
          display: flex;
          align-items: center;
          gap: 30px;
        }

        .edu-erp-landing nav a {
          color: white;
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .edu-erp-landing nav a:hover {
          color: #fcb900;
        }

        .edu-erp-landing nav .btn-login {
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 10px 20px;
          border-radius: 8px;
          transition: background 0.3s, border-color 0.3s;
        }

        .edu-erp-landing nav .btn-login:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: white;
          color: white;
        }

        .edu-erp-landing nav .btn-demo {
          padding: 12px 24px;
          background: #fcb900;
          border: none;
          color: #050816;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(252, 185, 0, 0.2);
        }

        .edu-erp-landing nav .btn-demo:hover {
          background: #ffb900;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(252, 185, 0, 0.4);
        }

        .menu-toggle {
          display: none;
          cursor: pointer;
          background: none;
          border: none;
          color: white;
        }

        @media (max-width: 991px) {
          .menu-toggle {
            display: block;
          }

          .edu-erp-landing nav .nav-links {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            width: 100%;
            background: rgba(5, 8, 22, 0.95);
            backdrop-filter: blur(20px);
            padding: 30px 5%;
            flex-direction: column;
            gap: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .edu-erp-landing nav .nav-links.open {
            display: flex;
          }
        }

        /* Hero Section */
        .hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 100px 8%;
          min-height: 85vh;
          position: relative;
          z-index: 10;
        }

        .hero-left {
          width: 48%;
        }

        .hero-left h1 {
          font-size: 55px;
          line-height: 1.15;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #9333ea 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 20px;
        }

        .hero-left p {
          margin: 25px 0;
          font-size: 18px;
          color: #cbd5e1;
          line-height: 1.6;
        }

        .hero-ctas {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        .hero-primary {
          padding: 16px 36px;
          font-size: 16px;
          background: #fcb900;
          border: none;
          border-radius: 10px;
          color: #050816;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(252, 185, 0, 0.25);
        }

        .hero-primary:hover {
          background: #ffb900;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(252, 185, 0, 0.45);
        }

        .hero-secondary {
          padding: 16px 36px;
          font-size: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          color: white;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .hero-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .hero-download {
          padding: 16px 36px;
          font-size: 16px;
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
          border: none;
          border-radius: 10px;
          color: white;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.25);
        }

        .hero-download:hover {
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(124, 58, 237, 0.45);
        }

        .hero-right {
          width: 48%;
          position: relative;
          height: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Hero Floating Screenshot Cards Stack */
        .hero-stack-bg {
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, rgba(147, 51, 234, 0.15) 0%, transparent 70%);
          filter: blur(40px);
          z-index: 1;
        }

        .hero-card {
          position: absolute;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(10px);
          z-index: 2;
        }

        .hero-card img {
          width: 100%;
          height: auto;
          display: block;
        }

        .hero-card.primary {
          width: 85%;
          top: 10%;
          left: 5%;
          animation: floatPrimary 6s ease-in-out infinite alternate;
          z-index: 4;
        }

        .hero-card.secondary {
          width: 65%;
          bottom: 10%;
          right: 5%;
          animation: floatSecondary 8s ease-in-out infinite alternate;
          z-index: 5;
        }

        @keyframes floatPrimary {
          0% {
            transform: translateY(0) rotate(-2deg);
          }
          100% {
            transform: translateY(-20px) rotate(1deg);
          }
        }

        @keyframes floatSecondary {
          0% {
            transform: translateY(0) rotate(3deg);
          }
          100% {
            transform: translateY(-25px) rotate(-1deg);
          }
        }

        @media (max-width: 991px) {
          .hero {
            flex-direction: column;
            padding: 60px 5%;
            gap: 60px;
            text-align: center;
          }

          .hero-left, .hero-right {
            width: 100%;
          }

          .hero-left h1 {
            font-size: 38px;
          }

          .hero-ctas {
            justify-content: center;
          }

          .hero-right {
            height: 380px;
          }
        }

        /* Infinite Marquee Banner */
        .marquee-section {
          background: rgba(255, 255, 255, 0.02);
          border-y: 1px solid rgba(255, 255, 255, 0.06);
          padding: 22px 0;
          overflow: hidden;
          white-space: nowrap;
          position: relative;
          z-index: 10;
        }

        .marquee-container {
          display: inline-flex;
          animation: marquee 35s linear infinite;
          gap: 60px;
        }

        .marquee-item {
          display: flex;
          align-items: center;
          gap: 15px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 600;
          font-size: 16px;
        }

        .marquee-item span.dot {
          width: 8px;
          height: 8px;
          background: #fcb900;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 10px #fcb900;
        }

        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        /* Interactive ERP vs LMS Solutions Section */
        .solutions-section {
          padding: 100px 8%;
          position: relative;
          z-index: 10;
        }

        .section-header {
          text-align: center;
          max-width: 800px;
          margin: 0 auto 60px;
        }

        .section-header h2 {
          font-size: 42px;
          font-weight: 800;
          margin-bottom: 20px;
          background: linear-gradient(to right, #fff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .section-header p {
          font-size: 18px;
          color: #cbd5e1;
        }

        .solutions-tabs {
          display: flex;
          justify-content: center;
          margin-bottom: 50px;
        }

        .tabs-container {
          display: flex;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 6px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .tab-btn {
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: transparent;
          color: #cbd5e1;
          transition: all 0.3s;
        }

        .tab-btn.active {
          background: #fcb900;
          color: #050816;
          box-shadow: 0 4px 12px rgba(252, 185, 0, 0.2);
        }

        .solutions-grid {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 60px;
        }

        .solutions-features {
          width: 45%;
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .feature-item-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 24px;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }

        .feature-item-card:hover {
          transform: translateX(10px);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(252, 185, 0, 0.3);
        }

        .feature-item-card h3 {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .feature-item-card h3 span.badge {
          background: rgba(252, 185, 0, 0.1);
          color: #fcb900;
          font-size: 12px;
          padding: 3px 10px;
          border-radius: 12px;
          font-weight: 500;
        }

        .feature-item-card p {
          color: #cbd5e1;
          line-height: 1.6;
        }

        .solutions-preview {
          width: 50%;
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          aspect-ratio: 16/10;
        }

        .solutions-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: opacity 0.5s ease;
        }

        @media (max-width: 991px) {
          .solutions-section {
            padding: 60px 5%;
          }

          .solutions-grid {
            flex-direction: column;
            gap: 40px;
          }

          .solutions-features, .solutions-preview {
            width: 100%;
          }
        }

        /* Stakeholder Empowerment Section ("EDU for...") */
        .stakeholders-section {
          padding: 100px 8%;
          background: rgba(255, 255, 255, 0.01);
          border-y: 1px solid rgba(255, 255, 255, 0.04);
          position: relative;
          z-index: 10;
        }

        .stakeholders-tabs-wrap {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 50px;
        }

        .stakeholder-tab {
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 30px;
          color: #cbd5e1;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
        }

        .stakeholder-tab.active {
          background: #fcb900;
          color: #050816;
          border-color: #fcb900;
          box-shadow: 0 4px 15px rgba(252, 185, 0, 0.25);
        }

        .stakeholder-tab:hover:not(.active) {
          background: rgba(255, 255, 255, 0.07);
          color: white;
        }

        .stakeholder-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 60px;
        }

        .stakeholder-text {
          width: 45%;
        }

        .stakeholder-text h3 {
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 15px;
          background: linear-gradient(to right, #ffffff, #fcb900);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .stakeholder-text p.desc {
          font-size: 17px;
          color: #cbd5e1;
          line-height: 1.6;
          margin-bottom: 25px;
        }

        .stakeholder-text ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .stakeholder-text li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          color: #e2e8f0;
          line-height: 1.5;
        }

        .stakeholder-text li svg {
          color: #fcb900;
          flex-shrink: 0;
          margin-top: 3px;
        }

        .stakeholder-preview {
          width: 50%;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(5, 8, 22, 0.8);
          aspect-ratio: 16/10;
        }

        .stakeholder-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        @media (max-width: 991px) {
          .stakeholders-section {
            padding: 60px 5%;
          }

          .stakeholder-display {
            flex-direction: column;
            gap: 40px;
          }

          .stakeholder-text, .stakeholder-preview {
            width: 100%;
          }
        }

        /* Integrations Section */
        .integrations-section {
          padding: 100px 8%;
          position: relative;
          z-index: 10;
        }

        .integrations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 30px;
        }

        .integration-card {
          padding: 30px 20px;
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          backdrop-filter: blur(10px);
          transition: all 0.4s ease;
        }

        .integration-card:hover {
          transform: translateY(-8px);
          border-color: rgba(147, 51, 234, 0.3);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 15px 40px rgba(147, 51, 234, 0.15);
        }

        .integration-icon-wrap {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .integration-card h3 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .integration-card p {
          font-size: 14px;
          color: #cbd5e1;
          line-height: 1.5;
        }

        /* FAQ Section Accordion */
        .faq-section {
          padding: 100px 8%;
          position: relative;
          z-index: 10;
        }

        .faq-wrap {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .faq-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.3s;
        }

        .faq-item:hover {
          border-color: rgba(255, 255, 255, 0.15);
        }

        .faq-item summary {
          padding: 24px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          outline: none;
        }

        .faq-item summary::-webkit-details-marker {
          display: none;
        }

        .faq-item summary .faq-icon {
          transition: transform 0.3s;
          color: #fcb900;
        }

        .faq-item[open] summary .faq-icon {
          transform: rotate(180deg);
        }

        .faq-answer {
          padding: 0 24px 24px;
          color: #cbd5e1;
          line-height: 1.6;
        }

        /* Call To Action Section */
        .cta-section {
          padding: 120px 8%;
          text-align: center;
          position: relative;
          z-index: 10;
        }

        .cta-box {
          background: linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 80px 40px;
          border-radius: 30px;
          max-width: 1000px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }

        .cta-box h2 {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 20px;
          background: linear-gradient(to right, #ffffff, #fcb900);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .cta-box p {
          font-size: 18px;
          color: #cbd5e1;
          max-width: 600px;
          margin: 0 auto 40px;
        }

        /* Global Footer */
        footer {
          background: rgba(3, 0, 15, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 80px 8% 40px;
          position: relative;
          z-index: 10;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 50px;
          margin-bottom: 50px;
        }

        .footer-col h4 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 25px;
          color: #fcb900;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .footer-col ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .footer-col a {
          color: #cbd5e1;
          text-decoration: none;
          transition: color 0.3s;
        }

        .footer-col a:hover {
          color: #fcb900;
        }

        .footer-col.about p {
          color: #cbd5e1;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .footer-col.contact li {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #cbd5e1;
        }

        .footer-col.contact svg {
          color: #fcb900;
          flex-shrink: 0;
        }

        .footer-bottom {
          padding-top: 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #64748b;
          font-size: 14px;
        }

        .footer-bottom-links {
          display: flex;
          gap: 30px;
        }

        @media (max-width: 768px) {
          .footer-bottom {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }

          .footer-bottom-links {
            justify-content: center;
          }
        }
      `}</style>

      {/* Preloader Intro Screen */}
      <div className={`preloader ${!loading ? 'fade-out' : ''}`}>
        <div className="preloader-content">
          <div className="preloader-word">{preloaderWord}</div>
        </div>
      </div>

      {/* Global Header Navigation */}
      <nav>
        <Link href="/" className="logo">PranganPro</Link>
        <button 
          className="menu-toggle" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <Link href="/modules" onClick={() => setMobileMenuOpen(false)}>Modules</Link>
          <Link href="/gallery" onClick={() => setMobileMenuOpen(false)}>Gallery</Link>
          <Link href="/login" className="btn-login" onClick={() => setMobileMenuOpen(false)}>Login</Link>
          <Link href="/book-demo" onClick={() => setMobileMenuOpen(false)}>
            <button className="btn-demo">Book Demo</button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-left">
          <h1>Campus Management System for Schools &amp; Colleges</h1>
          <p>
            Unify every academic, operational, and administrative task in one powerful system — designed to build modern, compliant, and smart campuses.
          </p>
          <div className="hero-ctas">
            <Link href="/book-demo">
              <button className="hero-primary">Book Free Demo</button>
            </Link>
            <Link href="/modules">
              <button className="hero-secondary">
                Explore Modules <ArrowRight size={18} />
              </button>
            </Link>
            <button 
              className="hero-download"
              onClick={handleDownloadClick}
            >
              <Download size={18} /> Download App
            </button>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-stack-bg"></div>
          {/* Layered floating mockup cards */}
          <div className="hero-card primary">
            <img src="/images/dashboard.png" alt="PranganPro Dashboard View" />
          </div>
          <div className="hero-card secondary">
            <img src="/images/screenshots/admin/Screenshot 2026-07-08 155250.png" alt="Admissions Enquiry Details" />
          </div>
        </div>
      </section>

      {/* Infinite Auto-scrolling Marquee */}
      <div className="marquee-section">
        <div className="marquee-container">
          {/* Track 1 */}
          <div className="marquee-item"><span className="dot"></span> Biometric and Security Hardware integration</div>
          <div className="marquee-item"><span className="dot"></span> Seamless Tally Integration</div>
          <div className="marquee-item"><span className="dot"></span> Razorpay &amp; Paytm Payment Gateways</div>
          <div className="marquee-item"><span className="dot"></span> NEP 2020 Compliant Frameworks</div>
          <div className="marquee-item"><span className="dot"></span> SMS, Email &amp; WhatsApp Automated Alerts</div>
          <div className="marquee-item"><span className="dot"></span> Outcome Based Education (OBE) Ready</div>
          <div className="marquee-item"><span className="dot"></span> CBCS Curriculums and Credit System</div>
          
          {/* Repeated Track for Infinite Loop */}
          <div className="marquee-item"><span className="dot"></span> Biometric and Security Hardware integration</div>
          <div className="marquee-item"><span className="dot"></span> Seamless Tally Integration</div>
          <div className="marquee-item"><span className="dot"></span> Razorpay &amp; Paytm Payment Gateways</div>
          <div className="marquee-item"><span className="dot"></span> NEP 2020 Compliant Frameworks</div>
          <div className="marquee-item"><span className="dot"></span> SMS, Email &amp; WhatsApp Automated Alerts</div>
          <div className="marquee-item"><span className="dot"></span> Outcome Based Education (OBE) Ready</div>
          <div className="marquee-item"><span className="dot"></span> CBCS Curriculums and Credit System</div>
        </div>
      </div>

      {/* Core Solutions (ERP vs LMS Tabs) Section */}
      <section className="solutions-section">
        <div className="section-header">
          <h2>Two Platforms, One Connected Ecosystem</h2>
          <p>
            Choose between administrative operations or classroom teaching tools, all integrated with a single centralized database.
          </p>
        </div>

        <div className="solutions-tabs">
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeTab === 'erp' ? 'active' : ''}`}
              onClick={() => setActiveTab('erp')}
            >
              Enterprise ERP
            </button>
            <button 
              className={`tab-btn ${activeTab === 'lms' ? 'active' : ''}`}
              onClick={() => setActiveTab('lms')}
            >
              Academic LMS
            </button>
          </div>
        </div>

        <div className="solutions-grid">
          <div className="solutions-features">
            {activeTab === 'erp' ? (
              <>
                <div className="feature-item-card">
                  <h3>Admissions &amp; Enquiry <span className="badge">Active</span></h3>
                  <p>Digitize applications from prospect enquiry to official onboarding, with automated merit lists and lead funnel statistics.</p>
                </div>
                <div className="feature-item-card">
                  <h3>Fee Collection &amp; Tally Sync <span className="badge">Tally Sync</span></h3>
                  <p>Automate dynamic fee cycles, process payments online, and push ledger updates directly to Tally ERP.</p>
                </div>
                <div className="feature-item-card">
                  <h3>Biometric HR &amp; RFID Attendance <span className="badge">Hardware</span></h3>
                  <p>Monitor leaves, record classroom presence, and sync teacher/student logs directly with the master schedule.</p>
                </div>
              </>
            ) : (
              <>
                <div className="feature-item-card">
                  <h3>NEP 2020 &amp; CBCS Planner <span className="badge">NEP Ready</span></h3>
                  <p>Build outcomes-based learning structures and assign flexible course choices with credit trackers.</p>
                </div>
                <div className="feature-item-card">
                  <h3>AI-Assisted Timetable Builder <span className="badge">AI Powered</span></h3>
                  <p>Create conflict-free school or college schedules automatically, distributing classrooms, labs, and staff slots.</p>
                </div>
                <div className="feature-item-card">
                  <h3>Assessments &amp; Report Cards <span className="badge">Automated</span></h3>
                  <p>Design grading systems for online/offline exams, calculate GPA scores, and generate compliant report card templates.</p>
                </div>
              </>
            )}
          </div>

          <div className="solutions-preview">
            {activeTab === 'erp' ? (
              <img src="/images/dashboard.png" alt="ERP Dashboard Preview" />
            ) : (
              <img src="/images/screenshots/teacher/Screenshot 2026-07-08 154144.png" alt="LMS Classroom Preview" />
            )}
          </div>
        </div>
      </section>

      {/* Stakeholders Section ("EDU for...") */}
      <section className="stakeholders-section">
        <div className="section-header">
          <h2>Built for Every Role</h2>
          <p>
            A tailored experience with specific access privileges and features designed for the unique roles in your institution.
          </p>
        </div>

        <div className="stakeholders-tabs-wrap">
          {stakeholders.map((s) => (
            <button
              key={s.id}
              className={`stakeholder-tab ${activeStakeholder === s.id ? 'active' : ''}`}
              onClick={() => setActiveStakeholder(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="stakeholder-display">
          <div className="stakeholder-text">
            <h3>{stakeholders.find(s => s.id === activeStakeholder)?.title}</h3>
            <p className="desc">{stakeholders.find(s => s.id === activeStakeholder)?.desc}</p>
            <ul>
              {stakeholders.find(s => s.id === activeStakeholder)?.points.map((p, idx) => (
                <li key={idx}>
                  <CheckCircle size={20} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="stakeholder-preview">
            <img 
              src={stakeholders.find(s => s.id === activeStakeholder)?.screenshot} 
              alt={`${activeStakeholder} screenshot`} 
            />
          </div>
        </div>
      </section>

      {/* Integrations Grid Section */}
      <section className="integrations-section">
        <div className="section-header">
          <h2>Centralized Integrations</h2>
          <p>We connect with standard third-party tools to extend the capability of your digital campus.</p>
        </div>

        <div className="integrations-grid">
          <div className="integration-card">
            <div className="integration-icon-wrap">
              <Layers size={32} style={{ color: '#a855f7' }} />
            </div>
            <h3>Tally Accounts</h3>
            <p>Sync all fee collections, refunds, and bank entries with accounting Ledgers.</p>
          </div>
          <div className="integration-card">
            <div className="integration-icon-wrap">
              <Monitor size={32} style={{ color: '#fcb900' }} />
            </div>
            <h3>Biometric Devices</h3>
            <p>Integrate Hikvision, Essl, and RFID cards for teacher and student check-ins.</p>
          </div>
          <div className="integration-card">
            <div className="integration-icon-wrap">
              <BookOpen size={32} style={{ color: '#3b82f6' }} />
            </div>
            <h3>UDISE+ Reporting</h3>
            <p>Export pre-formatted CSV and Excel worksheets ready for government compliance uploads.</p>
          </div>
          <div className="integration-card">
            <div className="integration-icon-wrap">
              <TrendingUp size={32} style={{ color: '#22c55e' }} />
            </div>
            <h3>Razorpay / Paytm</h3>
            <p>Offer transparent online payment methods for students via netbanking, cards, or UPI.</p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-header">
          <h2>Frequently Asked Questions</h2>
          <p>Find quick answers to common queries regarding security, integration, and setup.</p>
        </div>

        <div className="faq-wrap">
          <details className="faq-item">
            <summary>
              Is the system NEP 2020 and CBCS ready?
              <ChevronDown size={20} className="faq-icon" />
            </summary>
            <div className="faq-answer">
              Yes, PranganPro fully supports the National Education Policy (NEP 2020) and Choice Based Credit System (CBCS), enabling your institution to configure outcome-based curriculums, elective selections, and credit transfers.
            </div>
          </details>

          <details className="faq-item">
            <summary>
              Can we synchronize biometric hardware directly?
              <ChevronDown size={20} className="faq-icon" />
            </summary>
            <div className="faq-answer">
              Absolutely. Our system features background sync scripts that pull raw logs from Hikvision, Essl, and general RFID systems, updating student/staff databases instantly.
            </div>
          </details>

          <details className="faq-item">
            <summary>
              How secure is the financial transaction log?
              <ChevronDown size={20} className="faq-icon" />
            </summary>
            <div className="faq-answer">
              Every fee transaction is logged securely. The integration with Razorpay/Paytm processes details through PCI-DSS compliant channels, and any manual edits in ledgers leave audit trails.
            </div>
          </details>

          <details className="faq-item">
            <summary>
              Does it auto-sync with accounting tools?
              <ChevronDown size={20} className="faq-icon" />
            </summary>
            <div className="faq-answer">
              Yes, we support direct sync files or API connectors for Tally Prime, ensuring that day-to-day balance reconciliations require zero manual keying.
            </div>
          </details>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="cta-section">
        <div className="cta-box">
          <h2>Ready to Digitize Your Campus?</h2>
          <p>Set up a live walk-through with our software consultants and see the transformation in actions.</p>
          <Link href="/book-demo">
            <button className="hero-primary">Get Started Now</button>
          </Link>
        </div>
      </section>



      {/* VanillaTilt Loader and Initialization Script */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          const VanillaTilt = (window as any).VanillaTilt;
          if (VanillaTilt) {
            VanillaTilt.init(document.querySelectorAll(".hero-card"), {
              max: 10,
              speed: 400,
              glare: true,
              "max-glare": 0.3
            });
          }
        }}
      />
    </div>
  );
}
