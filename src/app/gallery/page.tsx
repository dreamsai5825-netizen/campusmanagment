'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface GalleryImage {
  src: string;
  category: 'admin' | 'principal' | 'teacher' | 'student';
  title: string;
}

const GALLERY_IMAGES: GalleryImage[] = [
  // Admin screenshots
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 154828.png', category: 'admin', title: 'Admin - Main dashboard summary' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155106.png', category: 'admin', title: 'Admin - Student registration locker' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155113.png', category: 'admin', title: 'Admin - Class list configuration' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155123.png', category: 'admin', title: 'Admin - Staff rosters and access control' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155134.png', category: 'admin', title: 'Admin - Course curriculum scheduler' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155201.png', category: 'admin', title: 'Admin - Institutional finances overview' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155211.png', category: 'admin', title: 'Admin - Ticket tracking details' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155225.png', category: 'admin', title: 'Admin - Asset inventory control ledger' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155241.png', category: 'admin', title: 'Admin - Leave requests desk' },
  { src: '/images/screenshots/admin/Screenshot 2026-07-08 155250.png', category: 'admin', title: 'Admin - Complaint logs list' },

  // Principal screenshots
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 151749.png', category: 'principal', title: 'Principal - Cockpit dashboard' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 151932.png', category: 'principal', title: 'Principal - Announcement manager' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152038.png', category: 'principal', title: 'Principal - Financial audit sheets' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152251.png', category: 'principal', title: 'Principal - Class timetable overview' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152301.png', category: 'principal', title: 'Principal - Feedback compliance monitor' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152313.png', category: 'principal', title: 'Principal - School performance statistics' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152855.png', category: 'principal', title: 'Principal - Custom branded fee collection desk' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152902.png', category: 'principal', title: 'Principal - Staff leave log reviews' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152916.png', category: 'principal', title: 'Principal - Student files archive' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152934.png', category: 'principal', title: 'Principal - Teacher files archive' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 152957.png', category: 'principal', title: 'Principal - Subject configurations' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 153014.png', category: 'principal', title: 'Principal - Asset requests and allocations' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 153025.png', category: 'principal', title: 'Principal - Maintenance ticket details' },
  { src: '/images/screenshots/principal/Screenshot 2026-07-08 153031.png', category: 'principal', title: 'Principal - System audit trails' },

  // Student screenshots
  { src: '/images/screenshots/student/Screenshot 2026-07-08 154349.png', category: 'student', title: 'Student - Personal workspace dashboard' },
  { src: '/images/screenshots/student/Screenshot 2026-07-08 154358.png', category: 'student', title: 'Student - Homework submission locker' },
  { src: '/images/screenshots/student/Screenshot 2026-07-08 154409.png', category: 'student', title: 'Student - Class schedules & timings' },
  { src: '/images/screenshots/student/Screenshot 2026-07-08 154417.png', category: 'student', title: 'Student - Attendance history' },
  { src: '/images/screenshots/student/Screenshot 2026-07-08 154425.png', category: 'student', title: 'Student - Private communications list' },
  { src: '/images/screenshots/student/Screenshot 2026-07-08 154437.png', category: 'student', title: 'Student - Personal student dossier' },
  { src: '/images/screenshots/student/Screenshot 2026-07-08 154444.png', category: 'student', title: 'Student - Fee account statement details' },

  // Teacher screenshots
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 153229.png', category: 'teacher', title: 'Teacher - Academic planner dashboard' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 153952.png', category: 'teacher', title: 'Teacher - Course lecture plans list' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154003.png', category: 'teacher', title: 'Teacher - Assessment and grading board' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154013.png', category: 'teacher', title: 'Teacher - Daily register and checklist' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154022.png', category: 'teacher', title: 'Teacher - Interactive parent communication desk' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154050.png', category: 'teacher', title: 'Teacher - Calendar event management' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154109.png', category: 'teacher', title: 'Teacher - Complaint tracker' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154123.png', category: 'teacher', title: 'Teacher - Shared classroom attachments' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154144.png', category: 'teacher', title: 'Teacher - Asset requisition center' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154158.png', category: 'teacher', title: 'Teacher - Class list roster views' },
  { src: '/images/screenshots/teacher/Screenshot 2026-07-08 154210.png', category: 'teacher', title: 'Teacher - OMR automated grader page' }
];

