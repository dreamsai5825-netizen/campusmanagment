'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GraduationCap } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_DISMISSED_KEY = 'campus_connect_install_dismissed';
const DISMISSED_DAYS = 3;

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (Number.isNaN(t)) return false;
    return Date.now() - t < DISMISSED_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function isDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Register service worker for PWA installability
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* ignore */
      });
    }

    // Already running as installed PWA
    const standalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (standalone) {
      setIsStandalone(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show popup when install is available and not recently dismissed
      if (!wasDismissedRecently()) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show banner for iOS (no beforeinstallprompt) when not standalone
    const isIOS =
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    if (isIOS && !standalone && !wasDismissedRecently()) {
      setShowBanner(true);
      setDeferredPrompt(null);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS: just close and show instructions or link to share menu
      setShowBanner(false);
      setDismissed();
      return;
    }
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
      }
    } catch {
      /* ignore */
    } finally {
      setIsInstalling(false);
    }
    setDismissed();
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed();
  };

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const android = isAndroid();
  const desktop = isDesktop();

  // Install description: desktop app (Windows/Mac) or Android app
  const installDescription = isIOS
    ? 'Add CMS Portal to your home screen: tap the Share button in Safari, then "Add to Home Screen".'
    : android
      ? 'Add CMS Portal to your Android home screen and open it like an app from your app drawer.'
      : desktop
        ? 'Install CMS Portal as a desktop app on your PC or Mac. It will open in its own window and appear in your Start menu or Applications.'
        : 'Install CMS Portal for quick access from your home screen or app list.';

  const installButtonLabel = android ? 'Add to Android' : desktop ? 'Install as desktop app' : 'Install app';

  return (
    <>
      <Dialog open={showBanner} onOpenChange={(open) => !open && handleDismiss()}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={handleDismiss} onEscapeKeyDown={handleDismiss}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div>
                <DialogTitle>
                  {desktop ? 'Install as desktop app' : android ? 'Add to Android' : isIOS ? 'Add to Home Screen' : 'Install CMS Portal'}
                </DialogTitle>
                <DialogDescription>{installDescription}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDismiss}>
              Not now
            </Button>
            {!isIOS && (
              <Button onClick={handleInstall} disabled={isInstalling}>
                {isInstalling ? 'Installing…' : installButtonLabel}
              </Button>
            )}
            {isIOS && <Button onClick={handleDismiss}>OK</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Persistent install button when install is available but user dismissed the popup (so they can still install) */}
      {!isStandalone && deferredPrompt && !showBanner && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            size="sm"
            className="shadow-lg"
            onClick={() => setShowBanner(true)}
          >
            {installButtonLabel}
          </Button>
        </div>
      )}
    </>
  );
}
