import { NextRequest, NextResponse } from 'next/server';
import { trainOMRMLModel } from '@/ai/flows/omr-valuation-flow';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { epochs = 5, lr = 0.001 } = await req.json().catch(() => ({}));
    const result = await trainOMRMLModel(epochs, lr);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /api/omr/ml/train Error]:', error);
    return NextResponse.json(
      { error: error.message || 'ML training failed' },
      { status: 500 }
    );
  }
}
