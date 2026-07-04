'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  getCurrentAcademicYear,
  getAvailableAcademicYears,
} from '@/lib/academic-year';

interface AcademicYearContextType {
  selectedAcademicYear: string;
  setSelectedAcademicYear: (year: string) => void;
  availableAcademicYears: string[];
  currentAcademicYear: string;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(
  undefined
);

const STORAGE_KEY = 'campusConnect_selectedAcademicYear';

export function AcademicYearProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentAcademicYear = useMemo(() => getCurrentAcademicYear(), []);
  const availableAcademicYears = useMemo(() => getAvailableAcademicYears(), []);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(
    currentAcademicYear
  );
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const savedYear = localStorage.getItem(STORAGE_KEY);
      if (savedYear && availableAcademicYears.includes(savedYear)) {
        setSelectedAcademicYear(savedYear);
      }
      setIsInitialized(true);
    } catch {
      setIsInitialized(true);
    }
  }, [availableAcademicYears]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, selectedAcademicYear);
    } catch {
      /* ignore storage errors */
    }
  }, [selectedAcademicYear, isInitialized]);

  return (
    <AcademicYearContext.Provider
      value={{
        selectedAcademicYear,
        setSelectedAcademicYear,
        availableAcademicYears,
        currentAcademicYear,
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const context = useContext(AcademicYearContext);
  if (context === undefined) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
}
