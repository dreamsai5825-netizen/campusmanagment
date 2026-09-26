import { NextRequest, NextResponse } from 'next/server';
import { submitOMRMLFeedback } from '@/ai/flows/omr-valuation-flow';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { base64Image, label, sampleName } = await req.json();
    const result = await submitOMRMLFeedback(base64Image, label, sampleName);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/omr/ml/feedback Error]:', error);
    return NextResponse.json(
      { error: error.message || 'ML feedback submission failed' },
      { status: 500 }
    );
  }
}
