'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function BookDemo() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    institution: '',
    role: 'Admin',
    preferredDate: '',
    message: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData.fullName || !formData.email || !formData.phone || !formData.institution || !formData.preferredDate) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'demo_bookings'), {
        ...formData,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
    } catch (err: any) {
      console.error('Error saving demo booking: ', err);
      setError('An error occurred while booking your demo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edu-erp-landing book-demo-page">
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

        /* Form Container Styles */
        .form-section {
          padding: 80px 8%;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 10;
        }

        .form-card {
          width: 100%;
          max-width: 600px;
          padding: 40px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
        }

        .form-card h1 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 10px;
          text-align: center;
          background: linear-gradient(to right, #fff, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .form-card p.subtitle {
          color: #cbd5e1;
          font-size: 15px;
          margin-bottom: 30px;
          text-align: center;
          line-height: 1.5;
        }

        .form-group {
          margin-bottom: 22px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
          color: #cbd5e1;
        }

        .form-group label span {
          color: #ef4444;
        }

        .form-control {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: white;
          font-size: 15px;
          outline: none;
          transition: all 0.3s;
        }

        .form-control:focus {
          border-color: #2563eb;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 0 10px rgba(37, 99, 235, 0.2);
        }

        select.form-control {
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
          background-repeat: no-repeat;
          background-position: right 15px center;
        }

        select.form-control option {
          background: #090d22;
          color: white;
        }

        .error-message {
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #f87171;
          font-size: 14px;
          margin-bottom: 22px;
        }

        .submit-btn {
          width: 100%;
          padding: 16px;
          background: #2563eb;
          border: none;
          color: white;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .submit-btn:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-2px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Success Card Styles */
        .success-card {
          text-align: center;
          padding: 30px 10px;
        }

        .success-icon {
          font-size: 60px;
          color: #10b981;
          margin-bottom: 20px;
        }

        .success-card h2 {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 15px;
        }

        .success-card p {
          color: #cbd5e1;
          line-height: 1.6;
          font-size: 16px;
          margin-bottom: 30px;
        }

        .success-card button {
          padding: 14px 30px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          color: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
        }

        .success-card button:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.2);
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

      {/* Form Section */}
      <main className="form-section">
        <div className="form-card">
          {!success ? (
            <form onSubmit={handleSubmit}>
              <h1>Book a Demo Session</h1>
              <p className="subtitle">
                Request a live personalized walkthrough of the PranganPro portal with our digitalization experts.
              </p>

              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label htmlFor="fullName">Full Name <span>*</span></label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Work Email <span>*</span></label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. j.doe@institution.edu"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number <span>*</span></label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="institution">College / School Name <span>*</span></label>
                <input
                  type="text"
                  id="institution"
                  name="institution"
                  required
                  value={formData.institution}
                  onChange={handleChange}
                  placeholder="e.g. Annapurna Institute of Technology"
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Your Role / Designation</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="form-control"
                >
                  <option value="Admin">School/College Admin</option>
                  <option value="Principal">Principal / Director</option>
                  <option value="Teacher">Teacher / Faculty</option>
                  <option value="Student">Student / Parent Representative</option>
                  <option value="Board">Board Member / Owner</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="preferredDate">Preferred Date <span>*</span></label>
                <input
                  type="date"
                  id="preferredDate"
                  name="preferredDate"
                  required
                  value={formData.preferredDate}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Requirements / Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us about your campus size or specific modules of interest..."
                  className="form-control"
                ></textarea>
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Submitting request...' : 'Book My Demo'}
              </button>
            </form>
          ) : (
            <div className="success-card">
              <div className="success-icon">✓</div>
              <h2>Request Received!</h2>
              <p>
                Thank you, <strong>{formData.fullName}</strong>. Your demo booking request has been successfully submitted. Our campus digitalization team will reach out to you within 24 hours at <strong>{formData.email}</strong>.
              </p>
              <Link href="/">
                <button>Return to Home</button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
