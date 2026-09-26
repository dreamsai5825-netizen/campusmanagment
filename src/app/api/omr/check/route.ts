import { NextRequest, NextResponse } from 'next/server';
import { valuateOMRSheet } from '@/ai/flows/omr-valuation-flow';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await valuateOMRSheet(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/omr/check Error]:', error);
    return NextResponse.json(
      { error: error.message || 'OMR valuation failed' },
      { status: 500 }
    );
  }
}
