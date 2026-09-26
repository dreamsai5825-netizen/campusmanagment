import { NextResponse } from 'next/server';
import { getOMRMLStatus } from '@/ai/flows/omr-valuation-flow';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = await getOMRMLStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[API /api/omr/ml/status Error]:', error);
    return NextResponse.json(
      {
        model_loaded: false,
        total_labeled_samples: 0,
        unlabelled_samples: 0,
        last_trained: 'N/A',
        training_accuracy: 0,
        loss: 0,
        error: error.message || 'Failed to fetch ML status',
      },
      { status: 200 }
    );
  }
}
