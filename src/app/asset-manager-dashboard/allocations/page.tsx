'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

export default function AllocationsPage() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div>
        <h1 className="text-3xl font-extrabold font-headline tracking-tight">Asset Allocations</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">Track and manage equipment issued to departments, teachers, or students.</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-bold text-lg">No Active Allocations</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">Generate dynamic digital signatures or allocate device barcode IDs to track student and faculty rentals.</p>
        </CardContent>
      </Card>
    </div>
  );
}
