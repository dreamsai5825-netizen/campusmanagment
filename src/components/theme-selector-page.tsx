'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppTheme, ThemeType } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';
import { Check, Palette, Sparkles, Sun, Moon } from 'lucide-react';

interface ThemeOption {
  id: ThemeType;
  name: string;
  description: string;
  isDark: boolean;
  previewBg: string;
  previewCard: string;
  previewSidebar: string;
  previewButton: string;
}

const themeOptions: ThemeOption[] = [
  {
    id: 'default',
    name: 'Default (Warm Light)',
    description: 'The classic CMS theme with warm beige tones, white cards, and vibrant blue accents.',
    isDark: false,
    previewBg: 'bg-gradient-to-br from-[#faf8f5] to-[#f0f1f5] border-slate-200',
    previewCard: 'bg-white border-slate-100 shadow-sm',
    previewSidebar: 'bg-[#f4f5f8] border-r border-slate-200',
    previewButton: 'bg-blue-600 text-white',
  },
  {
    id: 'theme-white',
    name: 'Pure White (Cool Light)',
    description: 'A clean, high-contrast flat light theme with cool slate tones and modern grey borders.',
    isDark: false,
    previewBg: 'bg-slate-50 border-slate-200',
    previewCard: 'bg-white border-slate-200 shadow-none',
    previewSidebar: 'bg-white border-r border-slate-200',
    previewButton: 'bg-blue-600 text-white',
  },
  {
    id: 'theme-simple-dark',
    name: 'Simple Dark (Flat Dark)',
    description: 'Easy on the eyes. A classic dark theme with dark charcoal backgrounds and flat solid cards.',
    isDark: true,
    previewBg: 'bg-zinc-950 border-zinc-800',
    previewCard: 'bg-zinc-900 border-zinc-800',
    previewSidebar: 'bg-zinc-950 border-r border-zinc-800',
    previewButton: 'bg-zinc-100 text-zinc-900',
  },
  {
    id: 'theme-glass-dark',
    name: 'Glass Dark (Glassmorphism)',
    description: 'A premium dark mode featuring glowing radial backgrounds and glassmorphic blurred card overlays.',
    isDark: true,
    previewBg: 'bg-gradient-to-br from-[#0b0f19] via-[#090b11] to-[#0b0f19] border-slate-800 radial-glow',
    previewCard: 'bg-slate-900/40 backdrop-blur-md border-white/10 shadow-lg',
    previewSidebar: 'bg-[#06080d]/60 backdrop-blur-md border-r border-white/5',
    previewButton: 'bg-indigo-500 text-white',
  },
];

export function ThemeSelectorPage() {
  const { theme: currentTheme, setTheme } = useAppTheme();

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Palette className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold font-headline tracking-tight">Theme Settings</h1>
        </div>
        <p className="text-muted-foreground text-md max-w-2xl">
          Customize your dashboard experience. Choose a theme that matches your workspace style. 
          Your preference will be synchronized across all your devices and won&apos;t affect any other users.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {themeOptions.map((option) => {
          const isSelected = currentTheme === option.id;
          return (
            <Card
              key={option.id}
              onClick={() => setTheme(option.id)}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden cursor-pointer border transition-all duration-300 hover:shadow-md hover:scale-[1.01]',
                isSelected 
                  ? 'border-primary ring-2 ring-primary/20 bg-accent/10' 
                  : 'hover:border-muted-foreground/30'
              )}
            >
              {option.id === 'theme-glass-dark' && (
                <div className="absolute top-2 right-2 text-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {option.isDark ? (
                      <Moon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-lg font-bold">{option.name}</CardTitle>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <CardDescription className="line-clamp-2 mt-1">
                  {option.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-6">
                {/* Visual Preview */}
                <div className={cn('relative h-32 w-full rounded-lg border overflow-hidden p-2 flex gap-2', option.previewBg)}>
                  {/* Glowing background helper for glass theme preview */}
                  {option.id === 'theme-glass-dark' && (
                    <>
                      <div className="absolute top-0 left-1/4 w-16 h-16 rounded-full bg-indigo-500/10 blur-xl" />
                      <div className="absolute bottom-0 right-1/4 w-16 h-16 rounded-full bg-rose-500/5 blur-xl" />
                    </>
                  )}

                  {/* Sidebar Preview */}
                  <div className={cn('w-12 h-full rounded border-r flex flex-col justify-between p-1', option.previewSidebar)}>
                    <div className="space-y-1">
                      <div className="w-6 h-1.5 rounded bg-muted-foreground/30" />
                      <div className="w-8 h-1 rounded bg-muted-foreground/20" />
                      <div className="w-7 h-1 rounded bg-muted-foreground/20" />
                    </div>
                    <div className="w-8 h-1.5 rounded bg-muted-foreground/30" />
                  </div>

                  {/* Content Area Preview */}
                  <div className="flex-1 flex flex-col gap-2 p-1 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-2 rounded bg-muted-foreground/45" />
                      <div className="w-4 h-4 rounded-full bg-muted-foreground/20" />
                    </div>

                    <div className={cn('flex-1 rounded p-1.5 border flex flex-col justify-between', option.previewCard)}>
                      <div className="space-y-1">
                        <div className="w-16 h-1.5 rounded bg-muted-foreground/30" />
                        <div className="w-24 h-1 rounded bg-muted-foreground/15" />
                      </div>
                      <div className="flex justify-end">
                        <div className={cn('w-8 h-3 rounded text-[6px] flex items-center justify-center font-bold px-0.5', option.previewButton)}>
                          Btn
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