export default function Gallery() {
  const [activeTab, setActiveTab] = useState<'all' | 'admin' | 'principal' | 'teacher' | 'student'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filteredImages = GALLERY_IMAGES.filter(
    (img) => activeTab === 'all' || img.category === activeTab
  );

  const openLightbox = (src: string) => {
    const idx = GALLERY_IMAGES.findIndex((img) => img.src === src);
    if (idx !== -1) {
      setLightboxIndex(idx);
    }
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const navigateLightbox = (direction: 'next' | 'prev') => {
    if (lightboxIndex === null) return;
    
    let newIndex = lightboxIndex;
    if (direction === 'next') {
      newIndex = (lightboxIndex + 1) % GALLERY_IMAGES.length;
    } else {
      newIndex = (lightboxIndex - 1 + GALLERY_IMAGES.length) % GALLERY_IMAGES.length;
    }
    setLightboxIndex(newIndex);
  };

  return (
    <div className="edu-erp-landing gallery-page">
      {/* Scope CSS styles exactly to our gallery page container */}
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

        /* Gallery Styles */
        .gallery-header {
          text-align: center;
          padding: 80px 8% 40px;
          position: relative;
          z-index: 10;
        }

        .gallery-header h1 {
          font-size: 50px;
          margin-bottom: 20px;
          font-weight: 700;
          background: linear-gradient(to right, #fff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gallery-header p {
          font-size: 18px;
          color: #cbd5e1;
          max-width: 700px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .gallery-tabs {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 50px;
          flex-wrap: wrap;
          position: relative;
          z-index: 10;
        }

        .gallery-tab {
          padding: 10px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border-radius: 50px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .gallery-tab:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .gallery-tab.active {
          background: #2563eb;
          border-color: #2563eb;
          color: white;
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 30px;
          padding: 0 8% 80px;
          position: relative;
          z-index: 10;
        }

        .gallery-item {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
        }

        .gallery-item img {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.5s ease;
        }

        .gallery-item:hover {
          transform: translateY(-8px);
          border-color: rgba(37, 99, 235, 0.3);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }

        .gallery-item:hover img {
          transform: scale(1.05);
        }

        .gallery-item-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(5, 8, 22, 0.95), transparent);
          padding: 25px 20px 15px;
          opacity: 0;
          transition: opacity 0.3s ease;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .gallery-item:hover .gallery-item-overlay {
          opacity: 1;
        }

        .gallery-item-title {
          font-size: 14px;
          font-weight: 500;
          color: white;
        }

        .gallery-item-tag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #3b82f6;
          margin-bottom: 5px;
        }

        /* Lightbox Styles */
        .lightbox-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(5, 8, 22, 0.95);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .lightbox-close {
          position: absolute;
          top: 30px;
          right: 40px;
          font-size: 35px;
          color: #cbd5e1;
          cursor: pointer;
          background: none;
          border: none;
          transition: color 0.2s;
        }

        .lightbox-close:hover {
          color: white;
        }

        .lightbox-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 24px;
          transition: all 0.2s;
          user-select: none;
        }

        .lightbox-nav:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-50%) scale(1.05);
        }

        .lightbox-prev {
          left: 40px;
        }

        .lightbox-next {
          right: 40px;
        }

        .lightbox-content {
          max-width: 80%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .lightbox-image-wrapper {
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .lightbox-content img {
          max-width: 100%;
          max-height: 70vh;
          display: block;
          object-fit: contain;
        }

        .lightbox-caption {
          font-size: 16px;
          color: #cbd5e1;
          text-align: center;
        }

        @media (max-width: 768px) {
          .lightbox-nav {
            width: 45px;
            height: 45px;
            font-size: 18px;
          }
          .lightbox-prev {
            left: 15px;
          }
          .lightbox-next {
            right: 15px;
          }
          .lightbox-close {
            top: 20px;
            right: 20px;
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

      {/* Gallery Header */}
      <header className="gallery-header">
        <h1>Dashboard Gallery</h1>
        <p>
          Take a visual tour through our live system interfaces. Filter screenshots by role to preview the corresponding workspace modules in detail.
        </p>
      </header>

      {/* Gallery Categories Tabs */}
      <div className="gallery-tabs">
        <button
          onClick={() => setActiveTab('all')}
          className={`gallery-tab ${activeTab === 'all' ? 'active' : ''}`}
        >
          All Screenshots
        </button>
        <button
          onClick={() => setActiveTab('admin')}
          className={`gallery-tab ${activeTab === 'admin' ? 'active' : ''}`}
        >
          Admin Portal
        </button>
        <button
          onClick={() => setActiveTab('principal')}
          className={`gallery-tab ${activeTab === 'principal' ? 'active' : ''}`}
        >
          Principal Cockpit
        </button>
        <button
          onClick={() => setActiveTab('teacher')}
          className={`gallery-tab ${activeTab === 'teacher' ? 'active' : ''}`}
        >
          Teacher Console
        </button>
        <button
          onClick={() => setActiveTab('student')}
          className={`gallery-tab ${activeTab === 'student' ? 'active' : ''}`}
        >
          Student Portal
        </button>
      </div>

      {/* Screenshots Grid */}
      <main className="gallery-grid">
        {filteredImages.map((image, index) => (
          <div
            key={image.src}
            className="gallery-item"
            onClick={() => openLightbox(image.src)}
          >
            <img src={image.src} alt={image.title} loading="lazy" />
            <div className="gallery-item-overlay">
              <span className="gallery-item-tag">{image.category}</span>
              <h3 className="gallery-item-title">{image.title}</h3>
            </div>
          </div>
        ))}
      </main>

      {/* Lightbox Overlay */}
      {lightboxIndex !== null && (
        <div className="lightbox-modal" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox}>
            &times;
          </button>
          
          <button
            className="lightbox-nav lightbox-prev"
            onClick={(e) => {
              e.stopPropagation();
              navigateLightbox('prev');
            }}
          >
            &#10094;
          </button>
          
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-image-wrapper">
              <img
                src={GALLERY_IMAGES[lightboxIndex].src}
                alt={GALLERY_IMAGES[lightboxIndex].title}
              />
            </div>
            <p className="lightbox-caption">{GALLERY_IMAGES[lightboxIndex].title}</p>
          </div>

          <button
            className="lightbox-nav lightbox-next"
            onClick={(e) => {
              e.stopPropagation();
              navigateLightbox('next');
            }}
          >
            &#10095;
          </button>
        </div>
      )}
    </div>
  );
}
