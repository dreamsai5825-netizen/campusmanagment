'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type ThemeType = 'default' | 'theme-white' | 'theme-simple-dark' | 'theme-glass-dark';

type ThemeContextType = {
  theme: ThemeType;
  setTheme: (newTheme: ThemeType) => Promise<void>;
  isLoadingTheme: boolean;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [theme, setThemeState] = useState<ThemeType>('default');
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);

  // Apply theme to document element
  const applyTheme = (themeName: ThemeType) => {
    const html = document.documentElement;
    html.classList.remove('dark', 'theme-white', 'theme-simple-dark', 'theme-glass-dark');

    if (themeName === 'theme-simple-dark') {
      html.classList.add('dark', 'theme-simple-dark');
    } else if (themeName === 'theme-glass-dark') {
      html.classList.add('dark', 'theme-glass-dark');
    } else if (themeName === 'theme-white') {
      html.classList.add('theme-white');
    } else {
      html.classList.add('theme-default');
    }
    
    // Save as preset for the head script to prevent flash
    localStorage.setItem('theme_preset', themeName);
  };

  // Sync theme when user logs in/out
  useEffect(() => {
    async function syncTheme() {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const localKey = `theme_${uid}`;
        const cachedTheme = localStorage.getItem(localKey) as ThemeType | null;

        if (cachedTheme) {
          setThemeState(cachedTheme);
          applyTheme(cachedTheme);
          setIsLoadingTheme(false);
          
          // Sync theme to Firestore in background
          try {
            const docRef = doc(db, 'user_themes', uid);
            setDoc(docRef, { theme: cachedTheme }, { merge: true });
          } catch (e) {
            console.error('Failed to sync theme to Firestore', e);
          }
        } else {
          // Check Firestore
          try {
            const docRef = doc(db, 'user_themes', uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().theme) {
              const firestoreTheme = docSnap.data().theme as ThemeType;
              setThemeState(firestoreTheme);
              applyTheme(firestoreTheme);
              localStorage.setItem(localKey, firestoreTheme);
            } else {
              // Default to whatever theme is already active (theme_preset) or default
              const currentPreset = (localStorage.getItem('theme_preset') as ThemeType) || 'default';
              setThemeState(currentPreset);
              applyTheme(currentPreset);
              localStorage.setItem(localKey, currentPreset);
              // Save to Firestore
              setDoc(docRef, { theme: currentPreset }, { merge: true });
            }
          } catch (e) {
            console.error('Error fetching theme from Firestore', e);
            // Fallback to theme_preset
            const currentPreset = (localStorage.getItem('theme_preset') as ThemeType) || 'default';
            setThemeState(currentPreset);
            applyTheme(currentPreset);
          } finally {
            setIsLoadingTheme(false);
          }
        }
      } else {
        // User logged out - revert to default or theme_preset
        const guestTheme = (localStorage.getItem('theme_preset') as ThemeType) || 'default';
        setThemeState(guestTheme);
        applyTheme(guestTheme);
        setIsLoadingTheme(false);
      }
    }

    syncTheme();
  }, [firebaseUser]);

  // Global 3D tilt listener for cards when Glass Dark theme is active
  useEffect(() => {
    if (theme !== 'theme-glass-dark') return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-sidebar="sidebar"], [data-sidebar], aside, nav, .sidebar')) return;

      const card = target.closest('.card, .bg-card, [class*="bg-card"]') as HTMLElement;
      if (!card) return;
      if (card.closest('[data-sidebar="sidebar"], [data-sidebar], aside, nav, .sidebar')) return;

      const r = card.getBoundingClientRect();
      
      // Do not tilt large content panels, tables, or lists to keep interactive buttons steady
      if (r.width > 450 || r.height > 250) {
        return;
      }

      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      
      const rx = (r.height / 2 - y) / 10;
      const ry = (x - r.width / 2) / 10;
      
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px)`;
      card.style.transition = 'transform 0.1s ease';
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-sidebar="sidebar"], [data-sidebar], aside, nav, .sidebar')) return;

      const relatedTarget = e.relatedTarget as HTMLElement;
      const card = target.closest('.card, .bg-card, [class*="bg-card"]') as HTMLElement;
      
      if (card && (!relatedTarget || !card.contains(relatedTarget))) {
        card.style.transform = 'rotateX(0deg) rotateY(0deg)';
        card.style.transition = 'transform 0.5s ease';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseOut);
      
      // Reset transforms on cleanup
      document.querySelectorAll('.card, .bg-card, [class*="bg-card"]').forEach((c) => {
        const el = c as HTMLElement;
        el.style.transform = '';
        el.style.transition = '';
      });
    };
  }, [theme]);

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    applyTheme(newTheme);

    if (firebaseUser) {
      const uid = firebaseUser.uid;
      localStorage.setItem(`theme_${uid}`, newTheme);
      try {
        const docRef = doc(db, 'user_themes', uid);
        await setDoc(docRef, { theme: newTheme }, { merge: true });
      } catch (e) {
        console.error('Failed to save theme to Firestore', e);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoadingTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
