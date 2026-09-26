'use client';

import React from 'react';
import Link from 'next/link';
import Script from 'next/script';

export default function Modules() {
  return (
    <div className="edu-erp-landing modules-page">
      {/* Scope CSS styles exactly to our modules page container */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

        .edu-erp-landing {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
          background: #050816;
          min-height: 100vh;
          width: 100%;
          color: white;
          position: relative;
          overflow-x: hidden;
        }

        .edu-erp-landing * {
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
        }

        .edu-erp-landing::before {
          content: "";
          position: fixed;
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(circle at top left, #2563eb55, transparent),
            radial-gradient(circle at bottom right, #9333ea55, transparent);
          z-index: 0;
          top: 0;
          left: 0;
          pointer-events: none;
        }

        .edu-erp-landing .blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          animation: move-blob 12s infinite alternate;
          z-index: 0;
          pointer-events: none;
        }

        .edu-erp-landing .one {
          width: 350px;
          height: 350px;
          background: #2563eb;
          left: -100px;
          top: -100px;
        }

        .edu-erp-landing .two {
          width: 350px;
          height: 350px;
          background: #9333ea;
          right: -100px;
          bottom: -100px;
        }

        @keyframes move-blob {
          100% {
            transform: translateY(80px) translateX(60px);
          }
        }

        .edu-erp-landing nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 8%;
          position: sticky;
          top: 0;
          backdrop-filter: blur(20px);
          background: rgba(5, 8, 22, 0.7);
          border-bottom: 1px solid rgba(255, 255, 255, .08);
          z-index: 50;
        }

        .edu-erp-landing .logo {
          font-size: 30px;
          font-weight: 700;
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
          transition: color 0.3s ease;
          display: inline-flex;
          align-items: center;
        }

        .edu-erp-landing nav a:hover {
          color: #9333ea;
        }

        .edu-erp-landing nav button {
          padding: 12px 22px;
          background: #2563eb;
          border: none;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.3s ease, transform 0.2s ease;
        }

        .edu-erp-landing nav button:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .edu-erp-landing nav {
            flex-direction: column;
            gap: 15px;
            padding: 15px 4%;
            text-align: center;
          }

          .edu-erp-landing nav .nav-links {
            gap: 15px;
            flex-wrap: wrap;
            justify-content: center;
          }

          .edu-erp-landing nav a {
            font-size: 14px;
          }

          .edu-erp-landing nav button {
            padding: 8px 16px;
            font-size: 14px;
          }
        }

        /* Modules styles */
        .modules-header {
          text-align: center;
          padding: 80px 8% 40px;
          position: relative;
          z-index: 10;
        }

        .modules-header h1 {
          font-size: 50px;
          margin-bottom: 20px;
          font-weight: 700;
          background: linear-gradient(to right, #fff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .modules-header p {
          font-size: 18px;
          color: #cbd5e1;
          max-width: 700px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .module-section {
          padding: 60px 8%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 10;
          gap: 60px;
        }

        .module-section:nth-of-type(even) {
          flex-direction: row-reverse;
        }

        .module-text {
          width: 50%;
        }

        .module-badge {
          display: inline-block;
          padding: 6px 15px;
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(37, 99, 235, 0.3);
          color: #3b82f6;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .principal-badge {
          background: rgba(147, 51, 234, 0.15);
          border-color: rgba(147, 51, 234, 0.3);
          color: #a855f7;
        }

        .teacher-badge {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.3);
          color: #10b981;
        }

        .student-badge {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
          color: #f59e0b;
        }

        .module-text h2 {
          font-size: 36px;
          margin-bottom: 20px;
          font-weight: 700;
        }

        .module-text p {
          color: #cbd5e1;
          font-size: 16px;
          line-height: 1.8;
          margin-bottom: 30px;
        }

        .feature-bullets {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .feature-bullets li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
          color: #cbd5e1;
          font-size: 15px;
        }

        .feature-bullets li span.icon {
          color: #3b82f6;
          font-size: 18px;
          line-height: 1;
        }

        .principal-bullets li span.icon {
          color: #a855f7;
        }

        .teacher-bullets li span.icon {
          color: #10b981;
        }

        .student-bullets li span.icon {
          color: #f59e0b;
        }

        .module-image-container {
          width: 50%;
          display: flex;
          justify-content: center;
        }

        .module-image-tilt {
          width: 100%;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
          transition: border-color 0.3s;
        }

        .module-image-tilt:hover {
          border-color: rgba(37, 99, 235, 0.4);
        }

        .principal-tilt:hover {
          border-color: rgba(147, 51, 234, 0.4);
        }

        .teacher-tilt:hover {
          border-color: rgba(16, 185, 129, 0.4);
        }

        .student-tilt:hover {
          border-color: rgba(245, 158, 11, 0.4);
        }

        .module-image-tilt img {
          width: 100%;
          display: block;
          transition: transform 0.3s ease;
        }

        .footer-cta {
          text-align: center;
          padding: 100px 20px;
          position: relative;
          z-index: 10;
        }

        .footer-cta h2 {
          font-size: 38px;
          margin-bottom: 25px;
          font-weight: 700;
        }

        .footer-cta button {
          padding: 16px 38px;
          background: #2563eb;
          border: none;
          border-radius: 10px;
          font-size: 18px;
          color: white;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.3s ease, transform 0.2s ease;
        }

        .footer-cta button:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
        }

        @media (max-width: 991px) {
          .module-section, .module-section:nth-of-type(even) {
            flex-direction: column-reverse;
            gap: 40px;
            padding: 50px 8%;
          }
          .module-text, .module-image-container {
            width: 100%;
          }
        }
      `}</style>

      {/* Decorative Blur Blobs */}
      <div className="blob one"></div>
      <div className="blob two"></div>

      {/* Navigation */}
      <nav>
        <div className="logo">PranganPro</div>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/modules">Modules</Link>
          <Link href="/gallery">Gallery</Link>
          <Link href="/login">Login</Link>
          <Link href="/book-demo">
            <button>Book Demo</button>
          </Link>
        </div>
      </nav>

      {/* Modules Header */}
      <header className="modules-header">
        <h1>Dashboard Modules</h1>
        <p>
          Discover the specialized tools and features crafted for every role within the campus ecosystem. From administrative oversight to direct student learning portals.
        </p>
      </header>

      {/* 1. College/School Admin Module */}
      <section className="module-section">
        <div className="module-text">
          <span className="module-badge">Administration</span>
          <h2>College/School Admin</h2>
          <p>
            An all-in-one terminal for the operations management team. The Admin dashboard allows registration of users, creation of cohorts, resource allocation, and general maintenance tracking.
          </p>
          <ul className="feature-bullets">
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Cohort & Class Scheduling:</strong> Initialize academic years, establish sections, assign faculty, and coordinate timeslots.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Admission Management:</strong> Register new students, import candidate spreadsheets, and generate student ID files.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Asset & Maintenance Ledger:</strong> Coordinate maintenance tickets, log physical inventories, and approve asset distributions.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Faculty Tracking:</strong> Oversee faculty attendance logs, evaluate lecture logs, and process administrative approvals.
              </div>
            </li>
          </ul>
        </div>
        <div className="module-image-container">
          <div className="module-image-tilt admin-tilt">
            <img src="/images/screenshots/admin/Screenshot 2026-07-08 154828.png" alt="Admin Dashboard Overview" />
          </div>
        </div>
      </section>

      {/* 2. Principal Dashboard Module */}
      <section className="module-section">
        <div className="module-text">
          <span className="module-badge principal-badge">Executive</span>
          <h2>Principal Terminal</h2>
          <p>
            Designed for executive decision-makers who require real-time operational insights, high-level dashboards, budget monitoring, and institutional messaging tools.
          </p>
          <ul className="feature-bullets principal-bullets">
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Real-time KPI Monitor:</strong> Review fee collection milestones, aggregate student-teacher attendance metrics, and audit complaints.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Finance Management:</strong> Review live collections, track outstanding fee invoices, and compile detailed receipt statistics.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Announcement System:</strong> Broadcast campus notices, update semester schedules, and issue alerts to select groups.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Stakeholder Directory:</strong> Access digital profiles for all students, parents, and faculty with active search and filtering.
              </div>
            </li>
          </ul>
        </div>
        <div className="module-image-container">
          <div className="module-image-tilt principal-tilt">
            <img src="/images/screenshots/principal/Screenshot 2026-07-08 151749.png" alt="Principal Cockpit Console" />
          </div>
        </div>
      </section>

      {/* 3. Teachers Module */}
      <section className="module-section">
        <div className="module-text">
          <span className="module-badge teacher-badge">Academic Staff</span>
          <h2>Faculty Console</h2>
          <p>
            An interface focused on instructional workflows. Teachers can log attendance, publish assignments, grade exams, and run a digital assessment center.
          </p>
          <ul className="feature-bullets teacher-bullets">
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>OMR Answer Sheet Checker:</strong> Scan and grade multiple-choice sheets automatically with the built-in image recognition checker.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Digital Register:</strong> Take daily attendance and maintain historical presence sheets for student dossiers.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Assignments and Assessments:</strong> Share coursework attachments, set deadlines, and feedback directly inside student lockers.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Parent & Student Communication:</strong> Message parents and coordinate meetings within secure channels.
              </div>
            </li>
          </ul>
        </div>
        <div className="module-image-container">
          <div className="module-image-tilt teacher-tilt">
            <img src="/images/screenshots/teacher/Screenshot 2026-07-08 153229.png" alt="Teacher Work Planner" />
          </div>
        </div>
      </section>

      {/* 4. Student Portal Module */}
      <section className="module-section">
        <div className="module-text">
          <span className="module-badge student-badge">Learners</span>
          <h2>Student Portal</h2>
          <p>
            A personal academic hub for students to organize coursework, track their attendance standings, check schedules, and communicate with subject teachers.
          </p>
          <ul className="feature-bullets student-bullets">
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Timetable & Deadlines:</strong> Check daily lecture schedules, homework deadlines, and upcoming exams.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Digital Assignment Locker:</strong> Download coursework details, write replies, and submit files for feedback.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Attendance Monitor:</strong> Check real-time attendance percentage to ensure compliance with institutional criteria.
              </div>
            </li>
            <li>
              <span className="icon">✔</span>
              <div>
                <strong>Online Fee Desk:</strong> View outstanding ledger invoices, review transaction logs, and print historical receipts.
              </div>
            </li>
          </ul>
        </div>
        <div className="module-image-container">
          <div className="module-image-tilt student-tilt">
            <img src="/images/screenshots/student/Screenshot 2026-07-08 154349.png" alt="Student Portal Workspace" />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="footer-cta">
        <h2>Ready to Explore Your Dashboard?</h2>
        <Link href="/book-demo">
          <button>Book a Demo Session</button>
        </Link>
      </section>

      {/* Initialize VanillaTilt on the dashboard screenshot images */}
      <Script 
        src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.1/vanilla-tilt.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          const VanillaTilt = (window as any).VanillaTilt;
          if (VanillaTilt) {
            VanillaTilt.init(document.querySelectorAll(".module-image-tilt"), {
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
